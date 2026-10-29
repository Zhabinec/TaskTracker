import hashlib
from datetime import UTC, datetime, timedelta
from types import TracebackType
from typing import Self
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from tasktracker.application.auth.contracts import AuthError, PasswordRecord, Profile
from tasktracker.infrastructure.db.models import AuthRateWindow, SessionModel, UserModel


class SqlAuthUnitOfWork:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self._sessions = sessions
        self.session: AsyncSession

    async def __aenter__(self) -> Self:
        self.session = self._sessions()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        # SQLAlchemy shields context cleanup from cancellation and rolls back uncommitted work.
        await self.session.__aexit__(exc_type, exc, traceback)

    async def password_record(self, email: str) -> PasswordRecord | None:
        user = (
            await self.session.execute(
                select(UserModel.id, UserModel.email_normalized, UserModel.password_hash)
                .where(UserModel.email_normalized == email)
                .limit(1)
            )
        ).one_or_none()
        return (
            PasswordRecord(Profile(user.id, user.email_normalized), user.password_hash)
            if user
            else None
        )

    async def add_user(self, user: Profile, password_hash: str) -> None:
        self.session.add(
            UserModel(id=user.id, email_normalized=user.email, password_hash=password_hash)
        )
        try:
            await self.session.flush()
        except IntegrityError as exc:
            # This flush inserts only the user. Let unrelated DB failures remain failures.
            constraint = getattr(getattr(exc.orig, "__cause__", None), "constraint_name", None)
            if (
                getattr(exc.orig, "sqlstate", None) == "23505"
                and constraint == "uq_users_email_normalized"
            ):
                raise AuthError("email_unavailable") from None
            raise

    async def add_session(self, user_id: UUID, token_hash: str, expires_at: datetime) -> None:
        self.session.add(
            SessionModel(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        )

    async def resolve(self, token_hash: str) -> Profile | None:
        statement = (
            select(UserModel.id, UserModel.email_normalized)
            .join(SessionModel, SessionModel.user_id == UserModel.id)
            .where(
                SessionModel.token_hash == token_hash,
                SessionModel.revoked_at.is_(None),
                SessionModel.expires_at > func.now(),
            )
        )
        user = (await self.session.execute(statement.limit(1))).one_or_none()
        return Profile(user.id, user.email_normalized) if user else None

    async def revoke(self, token_hash: str) -> None:
        await self.session.execute(
            update(SessionModel)
            .where(
                SessionModel.token_hash == token_hash,
                SessionModel.revoked_at.is_(None),
            )
            .values(revoked_at=func.now())
        )

    async def commit(self) -> None:
        await self.session.commit()


class PostgresAuthRateLimit:
    def __init__(
        self, sessions: async_sessionmaker[AsyncSession], global_limit: int, account_limit: int
    ) -> None:
        self._sessions = sessions
        self._limits = (global_limit, account_limit)

    async def acquire(self, account: str) -> None:
        # Database time keeps all workers in the same fixed UTC minute.
        async with self._sessions.begin() as session:
            now = await session.scalar(select(func.clock_timestamp()))
            assert isinstance(now, datetime)
            window = now.astimezone(UTC).replace(second=0, microsecond=0)
            await session.execute(
                delete(AuthRateWindow).where(
                    AuthRateWindow.window_start < window - timedelta(days=1),
                )
            )
            for key, limit in zip(
                ("global", hashlib.sha256(account.encode()).hexdigest()), self._limits, strict=True
            ):
                statement = insert(AuthRateWindow).values(window_start=window, key=key, attempts=1)
                limited = statement.on_conflict_do_update(
                    index_elements=[AuthRateWindow.window_start, AuthRateWindow.key],
                    set_={"attempts": AuthRateWindow.attempts + 1},
                    where=AuthRateWindow.attempts < limit,
                ).returning(AuthRateWindow.attempts)
                if await session.scalar(limited) is None:
                    raise AuthError("rate_limited")

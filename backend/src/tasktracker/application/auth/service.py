from datetime import UTC, datetime, timedelta
from uuid import uuid4

from tasktracker.application.auth.contracts import (
    AuthError,
    AuthRateLimit,
    AuthUowFactory,
    Passwords,
    Profile,
    SessionGrant,
    Tokens,
)


class AuthService:
    def __init__(
        self,
        uow: AuthUowFactory,
        passwords: Passwords,
        tokens: Tokens,
        limiter: AuthRateLimit,
        session_hours: int,
    ) -> None:
        self.uow = uow
        self.passwords = passwords
        self.tokens = tokens
        self.limiter = limiter
        self.session_hours = session_hours

    async def register(
        self, email: str, password: str, previous: str | None = None
    ) -> SessionGrant:
        email = email.strip().lower()
        await self.limiter.acquire(email)
        if not 15 <= len(password) <= 128:
            raise AuthError("invalid_password")
        encoded = await self.passwords.hash(password)
        user = Profile(uuid4(), email)
        grant = self._grant(user)
        async with self.uow() as uow:
            await uow.add_user(user, encoded)
            await uow.add_session(
                user.id, self.tokens.digest(grant.session_token), grant.expires_at
            )
            if previous:
                await uow.revoke(self.tokens.digest(previous))
            await uow.commit()
        return grant

    async def login(self, email: str, password: str, previous: str | None = None) -> SessionGrant:
        email = email.strip().lower()
        await self.limiter.acquire(email)
        async with self.uow() as uow:
            record = await uow.password_record(email)
        valid = await self.passwords.verify(password, record.password_hash if record else None)
        if not valid or record is None:
            raise AuthError("invalid_credentials")
        grant = self._grant(record.user)
        async with self.uow() as uow:
            await uow.add_session(
                record.user.id, self.tokens.digest(grant.session_token), grant.expires_at
            )
            if previous:
                await uow.revoke(self.tokens.digest(previous))
            await uow.commit()
        return grant

    async def me(self, token: str | None) -> Profile:
        if (
            not token
            or len(token) != 43
            or any(not (c.isascii() and (c.isalnum() or c in "_-")) for c in token)
        ):
            raise AuthError("unauthenticated")
        async with self.uow() as uow:
            user = await uow.resolve(self.tokens.digest(token))
        if user is None:
            raise AuthError("unauthenticated")
        return user

    async def logout(self, token: str | None, csrf_token: str) -> None:
        await self.me(token)
        assert token is not None
        if not self.tokens.valid_csrf(token, csrf_token):
            raise AuthError("csrf_rejected")
        async with self.uow() as uow:
            await uow.revoke(self.tokens.digest(token))
            await uow.commit()

    def _grant(self, user: Profile) -> SessionGrant:
        token = self.tokens.issue()
        return SessionGrant(
            user,
            datetime.now(UTC) + timedelta(hours=self.session_hours),
            token,
            self.tokens.csrf(token),
        )

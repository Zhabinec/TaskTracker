from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    MetaData,
    String,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "pk": "pk_%(table_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ix": "ix_%(table_name)s_%(column_0_name)s",
        }
    )


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "email_normalized = lower(btrim(email_normalized)) AND "
            "char_length(email_normalized) BETWEEN 1 AND 254",
            name="ck_users_email_normalized",
        ),
        CheckConstraint("char_length(password_hash) > 0", name="ck_users_password_hash"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email_normalized: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessionModel(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="ck_sessions_token_hash"),
        CheckConstraint("expires_at > created_at", name="ck_sessions_expiry"),
        CheckConstraint("revoked_at >= created_at", name="ck_sessions_revocation"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

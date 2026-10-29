from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID


class AuthError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class Profile:
    id: UUID
    email: str


@dataclass(frozen=True)
class PasswordRecord:
    user: Profile
    password_hash: str = field(repr=False)


@dataclass(frozen=True)
class SessionGrant:
    user: Profile
    expires_at: datetime
    session_token: str = field(repr=False)
    csrf_token: str = field(repr=False)


class AuthUnitOfWork(Protocol):
    async def __aenter__(self) -> Self: ...
    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None: ...
    async def password_record(self, email: str) -> PasswordRecord | None: ...
    async def add_user(self, user: Profile, password_hash: str) -> None: ...
    async def add_session(self, user_id: UUID, token_hash: str, expires_at: datetime) -> None: ...
    async def resolve(self, token_hash: str) -> Profile | None: ...
    async def revoke(self, token_hash: str) -> None: ...
    async def commit(self) -> None: ...


class Passwords(Protocol):
    async def hash(self, password: str) -> str: ...
    async def verify(self, password: str, encoded: str | None) -> bool: ...


class Tokens(Protocol):
    def issue(self) -> str: ...
    def digest(self, raw: str) -> str: ...
    def csrf(self, raw: str) -> str: ...
    def valid_csrf(self, raw: str, supplied: str) -> bool: ...


class AuthRateLimit(Protocol):
    async def acquire(self, account: str) -> None: ...


type AuthUowFactory = Callable[[], AuthUnitOfWork]

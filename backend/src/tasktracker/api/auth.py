from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator

from tasktracker.api.errors import ErrorEnvelope
from tasktracker.application.auth.contracts import AuthError, Profile, SessionGrant
from tasktracker.application.auth.service import AuthService


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=254)
    password: SecretStr = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def trim_email(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ProfileResponse(BaseModel):
    id: UUID
    email: str

    @classmethod
    def from_result(cls, result: Profile) -> ProfileResponse:
        return cls(id=result.id, email=result.email)


class SessionResponse(BaseModel):
    user: ProfileResponse
    session_token: str
    csrf_token: str
    expires_at: datetime

    @classmethod
    def from_result(cls, result: SessionGrant) -> SessionResponse:
        return cls(
            user=ProfileResponse.from_result(result.user),
            session_token=result.session_token,
            csrf_token=result.csrf_token,
            expires_at=result.expires_at,
        )


def bearer(value: str | None) -> str | None:
    if not value:
        return None
    scheme, _, token = value.partition(" ")
    return token if scheme.lower() == "bearer" and 0 < len(token) <= 128 else None


def server_transport(origin: Annotated[str | None, Header()] = None) -> None:
    # The browser uses Next.js. Direct browser requests to the internal API are rejected.
    if origin is not None:
        raise AuthError("csrf_rejected")


def create_auth_router(service: AuthService | None) -> APIRouter:
    router = APIRouter(
        prefix="/api/v1/auth",
        tags=["auth"],
        dependencies=[Depends(server_transport)],
        responses={status: {"model": ErrorEnvelope} for status in (401, 403, 409, 422, 429, 503)},
    )

    def auth() -> AuthService:
        if service is None:
            raise AuthError("unavailable")
        return service

    @router.post("/register", response_model=SessionResponse, status_code=201)
    async def register(
        body: Credentials,
        authorization: Annotated[str | None, Header()] = None,
    ) -> SessionResponse:
        result = await auth().register(
            str(body.email), body.password.get_secret_value(), bearer(authorization)
        )
        return SessionResponse.from_result(result)

    @router.post("/login", response_model=SessionResponse)
    async def login(
        body: Credentials,
        authorization: Annotated[str | None, Header()] = None,
    ) -> SessionResponse:
        result = await auth().login(
            str(body.email), body.password.get_secret_value(), bearer(authorization)
        )
        return SessionResponse.from_result(result)

    @router.get("/me", response_model=ProfileResponse)
    async def me(authorization: Annotated[str | None, Header()] = None) -> ProfileResponse:
        return ProfileResponse.from_result(await auth().me(bearer(authorization)))

    @router.post("/logout", status_code=204)
    async def logout(
        authorization: Annotated[str | None, Header()] = None,
        x_csrf_token: Annotated[str, Header()] = "",
    ) -> Response:
        await auth().logout(bearer(authorization), x_csrf_token)
        return Response(status_code=204)

    return router

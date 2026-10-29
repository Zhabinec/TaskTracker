import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import func, select, update

from tasktracker.application.auth.contracts import AuthError, Profile
from tasktracker.bootstrap import create_app
from tasktracker.infrastructure.db.auth import PostgresAuthRateLimit, SqlAuthUnitOfWork
from tasktracker.infrastructure.db.engine import Database
from tasktracker.infrastructure.db.models import SessionModel, UserModel
from tasktracker.infrastructure.security.sessions import OpaqueTokens
from tasktracker.infrastructure.settings import Settings
from tests.integration.support import migrate

pytestmark = [pytest.mark.integration, pytest.mark.anyio]
PASSWORD = "a long password for integration tests"


@pytest.fixture
async def client(database: Database) -> AsyncIterator[AsyncClient]:
    await migrate(database, "head")
    settings = Settings.model_construct(
        environment="test",
        database_url=SecretStr(database.engine.url.render_as_string(hide_password=False)),
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as instance:
            yield instance


async def test_register_me_logout_and_hashed_storage(
    client: AsyncClient, database: Database
) -> None:
    response = await client.post(
        "/api/v1/auth/register", json={"email": "  Owner@Example.com ", "password": PASSWORD}
    )
    assert response.status_code == 201
    grant = response.json()
    assert grant["user"]["email"] == "owner@example.com"
    assert len(grant["session_token"]) == 43
    headers = {"Authorization": f"Bearer {grant['session_token']}"}
    assert response.headers["cache-control"] == "no-store"
    async with database.sessions() as session:
        user = (await session.scalars(select(UserModel))).one()
        stored = (await session.scalars(select(SessionModel))).one()
        assert user.password_hash.startswith("$argon2id$")
        assert PASSWORD not in user.password_hash
        assert stored.token_hash == OpaqueTokens().digest(grant["session_token"])
        assert stored.token_hash != grant["session_token"]
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json() == grant["user"]
    assert "session_token" not in me.text
    rejected = await client.post("/api/v1/auth/logout", headers=headers)
    assert rejected.status_code == 403
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 200
    result = await client.post(
        "/api/v1/auth/logout", headers={**headers, "X-CSRF-Token": grant["csrf_token"]}
    )
    assert result.status_code == 204
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401


async def test_login_rotation_and_server_expiry(client: AsyncClient, database: Database) -> None:
    body = {"email": "rotation@example.com", "password": PASSWORD}
    first = (await client.post("/api/v1/auth/register", json=body)).json()
    headers = {"Authorization": f"Bearer {first['session_token']}"}
    logged_in = await client.post("/api/v1/auth/login", json=body, headers=headers)
    assert logged_in.status_code == 200
    second = logged_in.json()
    assert second["session_token"] != first["session_token"]
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401
    current = {"Authorization": f"Bearer {second['session_token']}"}
    assert (await client.get("/api/v1/auth/me", headers=current)).status_code == 200
    now = datetime.now(UTC)
    async with database.sessions.begin() as session:
        await session.execute(
            update(SessionModel)
            .where(
                SessionModel.token_hash == OpaqueTokens().digest(second["session_token"]),
            )
            .values(created_at=now - timedelta(days=2), expires_at=now - timedelta(days=1))
        )
    assert (await client.get("/api/v1/auth/me", headers=current)).status_code == 401


async def test_duplicate_registration_is_atomic_in_parallel(
    client: AsyncClient, database: Database
) -> None:
    body = {"email": "duplicate@example.com", "password": PASSWORD}
    responses = await asyncio.gather(
        *[client.post("/api/v1/auth/register", json=body) for _ in range(2)]
    )
    assert sorted(response.status_code for response in responses) == [201, 409]
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(UserModel)) == 1
        assert await session.scalar(select(func.count()).select_from(SessionModel)) == 1


async def test_unknown_account_and_bad_password_have_same_error(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register", json={"email": "known@example.com", "password": PASSWORD}
    )
    errors = []
    for email in ("known@example.com", "unknown@example.com"):
        response = await client.post(
            "/api/v1/auth/login", json={"email": email, "password": "incorrect password"}
        )
        assert response.status_code == 401
        errors.append(response.json()["error"])
    assert errors[0] == errors[1]
    assert (
        await client.get("/api/v1/auth/me", headers={"X-User-Id": "anything"})
    ).status_code == 401


async def test_body_origin_and_validation_do_not_echo_secrets(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register", json={"email": "bad", "password": PASSWORD}
    )
    assert response.status_code == 422
    assert PASSWORD not in response.text
    assert response.json()["trace_id"] == response.headers["x-trace-id"]
    assert (
        await client.post(
            "/api/v1/auth/register", json={"email": "x@example.com", "password": "short"}
        )
    ).status_code == 422
    assert (
        await client.post(
            "/api/v1/auth/login",
            headers={"Origin": "https://evil.example"},
            json={"email": "a@example.com", "password": PASSWORD},
        )
    ).status_code == 403
    assert (await client.post("/api/v1/auth/login", content=b"a" * 8193)).status_code == 413

    async def chunks() -> AsyncIterator[bytes]:
        yield b"a" * 5000
        yield b"a" * 5000

    assert (await client.post("/api/v1/auth/login", content=chunks())).status_code == 413


async def test_csrf_is_bound_to_the_session(client: AsyncClient) -> None:
    grants = [
        (
            await client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
        ).json()
        for email in ("first@example.com", "second@example.com")
    ]
    first, second = grants
    headers = {
        "Authorization": f"Bearer {first['session_token']}",
        "X-CSRF-Token": second["csrf_token"],
    }
    assert (await client.post("/api/v1/auth/logout", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/auth/me", headers=headers)).json() == first["user"]


async def test_auth_limits_are_shared_and_cover_rotating_emails(
    client: AsyncClient, database: Database
) -> None:
    first = PostgresAuthRateLimit(database.sessions, global_limit=3, account_limit=2)
    second = PostgresAuthRateLimit(database.sessions, global_limit=3, account_limit=2)
    await first.acquire("limited@example.com")
    await second.acquire("limited@example.com")
    with pytest.raises(AuthError, match="rate_limited"):
        await first.acquire("limited@example.com")
    await second.acquire("another@example.com")
    with pytest.raises(AuthError, match="rate_limited"):
        await first.acquire("rotated@example.com")


async def test_http_rate_limit_returns_retry_after(client: AsyncClient) -> None:
    responses = [
        await client.post(
            "/api/v1/auth/login", json={"email": "limited@example.com", "password": PASSWORD}
        )
        for _ in range(6)
    ]
    assert [response.status_code for response in responses] == [401] * 5 + [429]
    assert responses[-1].headers["retry-after"] == "60"


async def test_cancelled_registration_rolls_back_and_releases_connection(
    client: AsyncClient, database: Database
) -> None:
    written = asyncio.Event()

    async def interrupted_command() -> None:
        async with SqlAuthUnitOfWork(database.sessions) as uow:
            await uow.add_user(Profile(uuid4(), "cancelled@example.com"), "test-fixture-hash")
            written.set()
            await asyncio.Future[None]()

    task = asyncio.create_task(interrupted_command())
    await asyncio.wait_for(written.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(UserModel)) == 0

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic import command
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import Connection, insert, select, text
from sqlalchemy.exc import IntegrityError

from tasktracker.bootstrap import create_app
from tasktracker.infrastructure.db.engine import Database
from tasktracker.infrastructure.db.migrate import migration_config
from tasktracker.infrastructure.db.models import SessionModel, UserModel
from tasktracker.infrastructure.settings import Settings
from tests.integration.support import migrate

pytestmark = [pytest.mark.integration, pytest.mark.anyio]


async def test_migration_round_trip_and_schema_readiness(database: Database) -> None:
    assert not await database.ready()
    await migrate(database, "head")
    assert await database.ready()
    await migrate(database, "head")  # Applying the same release twice is harmless.
    assert await database.ready()

    def check_metadata(connection: Connection) -> None:
        config = migration_config()
        config.attributes["connection"] = connection
        command.check(config)

    async with database.engine.connect() as connection:
        await connection.run_sync(check_metadata)
    await migrate(database, "base")
    assert not await database.ready()
    await migrate(database, "head")
    assert await database.ready()


async def test_readiness_rejects_a_newer_schema(database: Database) -> None:
    await migrate(database, "head")
    async with database.engine.begin() as connection:
        await connection.execute(text("UPDATE alembic_version SET version_num = 'future_revision'"))
    try:
        assert not await database.ready()
    finally:
        async with database.engine.begin() as connection:
            await connection.execute(
                text("UPDATE alembic_version SET version_num = :revision"),
                {"revision": next(iter(database.expected_heads))},
            )


async def test_unique_email_and_rollback_are_enforced_by_postgresql(database: Database) -> None:
    await migrate(database, "head")
    values = {"email_normalized": "owner@example.com", "password_hash": "argon2-test-fixture"}
    async with database.sessions.begin() as session:
        session.add(UserModel(**values))
    with pytest.raises(IntegrityError):
        async with database.sessions.begin() as session:
            session.add(UserModel(email_normalized="rollback@example.com", password_hash="fixture"))
            await session.flush()
            session.add(UserModel(**values))
            await session.flush()
    async with database.sessions() as session:
        emails = list((await session.scalars(select(UserModel.email_normalized))).all())
        assert emails == ["owner@example.com"]


async def test_concurrent_registrations_cannot_duplicate_email(database: Database) -> None:
    await migrate(database, "head")

    async def insert_user() -> bool:
        try:
            async with database.sessions.begin() as session:
                session.add(UserModel(email_normalized="race@example.com", password_hash="fixture"))
                await session.flush()
            return True
        except IntegrityError:
            return False

    results = await asyncio.gather(insert_user(), insert_user())
    assert sorted(results) == [False, True]
    async with database.sessions() as session:
        assert list((await session.scalars(select(UserModel.email_normalized))).all()) == [
            "race@example.com"
        ]


async def test_session_constraints_and_utc_dates(database: Database) -> None:
    await migrate(database, "head")
    user_id = uuid4()
    now = datetime.now(UTC)
    async with database.sessions.begin() as session:
        session.add(
            UserModel(id=user_id, email_normalized="session@example.com", password_hash="hash")
        )
    for values in (
        {
            "token_hash": "raw-session-token",
            "user_id": user_id,
            "expires_at": now + timedelta(days=1),
        },
        {"token_hash": "a" * 64, "user_id": uuid4(), "expires_at": now + timedelta(days=1)},
        {"token_hash": "b" * 64, "user_id": user_id, "expires_at": now - timedelta(days=1)},
    ):
        with pytest.raises(IntegrityError):
            async with database.engine.begin() as connection:
                await connection.execute(insert(SessionModel).values(id=uuid4(), **values))
    async with database.sessions.begin() as session:
        session.add(
            SessionModel(user_id=user_id, token_hash="c" * 64, expires_at=now + timedelta(days=1))
        )
    async with database.sessions() as session:
        stored = (await session.scalars(select(SessionModel))).one()
        assert stored.expires_at.utcoffset() == timedelta(0)
        assert stored.revoked_at is None


async def test_readiness_endpoint_tracks_database_schema(database: Database) -> None:
    settings = Settings(
        database_url=SecretStr(database.engine.url.render_as_string(hide_password=False))
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/health/live")).status_code == 200
            assert (await client.get("/health/ready")).status_code == 503
            await migrate(database, "head")
            response = await client.get("/health/ready")
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}
            assert response.headers["cache-control"] == "no-store"


async def test_readiness_handles_invalid_database_credentials(database: Database) -> None:
    broken = Database(database.engine.url.set(password="intentionally-invalid-test-password"))
    try:
        assert not await broken.ready()
    finally:
        await broken.close()


async def test_readiness_handles_an_unreachable_database(database: Database) -> None:
    broken = Database(database.engine.url.set(port=1))
    try:
        assert not await broken.ready()
    finally:
        await broken.close()

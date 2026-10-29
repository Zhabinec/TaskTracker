import os
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr, ValidationError

from tasktracker.bootstrap import create_app
from tasktracker.infrastructure.settings import Settings


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    for key in os.environ:
        if key.startswith("TASKTRACKER_"):
            monkeypatch.delenv(key)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_liveness_does_not_claim_database_readiness() -> None:
    transport = ASGITransport(app=create_app(Settings(environment="test")))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.get("/health/live")).json() == {"status": "ok"}
        response = await client.get("/health/ready")
        assert response.status_code == 503
        assert response.json() == {"status": "unavailable"}
        assert response.headers["cache-control"] == "no-store"


@pytest.mark.anyio
async def test_production_does_not_expose_api_documentation() -> None:
    transport = ASGITransport(
        app=create_app(
            Settings(
                environment="production",
                database_url=SecretStr("postgresql+asyncpg://test:test@127.0.0.1:1/unused_test"),
            )
        )
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert (await client.get(path)).status_code == 404
        assert (await client.get("/health/live")).status_code == 200


def test_configuration_rejects_unknown_timezone() -> None:
    with pytest.raises(ValidationError):
        Settings(product_timezone="Invalid/Timezone")


def test_production_requires_explicit_database_configuration() -> None:
    with pytest.raises(ValidationError, match="Production requires database"):
        Settings(environment="production")


def test_database_components_preserve_special_characters_in_passwords() -> None:
    settings = Settings(db_host="db", db_password=SecretStr("a@b:/% secret"))
    url = settings.connection_url()
    assert url is not None
    assert url.password == "a@b:/% secret"
    assert "secret" not in str(settings)


def test_non_postgresql_databases_are_rejected() -> None:
    with pytest.raises(ValidationError, match="PostgreSQL asyncpg"):
        Settings(database_url=SecretStr("sqlite:///local.db"))

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from tasktracker.bootstrap import create_app
from tasktracker.infrastructure.settings import Settings


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
    transport = ASGITransport(app=create_app(Settings(environment="production")))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert (await client.get(path)).status_code == 404
        assert (await client.get("/health/live")).status_code == 200


def test_configuration_rejects_unknown_timezone() -> None:
    with pytest.raises(ValidationError):
        Settings(product_timezone="Invalid/Timezone")

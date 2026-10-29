import os
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import make_url

from tasktracker.infrastructure.db.engine import Database
from tests.integration.support import migrate


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def database() -> AsyncIterator[Database]:
    value = os.environ.get("TEST_DATABASE_URL")
    if not value:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL *_test database")
    url = make_url(value)
    if url.drivername != "postgresql+asyncpg" or not (url.database or "").endswith("_test"):
        pytest.fail("Integration tests require a dedicated PostgreSQL database ending in _test")
    instance = Database(url)
    try:
        await migrate(instance, "base")
        yield instance
    finally:
        try:
            await migrate(instance, "base")
        finally:
            await instance.close()

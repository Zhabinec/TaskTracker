from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from tasktracker.api.health import create_health_router
from tasktracker.infrastructure.db.engine import Database
from tasktracker.infrastructure.settings import Settings


def create_app(settings: Settings) -> FastAPI:
    url = settings.connection_url()
    database = Database(url) if url is not None else None

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            if database is not None:
                await database.close()

    expose_docs = settings.environment != "production"
    app = FastAPI(
        title="TaskTracker API",
        version="0.1.0",
        docs_url="/docs" if expose_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if expose_docs else None,
        lifespan=lifespan,
    )
    app.include_router(create_health_router(database))
    return app

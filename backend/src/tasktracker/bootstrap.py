from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from tasktracker.api.auth import create_auth_router
from tasktracker.api.errors import install_error_handlers
from tasktracker.api.health import create_health_router
from tasktracker.api.transport import HttpTransport
from tasktracker.application.auth.service import AuthService
from tasktracker.infrastructure.db.auth import PostgresAuthRateLimit, SqlAuthUnitOfWork
from tasktracker.infrastructure.db.engine import Database
from tasktracker.infrastructure.security.passwords import ArgonPasswords
from tasktracker.infrastructure.security.sessions import OpaqueTokens
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
    auth = None
    if database is not None:
        auth = AuthService(
            lambda: SqlAuthUnitOfWork(database.sessions),
            ArgonPasswords(),
            OpaqueTokens(),
            PostgresAuthRateLimit(
                database.sessions, settings.auth_global_limit, settings.auth_account_limit
            ),
            settings.session_hours,
        )
    app.include_router(create_auth_router(auth))
    install_error_handlers(app)
    app.add_middleware(HttpTransport)
    return app

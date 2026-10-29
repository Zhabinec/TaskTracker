from fastapi import FastAPI

from tasktracker.api.health import router as health_router
from tasktracker.infrastructure.settings import Settings


def create_app(settings: Settings) -> FastAPI:
    expose_docs = settings.environment != "production"
    app = FastAPI(
        title="TaskTracker API",
        version="0.1.0",
        docs_url="/docs" if expose_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if expose_docs else None,
    )
    app.include_router(health_router)
    return app

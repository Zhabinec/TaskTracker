from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from tasktracker.infrastructure.db.engine import Database


class LiveResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadyResponse(BaseModel):
    status: Literal["ok", "unavailable"]


def create_health_router(database: Database | None) -> APIRouter:
    router = APIRouter(prefix="/health", tags=["health"])

    @router.get("/live")
    async def live() -> LiveResponse:
        return LiveResponse()

    @router.get("/ready", response_model=ReadyResponse, responses={503: {"model": ReadyResponse}})
    async def ready() -> JSONResponse:
        available = database is not None and await database.ready()
        headers = {"Cache-Control": "no-store"}
        if not available:
            headers["Retry-After"] = "30"
        return JSONResponse(
            status_code=200 if available else 503,
            content=ReadyResponse(status="ok" if available else "unavailable").model_dump(),
            headers=headers,
        )

    return router

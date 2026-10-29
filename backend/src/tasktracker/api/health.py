from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["health"])


class LiveResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadyResponse(BaseModel):
    status: Literal["unavailable"] = "unavailable"


@router.get("/live")
async def live() -> LiveResponse:
    return LiveResponse()


@router.get("/ready", response_model=ReadyResponse, status_code=503)
async def ready() -> JSONResponse:
    # Step 2 will replace this with a DB and schema revision check.
    # A live process alone must never advertise readiness for user traffic.
    return JSONResponse(
        status_code=503,
        content=ReadyResponse().model_dump(),
        headers={"Cache-Control": "no-store", "Retry-After": "30"},
    )

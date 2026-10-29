import asyncio
import json
import logging
from time import perf_counter
from uuid import uuid4

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("tasktracker.http")


class HttpTransport:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        trace_id = uuid4().hex
        scope.setdefault("state", {})["trace_id"] = trace_id
        started = perf_counter()
        status = 500
        response_started = False

        async def traced_send(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status = message["status"]
                message["headers"] = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != b"cache-control"
                ] + [
                    (b"x-trace-id", trace_id.encode()),
                    (b"cache-control", b"no-store"),
                ]
            await send(message)

        async def reject(code: str, http_status: int) -> None:
            await JSONResponse(
                {"error": {"code": code, "message": "Запрос отклонён."}, "trace_id": trace_id},
                status_code=http_status,
            )(scope, receive, traced_send)

        try:
            if scope["method"] in {"POST", "PATCH", "DELETE", "PUT"}:
                lengths = [value for name, value in scope["headers"] if name == b"content-length"]
                if len(lengths) > 1:
                    await reject("invalid_content_length", 400)
                    return
                if lengths:
                    try:
                        length = int(lengths[0])
                    except ValueError:
                        await reject("invalid_content_length", 400)
                        return
                    if not 0 <= length <= 8192:
                        await reject("body_too_large", 413)
                        return
                body = bytearray()
                async with asyncio.timeout(5):
                    while True:
                        chunk = await receive()
                        if chunk["type"] == "http.disconnect":
                            return
                        data = chunk.get("body", b"")
                        if len(body) + len(data) > 8192:
                            await reject("body_too_large", 413)
                            return
                        body.extend(data)
                        if not chunk.get("more_body", False):
                            break
                delivered = False

                async def replay() -> Message:
                    nonlocal delivered
                    if not delivered:
                        delivered = True
                        return {"type": "http.request", "body": bytes(body), "more_body": False}
                    return await receive()

                await self.app(scope, replay, traced_send)
            else:
                await self.app(scope, receive, traced_send)
        except TimeoutError:
            if not response_started:
                await reject("request_timeout", 408)
        except Exception as exc:
            # Never log exception text, SQL parameters, bodies or credentials.
            logger.error(json.dumps({"trace_id": trace_id, "exception_type": type(exc).__name__}))
            if not response_started:
                await reject("internal_error", 500)
        finally:
            route = scope.get("route")
            logger.info(
                json.dumps(
                    {
                        "method": scope["method"],
                        "route": getattr(route, "path", "<unmatched>"),
                        "status": status,
                        "duration_ms": round((perf_counter() - started) * 1000),
                        "trace_id": trace_id,
                    }
                )
            )

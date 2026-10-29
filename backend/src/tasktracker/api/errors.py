from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from tasktracker.application.auth.contracts import AuthError

_AUTH_ERRORS = {
    "invalid_credentials": (401, "Неверный email или пароль."),
    "unauthenticated": (401, "Войдите в аккаунт."),
    "email_unavailable": (409, "Не удалось зарегистрировать этот email."),
    "invalid_password": (422, "Пароль должен содержать от 15 до 128 символов."),
    "csrf_rejected": (403, "Запрос отклонён. Обновите страницу."),
    "rate_limited": (429, "Слишком много попыток. Попробуйте через минуту."),
    "unavailable": (503, "Сервис временно недоступен."),
}


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail
    trace_id: str


def error_response(request: Request, status: int, code: str, message: str) -> JSONResponse:
    headers = {"Cache-Control": "no-store"}
    if status == 401:
        headers["WWW-Authenticate"] = "Bearer"
    if status == 429:
        headers["Retry-After"] = "60"
    return JSONResponse(
        status_code=status,
        headers=headers,
        content={
            "error": {"code": code, "message": message},
            "trace_id": getattr(request.state, "trace_id", ""),
        },
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AuthError)
    async def auth_error(request: Request, exc: AuthError) -> JSONResponse:
        status, message = _AUTH_ERRORS.get(exc.code, (500, "Внутренняя ошибка сервера."))
        return error_response(request, status, exc.code, message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Do not serialize validation inputs, which can contain passwords.
        return error_response(request, 422, "validation_error", "Проверьте email и пароль.")

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return error_response(
            request, exc.status_code, "http_error", "Запрос не может быть выполнен."
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        return error_response(request, 500, "internal_error", "Внутренняя ошибка сервера.")

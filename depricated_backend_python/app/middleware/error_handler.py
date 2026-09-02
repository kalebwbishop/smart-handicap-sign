from fastapi import Request
from fastapi.responses import JSONResponse
from app.utils.logger import logger


class AppError(Exception):
    """Application-level error with an HTTP status code."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.error(
        "Error: %s | %s %s | status=%d",
        exc.message,
        request.method,
        request.url.path,
        exc.status_code,
    )
    body: dict = {"error": {"message": exc.message}}
    return JSONResponse(status_code=exc.status_code, content=body)


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled error: %s | %s %s",
        str(exc),
        request.method,
        request.url.path,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"error": {"message": "Internal Server Error"}},
    )

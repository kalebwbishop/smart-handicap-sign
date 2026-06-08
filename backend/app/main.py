import os
import asyncio
import ssl
import time
from contextlib import asynccontextmanager, suppress
from pathlib import Path

if os.environ.get("ENVIRONMENT") != "cloud":
    ssl._create_default_https_context = ssl._create_unverified_context
    import httpx

    _original_client_init = httpx.Client.__init__
    _original_async_client_init = httpx.AsyncClient.__init__

    def _patched_client_init(self, *args, **kwargs):
        kwargs.setdefault("verify", False)
        _original_client_init(self, *args, **kwargs)

    def _patched_async_client_init(self, *args, **kwargs):
        kwargs.setdefault("verify", False)
        _original_async_client_init(self, *args, **kwargs)

    httpx.Client.__init__ = _patched_client_init
    httpx.AsyncClient.__init__ = _patched_async_client_init

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config.auth import build_auth_router
from app.config.database import close_pool, get_pool
from app.config.settings import get_settings
from app.middleware.error_handler import AppError, app_error_handler, generic_error_handler
from app.routes.devices import router as devices_router
from app.routes.inference import router as inference_router
from app.routes.mobile_updates import router as mobile_updates_router
from app.routes.notifications import router as notifications_router
from app.routes.push_tokens import router as push_tokens_router
from app.services.connectivity_service import run_connectivity_sweep_loop
from app.services.iothub_consumer import run_iothub_telemetry_consumer
from app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("🚀 Server starting on port %s", settings.port)
    logger.info("📝 Environment: %s", settings.environment)
    await get_pool()
    sweep_stop_event = None
    sweep_task = None
    iothub_stop_event = None
    iothub_task = None
    if os.environ.get("PYTEST_CURRENT_TEST") is None:
        sweep_stop_event = asyncio.Event()
        sweep_task = asyncio.create_task(run_connectivity_sweep_loop(sweep_stop_event))
        logger.info("Started connectivity sweep loop")
        if settings.iothub_host_name.strip() and settings.iothub_eventhub_name.strip():
            iothub_stop_event = asyncio.Event()
            iothub_task = asyncio.create_task(run_iothub_telemetry_consumer(iothub_stop_event))
            logger.info("Started IoT Hub telemetry consumer loop")
        else:
            logger.info("IoT Hub telemetry consumer not started; hub name or event hub name not configured")
    yield
    if sweep_task is not None and sweep_stop_event is not None:
        sweep_stop_event.set()
        sweep_task.cancel()
        with suppress(asyncio.CancelledError):
            await sweep_task
    if iothub_task is not None and iothub_stop_event is not None:
        iothub_stop_event.set()
        iothub_task.cancel()
        with suppress(asyncio.CancelledError):
            await iothub_task
    await close_pool()
    logger.info("Server shut down")


settings = get_settings()

app = FastAPI(
    title="Hazard Hero API",
    version="2.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, generic_error_handler)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    logger.info(
        "%s %s — %d (%.0fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health")
async def health():
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        return {
            "status": "healthy",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "database": "connected",
        }
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "error": "Database connection failed",
            },
        )


@app.get("/api/v1/status")
async def status():
    return {
        "message": "Hazard Hero API is running",
        "version": "2.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@app.get("/mock-device", include_in_schema=False)
async def mock_device_page():
    return FileResponse(STATIC_DIR / "mock-device.html")


API_PREFIX = "/api/v1"
auth_router = build_auth_router()
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(inference_router, prefix=API_PREFIX)
app.include_router(devices_router, prefix=API_PREFIX)
app.include_router(mobile_updates_router, prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
app.include_router(push_tokens_router, prefix=API_PREFIX)


@app.exception_handler(404)
async def not_found(request: Request, _exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": f"Route {request.method} {request.url.path} not found",
        },
    )

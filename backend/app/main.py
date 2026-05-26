import os
import ssl
import time
from contextlib import asynccontextmanager
from pathlib import Path

# Bypass SSL verification for corporate proxy environments
if os.environ.get("ENVIRONMENT") != "cloud":
    ssl._create_default_https_context = ssl._create_unverified_context
    # Also patch httpx to skip SSL verification
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

from app.config.database import close_pool, get_pool
from app.config.settings import get_settings
from app.middleware.error_handler import (
    AppError,
    app_error_handler,
    generic_error_handler,
)
from app.config.auth import build_auth_router
from app.routes.notifications import router as notifications_router
from app.routes.organizations import router as organizations_router
from app.routes.inference import router as inference_router
from app.routes.devices import router as devices_router
from app.routes.device_claims import router as device_claims_router
from app.routes.sites import router as sites_router
from app.routes.parking_spaces import router as parking_spaces_router
from app.routes.push_tokens import router as push_tokens_router
from app.utils.logger import logger


# ── lifespan ─────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    settings = get_settings()
    logger.info("🚀 Server starting on port %s", settings.port)
    logger.info("📝 Environment: %s", settings.environment)

    # Eagerly create the DB pool so we fail fast if the DB is unreachable
    await get_pool()

    yield

    # Shutdown
    await close_pool()
    logger.info("Server shut down")


# ── app factory ──────────────────────────────────────────────────────

settings = get_settings()

app = FastAPI(
    title="Hazard Hero API",
    version="2.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, generic_error_handler)


# ── request logging ──────────────────────────────────────────────────


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


# ── health check ─────────────────────────────────────────────────────


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


# ── status ───────────────────────────────────────────────────────────


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


# ── routes ───────────────────────────────────────────────────────────

API_PREFIX = "/api/v1"
auth_router = build_auth_router()
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
app.include_router(organizations_router, prefix=API_PREFIX)
app.include_router(inference_router, prefix=API_PREFIX)
app.include_router(devices_router, prefix=API_PREFIX)
app.include_router(device_claims_router, prefix=API_PREFIX)
app.include_router(sites_router, prefix=API_PREFIX)
app.include_router(parking_spaces_router, prefix=API_PREFIX)
app.include_router(push_tokens_router, prefix=API_PREFIX)


# ── 404 catch-all ────────────────────────────────────────────────────
# FastAPI already returns a 404 for unmatched routes, but we customise
# the body to match the original Node API shape.


@app.exception_handler(404)
async def not_found(request: Request, _exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": f"Route {request.method} {request.url.path} not found",
        },
    )

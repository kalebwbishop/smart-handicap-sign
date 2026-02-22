import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.database import close_pool, get_pool
from app.config.settings import get_settings
from app.middleware.error_handler import AppError, app_error_handler, generic_error_handler
from app.routes.auth import router as auth_router
from app.routes.events import router as events_router
from app.routes.notifications import router as notifications_router
from app.routes.signs import router as signs_router
# from app.routes.inference import router as inference_router
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
    title="Social Media API",
    version="2.0.0",
    lifespan=lifespan,
)

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
    logger.info("%s %s — %d (%.0fms)", request.method, request.url.path, response.status_code, duration_ms)
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
        "message": "Social Media API is running",
        "version": "2.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ── routes ───────────────────────────────────────────────────────────

app.include_router(auth_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(signs_router, prefix="/api/v1")
# app.include_router(inference_router, prefix="/api/v1")


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

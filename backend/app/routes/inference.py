import base64
import io
import time
from collections import deque
from functools import lru_cache
from typing import List, Optional

import matplotlib

matplotlib.use("Agg")  # headless backend – no GUI needed
import matplotlib.pyplot as plt
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.ai.infer import WaveClassifier
from app.middleware.auth import CurrentUser, get_current_user, optional_auth
from app.middleware.device_auth import AuthenticatedDevice, get_authenticated_device
from app.services import device_service
from app.utils.logger import logger

router = APIRouter(prefix="/inference", tags=["inference"])

# Server-side classification threshold — not user-controllable
WAVE_THRESHOLD = 0.5

# ── In-memory ring buffer for recent inference data (debugging) ──────
MAX_HISTORY = 50
_inference_history: deque = deque(maxlen=MAX_HISTORY)


# ── request / response models ────────────────────────────────────────


class ClassifyRequest(BaseModel):
    serial_number: Optional[str] = Field(
        default=None,
        min_length=1,
        description="The serial number of the device submitting the signal",
    )
    samples: List[int] = Field(
        ...,
        min_length=512,
        max_length=512,
        description="Exactly 512 integers in the range 0-4095 (ESP32 12-bit ADC)",
    )


class ClassifyResponse(BaseModel):
    label: str
    confidence: float
    debug_graph: Optional[str] = Field(
        default=None,
        description="Base64-encoded PNG plot of the input samples (only in debug)",
    )


# ── lazy-loaded model singleton ──────────────────────────────────────


@lru_cache(maxsize=1)
def _get_classifier() -> WaveClassifier:
    logger.info("Loading wave-detection model …")
    clf = WaveClassifier()
    logger.info("Wave-detection model loaded successfully")
    return clf


# ── POST /inference/classify ─────────────────────────────────────────


@router.post("/classify", response_model=ClassifyResponse)
async def classify(
    payload: ClassifyRequest,
    device: AuthenticatedDevice = Depends(get_authenticated_device),
    debug: bool = Query(False, description="Include a base64-encoded debug graph of the input signal"),
):
    """Classify a 512-int signal as **wave** or **non-wave**.

    Requires device authentication via ``Authorization: Bearer <serial>:<token>``.
    The device can only submit telemetry for its own serial number.
    """
    # Enforce device can only submit for its own serial
    if payload.serial_number and payload.serial_number != device.serial_number:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=403,
            content={"error": "Device can only submit telemetry for its own serial number"},
        )
    # Default to authenticated device's serial if not provided
    if not payload.serial_number:
        payload.serial_number = device.serial_number

    clf = _get_classifier()

    try:
        debug_graph_b64 = None
        if debug:
            fig, ax = plt.subplots(figsize=(10, 3))
            ax.plot(payload.samples, linewidth=0.8)
            ax.set_title("Input Samples (512-point signal)")
            ax.set_xlabel("Sample index")
            ax.set_ylabel("Value")
            ax.set_xlim(0, len(payload.samples) - 1)
            fig.tight_layout()

            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=100)
            plt.close(fig)
            buf.seek(0)
            debug_graph_b64 = base64.b64encode(buf.read()).decode()
            logger.debug("Debug graph generated for %d samples", len(payload.samples))

        result = clf.classify(payload.samples, threshold=WAVE_THRESHOLD)
    except ValueError as exc:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=422,
            content={"error": "Validation Error", "message": str(exc)},
        )

    logger.info(
        "Inference — device=%s label=%s confidence=%.4f",
        device.serial_number,
        result["label"],
        result["confidence"],
    )

    # ── positive classification → update device & notify ────────────────
    if result["label"] == "wave" and payload.serial_number:
        try:
            from app.config.database import get_pool as _get_pool
            pool = await _get_pool()
            await pool.execute(
                """UPDATE devices SET operational_status = 'assistance_requested', updated_at = NOW()
                   WHERE serial_number = $1""",
                payload.serial_number,
            )

            await device_service.create_device_event(
                serial_number=payload.serial_number,
                event_type="assistance_requested",
                payload={
                    "previous_status": "available",
                    "new_status": "assistance_requested",
                    "confidence": result["confidence"],
                },
                notify_org=True,
                notification_title="Assistance Requested",
                notification_body=(
                    f"Device {payload.serial_number} detected a wave gesture "
                    f"(confidence {result['confidence']:.2%}). "
                    "Assistance has been requested."
                ),
            )
            logger.info("Device %s set to assistance_requested", payload.serial_number)
        except Exception:
            logger.exception(
                "Failed to update device/notification for %s", payload.serial_number
            )
    # ──────────────────────────────────────────────────────────────────

    # ── Store in history ring buffer for debugging ──────────────────────
    _inference_history.append({
        "timestamp": time.time(),
        "serial_number": payload.serial_number,
        "samples": payload.samples,
        "label": result["label"],
        "confidence": result["confidence"],
    })

    result["debug_graph"] = debug_graph_b64
    return result


# ── GET /inference/history ───────────────────────────────────────────


class InferenceHistoryEntry(BaseModel):
    timestamp: float
    serial_number: Optional[str] = None
    label: str
    confidence: float
    samples: List[int]


@router.get("/history", response_model=List[InferenceHistoryEntry])
async def get_inference_history(
    current_user: CurrentUser = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=MAX_HISTORY, description="Number of recent entries to return"),
    serial_number: Optional[str] = Query(None, description="Filter by device serial number"),
):
    """Return recent inference data for debugging. Requires user auth."""
    entries = list(_inference_history)
    if serial_number:
        entries = [e for e in entries if e.get("serial_number") == serial_number]
    # Return most recent first
    entries = entries[-limit:]
    entries.reverse()
    return entries


# ── GET /inference/latest-graph ──────────────────────────────────────


@router.get("/latest-graph")
async def get_latest_graph(
    current_user: CurrentUser = Depends(get_current_user),
    serial_number: Optional[str] = Query(None, description="Filter by device serial number"),
):
    """Return a PNG graph of the most recent inference samples. Requires user auth."""
    from fastapi.responses import Response

    entries = list(_inference_history)
    if serial_number:
        entries = [e for e in entries if e.get("serial_number") == serial_number]

    if not entries:
        return Response(content=b"", status_code=204)

    latest = entries[-1]
    samples = latest["samples"]
    label = latest["label"]
    confidence = latest["confidence"]

    fig, ax = plt.subplots(figsize=(12, 4))
    ax.plot(samples, linewidth=0.8, color="#2563EB")
    ax.fill_between(range(len(samples)), samples, alpha=0.1, color="#2563EB")
    ax.set_title(
        f"Latest Inference — {label.upper()} ({confidence:.1%}) | {latest.get('serial_number', 'unknown')}",
        fontweight="bold",
    )
    ax.set_xlabel("Sample Index")
    ax.set_ylabel("ADC Value (0–4095)")
    ax.set_xlim(0, len(samples) - 1)
    ax.set_ylim(0, 4095)
    ax.axhline(y=2048, color="#94a3b8", linestyle="--", linewidth=0.5, label="Midpoint")
    color = "#22c55e" if label == "wave" else "#6b7280"
    ax.text(
        0.98, 0.95, f"{label.upper()} {confidence:.1%}",
        transform=ax.transAxes, ha="right", va="top",
        fontsize=14, fontweight="bold", color=color,
        bbox=dict(boxstyle="round,pad=0.3", facecolor=color, alpha=0.15),
    )
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100)
    plt.close(fig)
    buf.seek(0)

    return Response(content=buf.read(), media_type="image/png")

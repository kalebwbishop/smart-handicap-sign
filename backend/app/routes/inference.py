import base64
import io
from functools import lru_cache
from typing import List, Optional

import matplotlib

matplotlib.use("Agg")  # headless backend – no GUI needed
import matplotlib.pyplot as plt
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.ai.infer import WaveClassifier
from app.middleware.auth import CurrentUser, get_current_user, optional_auth
from app.services import event_service, sign_service
from app.utils.logger import logger

router = APIRouter(prefix="/inference", tags=["inference"])

# Server-side classification threshold — not user-controllable
WAVE_THRESHOLD = 0.5


# ── request / response models ────────────────────────────────────────


class ClassifyRequest(BaseModel):
    sign_id: str = Field(
        ...,
        min_length=1,
        description="The ID of the sign submitting the signal",
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
    current_user: CurrentUser = Depends(optional_auth),
    debug: bool = Query(False, description="Include a base64-encoded debug graph of the input signal"),
):
    """Classify a 512-int signal as **wave** or **non-wave**."""
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
        "Inference — user=%s sign=%s label=%s confidence=%.4f",
        current_user.id if current_user else "anonymous",
        payload.sign_id,
        result["label"],
        result["confidence"],
    )

    # ── positive classification → update sign & notify ────────────────
    if result["label"] == "wave":
        try:
            await sign_service.update_sign(
                payload.sign_id, status="assistance_requested"
            )
            await event_service.create_event(
                sign_id=payload.sign_id,
                event_type="status_change",
                data={
                    "previous_status": "available",
                    "new_status": "assistance_requested",
                    "confidence": result["confidence"],
                },
                create_notification=True,
                notify_org=True,
                notification_title="Assistance Requested",
                notification_body=(
                    f"Sign {payload.sign_id} detected a wave gesture "
                    f"(confidence {result['confidence']:.2%}). "
                    "Assistance has been requested."
                ),
            )
            logger.info("Sign %s set to assistance_requested", payload.sign_id)
        except Exception:
            logger.exception(
                "Failed to update sign/notification for %s", payload.sign_id
            )
    # ──────────────────────────────────────────────────────────────────

    result["debug_graph"] = debug_graph_b64
    return result

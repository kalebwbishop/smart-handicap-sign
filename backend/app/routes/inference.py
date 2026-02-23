import base64
import io
from functools import lru_cache
from typing import List, Optional

import matplotlib

matplotlib.use("Agg")  # headless backend – no GUI needed
import matplotlib.pyplot as plt
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.ai.infer import WaveClassifier
from app.middleware.auth import CurrentUser, get_current_user, optional_auth
from app.utils.logger import logger

router = APIRouter(prefix="/inference", tags=["inference"])


# ── request / response models ────────────────────────────────────────


class ClassifyRequest(BaseModel):
    samples: List[int] = Field(
        ...,
        min_length=512,
        max_length=512,
        description="Exactly 512 integers in the range 0-65535",
    )
    threshold: Optional[float] = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Decision boundary (default 0.5)",
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
):
    """Classify a 512-int signal as **wave** or **non-wave**."""
    clf = _get_classifier()

    try:
        # ── debug graph of input samples ──────────────────────────────
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
        # ──────────────────────────────────────────────────────────────

        result = clf.classify(payload.samples, threshold=payload.threshold)
    except ValueError as exc:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=422,
            content={"error": "Validation Error", "message": str(exc)},
        )

    logger.info(
        "Inference — user=%s label=%s confidence=%.4f",
        current_user.id if current_user else "anonymous",
        result["label"],
        result["confidence"],
    )
    result["debug_graph"] = debug_graph_b64
    return result

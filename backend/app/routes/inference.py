from functools import lru_cache
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.ai.infer import WaveClassifier
from app.middleware.auth import CurrentUser, get_current_user, optional_auth
from app.utils.logger import logger

router = APIRouter(prefix="/inference", tags=["inference"])


# ── request / response models ────────────────────────────────────────


class ClassifyRequest(BaseModel):
    signal: List[int] = Field(
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
        result = clf.classify(payload.signal, threshold=payload.threshold)
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
    return result

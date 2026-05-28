from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.ai.config import INFERENCE_CONFIG, SIGNAL_CONFIG
from app.ai.debug_plot import render_signal_debug_plot
from app.ai.infer import WaveClassifier
from app.config.settings import get_settings
from app.middleware.device_auth import AuthenticatedDevice, get_authenticated_device
from app.services import device_service
from app.utils.logger import logger

router = APIRouter(prefix="/inference", tags=["inference"])

WAVE_THRESHOLD = INFERENCE_CONFIG["threshold"]
SAMPLE_COUNT = SIGNAL_CONFIG["sample_count"]
MAX_ADC_VALUE = SIGNAL_CONFIG["max_value"]


class ClassifyRequest(BaseModel):
    serial_number: Optional[str] = Field(
        default=None,
        min_length=1,
        description="The serial number of the device submitting the signal",
    )
    samples: List[int] = Field(
        ...,
        min_length=SAMPLE_COUNT,
        max_length=SAMPLE_COUNT,
        description=f"Exactly {SAMPLE_COUNT} integers in the range 0-{MAX_ADC_VALUE} (ESP32 12-bit ADC)",
    )


class ClassifyResponse(BaseModel):
    label: str
    confidence: float


@lru_cache(maxsize=1)
def _get_classifier() -> WaveClassifier:
    logger.info("Loading wave-detection model …")
    clf = WaveClassifier()
    logger.info("Wave-detection model loaded successfully")
    return clf


@router.post("/classify", response_model=ClassifyResponse)
async def classify(
    payload: ClassifyRequest,
    device: AuthenticatedDevice = Depends(get_authenticated_device),
):
    await device_service.update_device_last_seen(device.serial_number)

    if payload.serial_number and payload.serial_number != device.serial_number:
        return JSONResponse(
            status_code=403,
            content={"error": "Device can only submit telemetry for its own serial number"},
        )
    if not payload.serial_number:
        payload.serial_number = device.serial_number

    clf = _get_classifier()

    try:
        result = clf.classify(payload.samples, threshold=WAVE_THRESHOLD)
    except ValueError as exc:
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

    settings = get_settings()
    if settings.inference_debug_plot_enabled:
        render_signal_debug_plot(
            payload.samples,
            serial_number=payload.serial_number,
            label=result["label"],
            confidence=result["confidence"],
        )

    if result["label"] == "wave" and payload.serial_number:
        try:
            transition = await device_service.transition_device_status(
                serial_number=payload.serial_number,
                expected_status="available",
                new_status="assistance_requested",
                event_type="assistance_requested",
                payload={"confidence": result["confidence"]},
            )
            if transition.success:
                logger.info("Device %s set to assistance_requested", payload.serial_number)
            elif transition.error_code != "invalid_status_transition":
                logger.warning(
                    "Wave detected for %s but status update failed with %s",
                    payload.serial_number,
                    transition.error_code,
                )
        except Exception:
            logger.exception("Failed to update device state for %s", payload.serial_number)

    return result

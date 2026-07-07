from __future__ import annotations

from datetime import datetime
from typing import Optional
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.services import dev_telemetry_service, telemetry_service
from app.utils.logger import logger

SAMPLE_COUNT = 200
CLASSIFICATION = "negative" # positive | negative | none

router = APIRouter(prefix="/dev/training-captures", tags=["dev-training"])


class TrainingCaptureIn(BaseModel):
    serial_number: Optional[str] = Field(default=None, min_length=1, max_length=30)
    sample_count: int = Field(default=SAMPLE_COUNT, ge=1, le=SAMPLE_COUNT)
    samples: list[int] = Field(
        ...,
        min_length=SAMPLE_COUNT,
        max_length=SAMPLE_COUNT,
        description=f"Exactly {SAMPLE_COUNT} raw ADC samples",
    )
    capture_label: str = Field(default=CLASSIFICATION, min_length=1, max_length=50)
    firmware_version: Optional[str] = Field(default=None, max_length=20)
    sample_interval_ms: int = Field(default=20, ge=1, le=1000)

    @model_validator(mode="after")
    def _validate_sample_count(self):
        if self.sample_count != len(self.samples):
            raise ValueError("sample_count must match the number of samples")
        return self


class TrainingCaptureOut(BaseModel):
    id: str
    serial_number: Optional[str] = None
    capture_label: str = CLASSIFICATION
    firmware_version: Optional[str] = None
    sample_count: int
    sample_interval_ms: int
    created_at: datetime


@router.post("", response_model=TrainingCaptureOut, status_code=202)
async def record_training_capture(payload: TrainingCaptureIn):
    try:
        if CLASSIFICATION not in ["positive", "negative", "none"]:
            raise HTTPException(status_code=400, detail="Invalid classification for development capture")
        
        result = None
        if CLASSIFICATION in ["positive", "negative"]:
            result = await dev_telemetry_service.record_training_capture(
                serial_number=payload.serial_number,
                sample_count=payload.sample_count,
                samples=payload.samples,
                capture_label=CLASSIFICATION,
                firmware_version=payload.firmware_version,
                sample_interval_ms=payload.sample_interval_ms,
            )
        classification = telemetry_service.classify_capture([int(x) for x in payload.samples])
        logger.info("Capture classified as: %s", classification["label"])
        logger.info("Capture classification confidence as: %s", classification["confidence"])
        logger.info("Max sample value: %s", max(payload.samples))
        logger.info("Min sample value: %s", min(payload.samples))
        logger.info("Range: %s", max(payload.samples) - min(payload.samples))
        if CLASSIFICATION == "negative" and classification["label"] == "positive":
            logger.error("Negative capture classified as positive: %s", classification)

        elif CLASSIFICATION == "positive" and classification["label"] == "negative":
            logger.error("Capture classification error: %s", classification)

        if result is None:
            result = {
                "id": "none",
                "serial_number": payload.serial_number,
                "capture_label": CLASSIFICATION,
                "firmware_version": payload.firmware_version,
                "sample_count": payload.sample_count,
                "sample_interval_ms": payload.sample_interval_ms,
                "created_at": datetime.utcnow(),
            }
        return TrainingCaptureOut(**result)
    except Exception as exc:
        logger.error("Failed to record training capture: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

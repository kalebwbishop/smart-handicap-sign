from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.services import dev_telemetry_service
from app.utils.logger import logger

SAMPLE_COUNT = 200

router = APIRouter(prefix="/dev/training-captures", tags=["dev-training"])


class TrainingCaptureIn(BaseModel):
    serial_number: str = Field(..., min_length=1, max_length=30)
    sample_count: int = Field(default=SAMPLE_COUNT, ge=1, le=SAMPLE_COUNT)
    samples: list[int] = Field(
        ...,
        min_length=SAMPLE_COUNT,
        max_length=SAMPLE_COUNT,
        description=f"Exactly {SAMPLE_COUNT} raw ADC samples",
    )
    capture_label: str = Field(default="unlabeled", min_length=1, max_length=50)
    firmware_version: Optional[str] = Field(default=None, max_length=20)
    sample_interval_ms: int = Field(default=20, ge=1, le=1000)

    @model_validator(mode="after")
    def _validate_sample_count(self):
        if self.sample_count != len(self.samples):
            raise ValueError("sample_count must match the number of samples")
        return self


class TrainingCaptureOut(BaseModel):
    id: str
    serial_number: str
    capture_label: str
    firmware_version: Optional[str] = None
    sample_count: int
    sample_interval_ms: int
    created_at: datetime


@router.post("", response_model=TrainingCaptureOut, status_code=202)
async def record_training_capture(payload: TrainingCaptureIn):
    try:
        result = await dev_telemetry_service.record_training_capture(
            serial_number=payload.serial_number,
            sample_count=payload.sample_count,
            samples=payload.samples,
            capture_label=payload.capture_label,
            firmware_version=payload.firmware_version,
            sample_interval_ms=payload.sample_interval_ms,
        )
        return TrainingCaptureOut(**result)
    except Exception as exc:
        logger.error("Failed to record training capture: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

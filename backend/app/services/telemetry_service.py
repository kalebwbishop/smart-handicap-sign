from __future__ import annotations

from functools import lru_cache
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.ai.config import INFERENCE_CONFIG, SIGNAL_CONFIG
from app.ai.debug_plot import render_signal_debug_plot
from app.ai.infer import WaveClassifier
from app.config.settings import get_settings
from app.services import device_service
from app.services.expo_push import send_assistance_request_push_notifications
from app.utils.logger import logger

WAVE_THRESHOLD = INFERENCE_CONFIG["threshold"]
SAMPLE_COUNT = SIGNAL_CONFIG["sample_count"]
MAX_ADC_VALUE = SIGNAL_CONFIG["max_value"]


class DeviceTelemetryIn(BaseModel):
    serial_number: Optional[str] = Field(
        default=None,
        description="Optional device serial number reported by the sign.",
    )
    samples: list[int] = Field(
        ...,
        min_length=SAMPLE_COUNT,
        max_length=SAMPLE_COUNT,
        description=f"Exactly {SAMPLE_COUNT} integers in the range 0-{MAX_ADC_VALUE} (ESP32 12-bit ADC)",
    )


@lru_cache(maxsize=1)
def get_classifier() -> WaveClassifier:
    logger.info("Loading wave-detection model …")
    classifier = WaveClassifier()
    logger.info("Wave-detection model loaded successfully")
    return classifier


async def process_device_signal(serial_number: str, samples: list[int]) -> dict[str, Any]:
    classifier = get_classifier()

    result = classifier.classify(samples, threshold=WAVE_THRESHOLD)

    logger.info(
        "Inference — device=%s label=%s confidence=%.4f",
        serial_number,
        result["label"],
        result["confidence"],
    )

    settings = get_settings()
    if settings.inference_debug_plot_enabled:
        render_signal_debug_plot(
            samples,
            serial_number=serial_number,
            label=result["label"],
            confidence=result["confidence"],
        )

    if result["label"] == "wave":
        try:
            transition = await device_service.transition_device_status(
                serial_number=serial_number,
                expected_status="available",
                new_status="assistance_requested",
                event_type="assistance_requested",
                correct_response=True,
                payload={
                    "confidence": result["confidence"],
                    "raw_samples": samples,
                },
                create_notifications=True,
            )
            if transition.success:
                logger.info("Device %s set to assistance_requested", serial_number)
                created_notifications = getattr(transition, "notifications", None) or []
                if created_notifications:
                    try:
                        await send_assistance_request_push_notifications(created_notifications)
                    except Exception:
                        logger.exception(
                            "Failed to deliver assistance-request push notifications for %s",
                            serial_number,
                        )
            elif transition.error_code != "invalid_status_transition":
                logger.warning(
                    "Wave detected for %s but status update failed with %s",
                    serial_number,
                    transition.error_code,
                )
        except Exception:
            logger.exception("Failed to update device state for %s", serial_number)

    return result

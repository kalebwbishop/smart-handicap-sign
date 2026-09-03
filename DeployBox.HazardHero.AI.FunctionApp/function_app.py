from __future__ import annotations

import json
import logging
from datetime import datetime
from functools import lru_cache
from typing import Any
from uuid import UUID

import azure.functions as func
from ai.infer import MAX_VAL, SEQ_LEN, WaveClassifier

app = func.FunctionApp()
logger = logging.getLogger(__name__)

REQUEST_QUEUE = "sbq-signal-classification-requests"
RESULT_QUEUE = "sbq-signal-classification-results"
SERVICE_BUS_CONNECTION = "ServiceBusConnection"
INFERENCE_THRESHOLD = 0.5


def _value(body: dict[str, Any], name: str) -> Any:
    if name in body:
        return body[name]
    return body.get(name[0].lower() + name[1:])


def _parse_request(body: Any) -> tuple[str, str, str, str, list[int]]:
    if not isinstance(body, dict):
        raise ValueError("Message body must be a JSON object.")

    schema_version = _value(body, "SchemaVersion")
    message_id = _value(body, "MessageId")
    occurred_at = _value(body, "OccurredAt")
    device_id = _value(body, "DeviceId")
    samples = _value(body, "Samples")

    if not all(
        isinstance(value, str) and value.strip()
        for value in (schema_version, message_id, occurred_at, device_id)
    ):
        raise ValueError(
            "SchemaVersion, MessageId, OccurredAt, and DeviceId are required strings."
        )

    try:
        UUID(message_id)
    except ValueError as exc:
        raise ValueError("MessageId must be a valid UUID.") from exc

    try:
        timestamp = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("OccurredAt must be an ISO-8601 timestamp.") from exc
    if timestamp.utcoffset() is None or timestamp.utcoffset().total_seconds() != 0:
        raise ValueError("OccurredAt must be a UTC timestamp.")

    if (
        not isinstance(samples, list)
        or len(samples) != SEQ_LEN
        or any(isinstance(sample, bool) or not isinstance(sample, int) for sample in samples)
        or any(sample < 0 or sample > MAX_VAL for sample in samples)
    ):
        raise ValueError(
            f"Samples must contain exactly {SEQ_LEN} integers in the range 0-{MAX_VAL}."
        )

    return schema_version, message_id, occurred_at, device_id, samples


@lru_cache(maxsize=1)
def get_classifier() -> WaveClassifier:
    logger.info("Loading wave-detection model")
    return WaveClassifier()


def build_classification_result(
    body: Any,
    classifier: WaveClassifier | None = None,
) -> dict[str, Any]:
    schema_version, message_id, occurred_at, device_id, samples = _parse_request(body)
    classification = (classifier or get_classifier()).classify(
        samples,
        threshold=INFERENCE_THRESHOLD,
    )

    label = classification.get("label")
    if label not in ("wave", "non-wave"):
        raise ValueError("Classifier returned an unsupported label.")

    confidence = float(classification["confidence"])
    if not 0 <= confidence <= 1:
        raise ValueError("Classifier returned confidence outside the range 0-1.")

    return {
        "SchemaVersion": schema_version,
        "MessageId": message_id,
        "OccurredAt": occurred_at,
        "DeviceId": device_id,
        "Classification": {
            "Label": "positive" if label == "wave" else "negative",
            "Confidence": round(confidence, 4),
        },
    }


@app.service_bus_queue_trigger(
    arg_name="message",
    queue_name=REQUEST_QUEUE,
    connection=SERVICE_BUS_CONNECTION,
)
@app.service_bus_queue_output(
    arg_name="result",
    queue_name=RESULT_QUEUE,
    connection=SERVICE_BUS_CONNECTION,
)
def process_signal_classification_request(
    message: func.ServiceBusMessage,
    result: func.Out[str],
) -> None:
    body = json.loads(message.get_body().decode("utf-8"))
    classification_result = build_classification_result(body)
    result.set(json.dumps(classification_result, separators=(",", ":")))
    logger.info(
        "Classified signal message %s for device %s",
        classification_result["MessageId"],
        classification_result["DeviceId"],
    )

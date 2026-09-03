from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from function_app import build_classification_result


def _request() -> dict:
    return {
        "SchemaVersion": "1.0",
        "MessageId": str(uuid4()),
        "OccurredAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "DeviceId": "hazard-hero-001",
        "Samples": [100] * 200,
    }


def test_build_classification_result_preserves_request_metadata():
    request = _request()

    result = build_classification_result(
        request,
        classifier=type("Classifier", (), {
            "classify": lambda self, samples, threshold: {
                "label": "wave",
                "confidence": 0.87654,
            }
        })(),
    )

    assert result["SchemaVersion"] == "1.0"
    assert result["MessageId"] == request["MessageId"]
    assert result["OccurredAt"] == request["OccurredAt"]
    assert result["DeviceId"] == "hazard-hero-001"
    assert result["Classification"] == {"Label": "positive", "Confidence": 0.8765}


@pytest.mark.parametrize(
    "change",
    [
        lambda request: request.update({"Samples": [100] * 199}),
        lambda request: request.update({"MessageId": "not-a-uuid"}),
        lambda request: request.update({"OccurredAt": "2026-09-03T14:00:00-04:00"}),
    ],
)
def test_build_classification_result_rejects_invalid_requests(change):
    request = _request()
    change(request)

    with pytest.raises(ValueError):
        build_classification_result(
            request,
            classifier=type("Classifier", (), {"classify": lambda *_args, **_kwargs: {}})(),
        )

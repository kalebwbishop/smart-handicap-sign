from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch


class TestDevTrainingCaptureRoute:
    @patch("app.routes.dev_telemetry.dev_telemetry_service.record_training_capture", new_callable=AsyncMock)
    def test_record_training_capture_is_public_and_returns_accepted(self, mock_record, client_anon):
        mock_record.return_value = {
            "id": "capture-1",
            "serial_number": "DEV-LOGGER-01",
            "capture_label": "unlabeled",
            "firmware_version": "1.2.3",
            "sample_count": 200,
            "sample_interval_ms": 20,
            "created_at": datetime.now(timezone.utc),
        }

        response = client_anon.post(
            "/api/v1/dev/training-captures",
            json={
                "serial_number": "DEV-LOGGER-01",
                "sample_count": 200,
                "capture_label": "unlabeled",
                "firmware_version": "1.2.3",
                "sample_interval_ms": 20,
                "samples": [0] * 200,
            },
        )

        assert response.status_code == 202
        assert response.json()["serial_number"] == "DEV-LOGGER-01"
        assert response.json()["sample_count"] == 200
        mock_record.assert_awaited_once_with(
            serial_number="DEV-LOGGER-01",
            sample_count=200,
            samples=[0] * 200,
            capture_label="unlabeled",
            firmware_version="1.2.3",
            sample_interval_ms=20,
        )

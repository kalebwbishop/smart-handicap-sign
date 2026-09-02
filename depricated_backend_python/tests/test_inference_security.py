"""Tests for inference endpoint security hardening in the pilot backend."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.middleware.device_auth import AuthenticatedDevice, get_authenticated_device
from app.services.telemetry_service import SAMPLE_COUNT, WAVE_THRESHOLD


FAKE_DEVICE = AuthenticatedDevice(
    id="device-001",
    serial_number="SHS-2605-S01-A7K-00001-J",
)


def _override_device_auth():
    async def _fake():
        return FAKE_DEVICE
    return _fake


def _transition_result(success: bool, error_code: str | None = None, **kwargs):
    attrs = {"success": success, "error_code": error_code}
    attrs.update(kwargs)
    return type("TransitionResult", (), attrs)()


class TestThresholdHardening:
    def test_threshold_is_constant(self):
        assert WAVE_THRESHOLD == 0.5


class TestClassifyEndpoint:
    def _client(self, app):
        app.dependency_overrides[get_authenticated_device] = _override_device_auth()
        from fastapi.testclient import TestClient
        client = TestClient(app, raise_server_exceptions=False)
        return client

    @patch("app.routes.inference.device_service.update_device_last_seen", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.device_service.transition_device_status", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.get_classifier")
    def test_classify_uses_server_threshold(self, mock_clf, mock_transition, mock_last_seen, app):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.3}
        mock_clf.return_value = fake_clf
        mock_transition.return_value = _transition_result(False, "invalid_status_transition")

        with self._client(app) as client:
            response = client.post("/api/v1/inference/classify", json={
                "serial_number": FAKE_DEVICE.serial_number,
                "samples": [100] * SAMPLE_COUNT,
            })

        assert response.status_code == 200
        _, kwargs = fake_clf.classify.call_args
        assert kwargs["threshold"] == WAVE_THRESHOLD
        mock_last_seen.assert_awaited_once_with(FAKE_DEVICE.serial_number)

    @patch("app.services.telemetry_service.render_signal_debug_plot")
    @patch("app.services.telemetry_service.get_settings")
    @patch("app.services.telemetry_service.device_service.transition_device_status", new_callable=AsyncMock)
    @patch("app.routes.inference.device_service.update_device_last_seen", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.get_classifier")
    def test_classify_plots_signal_when_debug_mode_enabled(
        self,
        mock_clf,
        mock_last_seen,
        mock_transition,
        mock_get_settings,
        mock_plot,
        app,
    ):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.3}
        mock_clf.return_value = fake_clf
        mock_transition.return_value = _transition_result(False, "invalid_status_transition")
        mock_get_settings.return_value = MagicMock(inference_debug_plot_enabled=True)

        with self._client(app) as client:
            response = client.post("/api/v1/inference/classify", json={
                "serial_number": FAKE_DEVICE.serial_number,
                "samples": [100] * SAMPLE_COUNT,
            })

        assert response.status_code == 200
        mock_plot.assert_called_once_with(
            [100] * SAMPLE_COUNT,
            serial_number=FAKE_DEVICE.serial_number,
            label="non-wave",
            confidence=0.3,
        )

    @patch("app.services.telemetry_service.render_signal_debug_plot")
    @patch("app.services.telemetry_service.get_settings")
    @patch("app.services.telemetry_service.device_service.transition_device_status", new_callable=AsyncMock)
    @patch("app.routes.inference.device_service.update_device_last_seen", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.get_classifier")
    def test_classify_skips_signal_plot_when_debug_mode_disabled(
        self,
        mock_clf,
        mock_last_seen,
        mock_transition,
        mock_get_settings,
        mock_plot,
        app,
    ):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.3}
        mock_clf.return_value = fake_clf
        mock_transition.return_value = _transition_result(False, "invalid_status_transition")
        mock_get_settings.return_value = MagicMock(inference_debug_plot_enabled=False)

        with self._client(app) as client:
            response = client.post("/api/v1/inference/classify", json={
                "serial_number": FAKE_DEVICE.serial_number,
                "samples": [100] * SAMPLE_COUNT,
            })

        assert response.status_code == 200
        mock_plot.assert_not_called()

    def test_classify_rejects_unauthenticated(self, client_anon):
        response = client_anon.post("/api/v1/inference/classify", json={
            "serial_number": "SHS-TEST",
            "samples": [100] * SAMPLE_COUNT,
        })
        assert response.status_code == 401

    @patch("app.services.telemetry_service.get_classifier")
    def test_classify_rejects_wrong_serial(self, mock_clf, app):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.3}
        mock_clf.return_value = fake_clf

        with self._client(app) as client:
            response = client.post("/api/v1/inference/classify", json={
                "serial_number": "SHS-OTHER-SERIAL",
                "samples": [100] * SAMPLE_COUNT,
            })

        assert response.status_code == 403

    @patch("app.services.telemetry_service.send_assistance_request_push_notifications", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.device_service.transition_device_status", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.get_classifier")
    def test_wave_updates_available_device(self, mock_clf, mock_transition, mock_push, app):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "wave", "confidence": 0.91}
        mock_clf.return_value = fake_clf
        mock_transition.return_value = _transition_result(
            True,
            notifications=[{"id": "notif-1"}],
        )

        with self._client(app) as client:
            response = client.post("/api/v1/inference/classify", json={
                "serial_number": FAKE_DEVICE.serial_number,
                "samples": [100] * SAMPLE_COUNT,
            })

        assert response.status_code == 200
        mock_transition.assert_awaited_once()
        assert mock_transition.await_args.kwargs["create_notifications"] is True
        mock_push.assert_awaited_once_with([{"id": "notif-1"}])

    @patch("app.services.telemetry_service.send_assistance_request_push_notifications", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.device_service.transition_device_status", new_callable=AsyncMock)
    @patch("app.services.telemetry_service.get_classifier")
    def test_wave_does_not_error_when_request_already_active(self, mock_clf, mock_transition, mock_push, app):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "wave", "confidence": 0.88}
        mock_clf.return_value = fake_clf
        mock_transition.return_value = _transition_result(False, "invalid_status_transition")

        with self._client(app) as client:
            response = client.post("/api/v1/inference/classify", json={
                "serial_number": FAKE_DEVICE.serial_number,
                "samples": [100] * SAMPLE_COUNT,
            })

        assert response.status_code == 200
        mock_push.assert_not_called()

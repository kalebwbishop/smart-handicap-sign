"""Route-level tests for the single-sign pilot device endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.services.device_service import _normalize_event_payload

def _device(status: str = "available") -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": "device-1",
        "serial_number": "SHS-2605-S01-A7K-00001-J",
        "model_code": "S01",
        "hardware_revision": "rev3",
        "firmware_version": "1.2.0",
        "lifecycle_status": "active",
        "connectivity_status": "online",
        "operational_status": status,
        "name": "Pilot Handicap Sign",
        "last_seen_at": now,
        "created_at": now,
        "updated_at": now,
    }


def _event(correct_response: bool | None = True) -> dict:
    return {
        "id": "evt-1",
        "device_id": "device-1",
        "event_type": "assistance_requested",
        "payload": {"confidence": 0.97},
        "correct_response": correct_response,
        "created_at": datetime.now(timezone.utc),
    }


class TestListDevices:
    @patch("app.routes.devices.device_service.list_devices", new_callable=AsyncMock)
    def test_list_requires_auth_and_returns_devices(self, mock_list, client_alice):
        mock_list.return_value = [_device()]

        response = client_alice.get("/api/v1/devices")

        assert response.status_code == 200
        assert response.json()[0]["serial_number"] == "SHS-2605-S01-A7K-00001-J"
        assert response.json()[0]["connectivity_status"] == "online"
        assert response.json()[0]["last_seen_at"] is not None


class TestDeviceStatus:
    @patch("app.routes.devices.device_service.update_device_last_seen", new_callable=AsyncMock)
    def test_status_is_public(self, mock_last_seen, client_anon):
        mock_last_seen.return_value = _device("available")

        response = client_anon.get("/api/v1/devices/SHS-2605-S01-A7K-00001-J/status")

        assert response.status_code == 200
        assert response.json()["status"] == "available"
        assert response.json()["connectivity_status"] == "online"
        mock_last_seen.assert_awaited_once_with("SHS-2605-S01-A7K-00001-J")

    @patch("app.routes.devices.device_service.update_device_last_seen", new_callable=AsyncMock)
    def test_status_404_when_device_missing(self, mock_last_seen, client_anon):
        mock_last_seen.return_value = None

        response = client_anon.get("/api/v1/devices/missing/status")

        assert response.status_code == 404


class TestDeviceTwinRoutes:
    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_twin_service.get_device_twin_state", new_callable=AsyncMock)
    def test_get_device_twin_returns_desired_and_reported(self, mock_get_twin, mock_get_device, client_alice):
        mock_get_device.return_value = _device()
        mock_get_twin.return_value = {
            "serial_number": "SHS-2605-S01-A7K-00001-J",
            "desired_properties": {"operational_status": "assistance_requested"},
            "reported_properties": {"operational_status": "available"},
            "etag": "\"abc\"",
        }

        response = client_alice.get("/api/v1/devices/SHS-2605-S01-A7K-00001-J/twin")

        assert response.status_code == 200
        assert response.json()["desired_properties"]["operational_status"] == "assistance_requested"
        assert response.json()["reported_properties"]["operational_status"] == "available"
        mock_get_twin.assert_awaited_once_with("SHS-2605-S01-A7K-00001-J")

    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_twin_service.update_device_desired_properties", new_callable=AsyncMock)
    def test_update_device_twin_desired_properties(self, mock_update_twin, mock_get_device, client_alice):
        mock_get_device.return_value = _device()
        mock_update_twin.return_value = {
            "serial_number": "SHS-2605-S01-A7K-00001-J",
            "desired_properties": {"operational_status": "assistance_in_progress"},
            "reported_properties": {"operational_status": "available"},
            "etag": "\"abc\"",
        }

        response = client_alice.patch(
            "/api/v1/devices/SHS-2605-S01-A7K-00001-J/twin/desired",
            json={"desired_properties": {"operational_status": "assistance_in_progress"}},
        )

        assert response.status_code == 200
        assert response.json()["desired_properties"]["operational_status"] == "assistance_in_progress"
        mock_update_twin.assert_awaited_once_with(
            "SHS-2605-S01-A7K-00001-J",
            {"operational_status": "assistance_in_progress"},
        )


class TestAcknowledgeResolve:
    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_service.transition_device_status", new_callable=AsyncMock)
    def test_acknowledge_transitions_requested_device(self, mock_transition, mock_get, client_alice):
        mock_get.return_value = _device("assistance_requested")
        mock_transition.return_value = type("Result", (), {"success": True, "device": _device("assistance_in_progress")})()

        response = client_alice.post("/api/v1/devices/SHS-2605-S01-A7K-00001-J/acknowledge")

        assert response.status_code == 200
        assert response.json()["operational_status"] == "assistance_in_progress"

    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_service.transition_device_status", new_callable=AsyncMock)
    def test_acknowledge_rejects_wrong_state(self, mock_transition, mock_get, client_alice):
        mock_get.return_value = _device("available")
        mock_transition.return_value = type(
            "Result",
            (),
            {"success": False, "current_status": "available"},
        )()

        response = client_alice.post("/api/v1/devices/SHS-2605-S01-A7K-00001-J/acknowledge")

        assert response.status_code == 409

    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_service.transition_device_status", new_callable=AsyncMock)
    def test_resolve_transitions_in_progress_device(self, mock_transition, mock_get, client_alice):
        mock_get.return_value = _device("assistance_in_progress")
        mock_transition.return_value = type("Result", (), {"success": True, "device": _device("available")})()

        response = client_alice.post("/api/v1/devices/SHS-2605-S01-A7K-00001-J/resolve")

        assert response.status_code == 200
        assert response.json()["operational_status"] == "available"


class TestDeviceEvents:
    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_service.get_device_events", new_callable=AsyncMock)
    def test_events_require_auth(self, mock_events, mock_get, client_alice):
        mock_get.return_value = _device()
        mock_events.return_value = [_event()]

        response = client_alice.get("/api/v1/devices/SHS-2605-S01-A7K-00001-J/events")

        assert response.status_code == 200
        assert response.json()[0]["event_type"] == "assistance_requested"
        assert response.json()[0]["correct_response"] is True

    def test_normalize_event_payload_parses_stringified_json(self):
        payload = _normalize_event_payload('{"message":"Pilot sign created"}')
        assert payload == {"message": "Pilot sign created"}


class TestFalsePositiveRoute:
    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_service.mark_assistance_request_false_positive", new_callable=AsyncMock)
    def test_mark_false_positive_returns_device_and_event(self, mock_mark, mock_get, client_alice):
        mock_get.return_value = _device("assistance_requested")
        mock_mark.return_value = type(
            "Result",
            (),
            {
                "success": True,
                "device": _device("available"),
                "device_event": _event(correct_response=False),
            },
        )()

        response = client_alice.post(
            "/api/v1/devices/SHS-2605-S01-A7K-00001-J/events/evt-1/false-positive"
        )

        assert response.status_code == 200
        assert response.json()["device"]["operational_status"] == "available"
        assert response.json()["device_event"]["correct_response"] is False
        mock_mark.assert_awaited_once_with(
            serial_number="SHS-2605-S01-A7K-00001-J",
            device_event_id="evt-1",
        )

    @patch("app.routes.devices.device_service.get_device_by_serial", new_callable=AsyncMock)
    @patch("app.routes.devices.device_service.mark_assistance_request_false_positive", new_callable=AsyncMock)
    def test_mark_false_positive_rejects_wrong_state(self, mock_mark, mock_get, client_alice):
        mock_get.return_value = _device("assistance_in_progress")
        mock_mark.return_value = type(
            "Result",
            (),
            {
                "success": False,
                "current_status": "assistance_in_progress",
            },
        )()

        response = client_alice.post(
            "/api/v1/devices/SHS-2605-S01-A7K-00001-J/events/evt-1/false-positive"
        )

        assert response.status_code == 409
        mock_mark.assert_awaited_once_with(
            serial_number="SHS-2605-S01-A7K-00001-J",
            device_event_id="evt-1",
        )

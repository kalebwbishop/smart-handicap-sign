from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.services import device_service


def _device(status: str = "available") -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": "device-1",
        "serial_number": "SHS-2605-S01-A7K-00001-J",
        "model_code": "S01",
        "hardware_revision": "rev3",
        "firmware_version": "1.2.0",
        "connectivity_status": "online",
        "operational_status": status,
        "name": "Pilot Handicap Sign",
        "last_seen_at": now,
        "created_at": now,
        "updated_at": now,
    }


def _device_event() -> dict:
    return {
        "id": "evt-1",
        "device_id": "device-1",
        "event_type": "assistance_requested",
        "payload": {"confidence": 0.97},
        "correct_response": True,
        "created_at": datetime.now(timezone.utc),
    }


class _FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeConn:
    def __init__(self, fetchrow_results: list[dict]):
        self.fetchrow_results = list(fetchrow_results)
        self.fetchrow_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchrow(self, query: str, *args):
        self.fetchrow_calls.append((query, args))
        return self.fetchrow_results.pop(0)

    def transaction(self):
        return _FakeTransaction()


class _FakeAcquire:
    def __init__(self, conn: _FakeConn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakePool:
    def __init__(self, conn: _FakeConn):
        self.conn = conn

    def acquire(self):
        return _FakeAcquire(self.conn)


@patch("app.services.device_service.publish_mobile_home_update_with_conn", new_callable=AsyncMock)
@patch("app.services.device_twin_service.update_device_desired_properties", new_callable=AsyncMock)
@patch("app.services.device_service.get_pool", new_callable=AsyncMock)
def test_transition_device_status_publishes_live_update(mock_get_pool, mock_update_twin, mock_publish):
    conn = _FakeConn([_device(), _device("assistance_in_progress"), _device_event()])
    mock_get_pool.return_value = _FakePool(conn)

    result = asyncio.run(
        device_service.transition_device_status(
            serial_number="SHS-2605-S01-A7K-00001-J",
            expected_status="available",
            new_status="assistance_in_progress",
            event_type="assistance_acknowledged",
        )
    )

    assert result.success is True
    mock_publish.assert_awaited_once()
    assert mock_publish.await_args.args[0] is conn
    assert mock_publish.await_args.kwargs["scope"] == "device_status"
    assert mock_publish.await_args.kwargs["payload"] == {
        "event_type": "assistance_acknowledged",
        "new_status": "assistance_in_progress",
        "serial_number": "SHS-2605-S01-A7K-00001-J",
        "status_field": "operational_status",
    }
    mock_update_twin.assert_awaited_once()


@patch("app.services.device_service.publish_mobile_home_update_with_conn", new_callable=AsyncMock)
@patch("app.services.device_twin_service.update_device_desired_properties", new_callable=AsyncMock)
@patch("app.services.device_service.get_pool", new_callable=AsyncMock)
def test_mark_false_positive_publishes_live_update(mock_get_pool, mock_update_twin, mock_publish):
    conn = _FakeConn([_device("assistance_requested"), _device_event(), _device_event(), _device("available")])
    mock_get_pool.return_value = _FakePool(conn)

    result = asyncio.run(
        device_service.mark_assistance_request_false_positive(
            serial_number="SHS-2605-S01-A7K-00001-J",
            device_event_id="evt-1",
        )
    )

    assert result.success is True
    mock_publish.assert_awaited_once()
    assert mock_publish.await_args.args[0] is conn
    assert mock_publish.await_args.kwargs["scope"] == "notifications"
    assert mock_publish.await_args.kwargs["payload"] == {
        "action": "false_positive",
        "device_event_id": "evt-1",
        "serial_number": "SHS-2605-S01-A7K-00001-J",
    }
    mock_update_twin.assert_awaited_once()

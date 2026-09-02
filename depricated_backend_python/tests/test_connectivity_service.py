"""Tests for the periodic connectivity sweep."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.connectivity_service import CONNECTIVITY_STALE_THRESHOLD_MINUTES, sweep_stale_online_devices
from app.services.device_service import DeviceTransitionResult


class TestConnectivitySweep:
    @patch("app.services.connectivity_service.send_push_notifications", new_callable=AsyncMock)
    @patch("app.services.connectivity_service.device_service.transition_device_connectivity_status", new_callable=AsyncMock)
    @patch("app.services.connectivity_service.get_pool", new_callable=AsyncMock)
    def test_marks_stale_online_devices_offline_and_sends_notifications(
        self,
        mock_get_pool,
        mock_transition,
        mock_send_push,
    ):
        pool = MagicMock()
        pool.fetch = AsyncMock(return_value=[{"serial_number": "SHS-2605-S01-A7K-00001-J"}])
        mock_get_pool.return_value = pool
        mock_transition.return_value = DeviceTransitionResult(
            success=True,
            notifications=[{"id": "notification-1"}],
        )
        mock_send_push.return_value = 1

        marked_offline = asyncio.run(sweep_stale_online_devices())

        assert marked_offline == 1
        pool.fetch.assert_awaited_once()
        call_kwargs = mock_transition.await_args.kwargs
        assert call_kwargs["serial_number"] == "SHS-2605-S01-A7K-00001-J"
        assert call_kwargs["expected_status"] == "online"
        assert call_kwargs["new_status"] == "offline"
        assert call_kwargs["event_type"] == "connectivity_offline"
        assert call_kwargs["create_notifications"] is True
        assert call_kwargs["payload"] == {"stale_threshold_minutes": CONNECTIVITY_STALE_THRESHOLD_MINUTES}
        assert isinstance(call_kwargs["stale_before"], datetime)
        assert call_kwargs["stale_before"].tzinfo == timezone.utc
        mock_send_push.assert_awaited_once_with([{"id": "notification-1"}])

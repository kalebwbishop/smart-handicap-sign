from __future__ import annotations

import asyncio
import inspect
from unittest.mock import AsyncMock, patch

from app.services.telemetry_service import SAMPLE_COUNT
from app.services.iothub_consumer import _build_consumer_client, process_iothub_telemetry_event


class _FakeEvent:
    def __init__(self, body: dict, device_id: str = "SHS-2605-S01-A7K-00001-J"):
        self._body = body
        self.system_properties = {"iothub-connection-device-id": device_id}

    def body_as_json(self):
        return self._body


@patch("app.services.iothub_consumer.process_device_signal", new_callable=AsyncMock)
@patch("app.services.iothub_consumer.device_service.update_device_last_seen", new_callable=AsyncMock)
def test_process_iothub_telemetry_event_uses_device_id_fallback(mock_last_seen, mock_process):
    event = _FakeEvent({"samples": [100] * SAMPLE_COUNT})

    asyncio.run(process_iothub_telemetry_event(event))

    mock_last_seen.assert_awaited_once_with("SHS-2605-S01-A7K-00001-J")
    mock_process.assert_awaited_once()
    assert mock_process.await_args.args[0] == "SHS-2605-S01-A7K-00001-J"
    assert mock_process.await_args.args[1] == [100] * SAMPLE_COUNT


class _FakeConsumerClient:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


def test_build_consumer_client_uses_async_credential(monkeypatch):
    settings = type(
        "Settings",
        (),
        {
            "iothub_host_name": "example.servicebus.windows.net",
            "iothub_eventhub_name": "iothub-telemetry",
            "iothub_consumer_group": "$Default",
        },
    )()

    monkeypatch.setattr("app.services.iothub_consumer.get_settings", lambda: settings)
    monkeypatch.setattr("app.services.iothub_consumer.EventHubConsumerClient", _FakeConsumerClient)

    client = _build_consumer_client()

    assert isinstance(client, _FakeConsumerClient)
    assert inspect.iscoroutinefunction(client.kwargs["credential"].get_token)

from __future__ import annotations

import asyncio
import json
from typing import Any

from azure.eventhub.aio import EventHubConsumerClient, EventHubSharedKeyCredential
from azure.eventhub import TransportType
from pydantic import ValidationError

from app.config.settings import get_settings
from app.services import device_service
from app.services.telemetry_service import DeviceTelemetryIn, process_device_signal
from app.utils.logger import logger


def _parse_eventhub_connection_string(connection_string: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for segment in connection_string.split(";"):
        if not segment or "=" not in segment:
            continue
        key, value = segment.split("=", 1)
        parsed[key] = value
    return parsed


def _parse_event_body(event: Any) -> dict[str, Any]:
    if hasattr(event, "body_as_json"):
        try:
            body = event.body_as_json()
            if isinstance(body, dict):
                return body
        except Exception:
            pass

    raw_body = None
    if hasattr(event, "body_as_str"):
        try:
            raw_body = event.body_as_str(encoding="utf-8")
        except TypeError:
            raw_body = event.body_as_str()
    elif hasattr(event, "body"):
        body = event.body
        if isinstance(body, (bytes, bytearray)):
            raw_body = body.decode("utf-8")
        else:
            raw_body = b"".join(body).decode("utf-8")

    if raw_body is None:
        raise ValueError("Telemetry message body is empty")

    parsed = json.loads(raw_body)
    if not isinstance(parsed, dict):
        raise ValueError("Telemetry message body must be a JSON object")
    return parsed


def _normalize_serial_number(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8")
    elif not isinstance(value, str):
        value = str(value)

    value = value.strip()
    return value or None


def _extract_serial_number(body: dict[str, Any], event: Any) -> str | None:
    for key in ("serial_number", "serialNumber", "device_id", "deviceId"):
        serial_number = _normalize_serial_number(body.get(key))
        if serial_number:
            return serial_number

    system_properties = dict(getattr(event, "system_properties", {}) or {})
    return _normalize_serial_number(
        system_properties.get("iothub-connection-device-id")
        or system_properties.get(b"iothub-connection-device-id")
        or getattr(event, "partition_key", None),
    )


async def process_iothub_telemetry_event(event: Any) -> None:
    body = _parse_event_body(event)
    serial_number = _extract_serial_number(body, event)
    if serial_number:
        body.setdefault("serial_number", serial_number)

    try:
        payload = DeviceTelemetryIn.model_validate(body)
    except ValidationError as exc:
        logger.warning("Skipping invalid IoT Hub telemetry message: %s", exc)
        return

    if not serial_number:
        logger.warning("Skipping IoT Hub telemetry message without a device serial number")
        return
    try:
        device = await device_service.update_device_last_seen(serial_number)
        if device is None:
            logger.warning("Telemetry received for unknown device %s", serial_number)
        await process_device_signal(serial_number, payload.samples)
    except Exception:
        logger.exception("Failed to process IoT Hub telemetry for %s", serial_number)


async def _on_event(partition_context: Any, event: Any) -> None:
    del partition_context
    await process_iothub_telemetry_event(event)


async def _on_error(partition_context: Any, error: Exception) -> None:
    partition_id = getattr(partition_context, "partition_id", None)
    logger.exception("IoT Hub telemetry consumer error on partition %s: %s", partition_id, error)


def _build_consumer_client() -> EventHubConsumerClient:
    settings = get_settings()
    connection_string = settings.iothub_eventhub_connection_string.strip()
    if not connection_string:
        raise RuntimeError("IOTHUB_EVENTHUB_CONNECTION_STRING is not configured")

    parsed = _parse_eventhub_connection_string(connection_string)
    try:
        endpoint = parsed["Endpoint"]
        eventhub_name = parsed["EntityPath"]
        shared_access_policy = parsed["SharedAccessKeyName"]
        shared_access_key = parsed["SharedAccessKey"]
    except KeyError as exc:
        raise RuntimeError("IOTHUB_EVENTHUB_CONNECTION_STRING is missing required parts") from exc

    namespace = endpoint.removeprefix("sb://").rstrip("/")
    if not namespace:
        raise RuntimeError("IOTHUB_EVENTHUB_CONNECTION_STRING has an invalid Endpoint value")

    return EventHubConsumerClient(
        fully_qualified_namespace=namespace,
        eventhub_name=eventhub_name,
        consumer_group=settings.iothub_consumer_group,
        credential=EventHubSharedKeyCredential(shared_access_policy, shared_access_key),
        transport_type=TransportType.Amqp,
    )


async def run_iothub_telemetry_consumer(stop_event: asyncio.Event) -> None:
    settings = get_settings()
    if not settings.iothub_eventhub_connection_string.strip():
        logger.info("IoT Hub telemetry consumer disabled because no Event Hub connection string is configured")
        return

    backoff_seconds = 1
    while not stop_event.is_set():
        try:
            async with _build_consumer_client() as client:
                logger.info("Started IoT Hub telemetry consumer")
                backoff_seconds = 1
                await client.receive(
                    on_event=_on_event,
                    on_error=_on_error,
                )
        except asyncio.CancelledError:
            logger.info("IoT Hub telemetry consumer cancelled")
            raise
        except Exception:
            logger.exception("IoT Hub telemetry consumer failed; retrying in %s second(s)", backoff_seconds)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=backoff_seconds)
            except asyncio.TimeoutError:
                backoff_seconds = min(backoff_seconds * 2, 60)
                continue

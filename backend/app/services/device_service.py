from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from typing import Any, Optional

from app.config.database import get_pool
from app.services.live_updates import publish_mobile_home_update_with_conn
from app.utils.logger import logger


@dataclass
class DeviceTransitionResult:
    success: bool
    device: Optional[dict] = None
    error_code: Optional[str] = None
    current_status: Optional[str] = None
    notifications: Optional[list[dict]] = None


@dataclass
class DeviceEventLabelResult:
    success: bool
    device: Optional[dict] = None
    device_event: Optional[dict] = None
    error_code: Optional[str] = None
    current_status: Optional[str] = None


_DEVICE_COLUMNS = """
    id,
    serial_number,
    model_code,
    hardware_revision,
    firmware_version,
    connectivity_status,
    operational_status,
    last_seen_at,
    name,
    created_at,
    updated_at
"""

_DEVICE_EVENT_COLUMNS = """
    id,
    device_id,
    event_type,
    payload,
    correct_response,
    created_at
"""


def _row_to_dict(row) -> dict:
    device = dict(row)
    if device.get("id"):
        device["id"] = str(device["id"])
    device.setdefault("connectivity_status", "online")
    device.setdefault("lifecycle_status", "active")
    device.setdefault("claim_status", None)
    device.setdefault("organization_id", None)
    device.setdefault("current_site_id", None)
    device.setdefault("current_parking_space_id", None)
    return device


def _normalize_event_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, str):
        try:
            decoded = json.loads(payload)
        except json.JSONDecodeError:
            return {"raw": payload}
        return decoded if isinstance(decoded, dict) else {"value": decoded}
    if payload is None:
        return {}
    return {"value": payload}


def _event_row_to_dict(row) -> dict:
    event = dict(row)
    event["id"] = str(event["id"])
    event["device_id"] = str(event["device_id"])
    event["payload"] = _normalize_event_payload(event.get("payload"))
    event.setdefault("correct_response", None)
    return event


async def get_device_by_serial(serial_number: str) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        f"SELECT {_DEVICE_COLUMNS} FROM devices WHERE serial_number = $1",
        serial_number,
    )
    return _row_to_dict(row) if row else None


async def list_devices(*, skip: int = 0, limit: int = 100) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        f"""
        SELECT {_DEVICE_COLUMNS}
        FROM devices
        ORDER BY created_at ASC
        OFFSET $1 LIMIT $2
        """,
        skip,
        limit,
    )
    return [_row_to_dict(row) for row in rows]


async def update_device_last_seen(
    serial_number: str,
    *,
    seen_at: Optional[datetime] = None,
) -> Optional[dict]:
    pool = await get_pool()
    timestamp = seen_at or datetime.now(timezone.utc)
    row = await pool.fetchrow(
        f"""
        UPDATE devices
        SET last_seen_at = $2,
            connectivity_status = 'online',
            updated_at = NOW()
        WHERE serial_number = $1
        RETURNING {_DEVICE_COLUMNS}
        """,
        serial_number,
        timestamp,
    )
    return _row_to_dict(row) if row else None


async def _transition_device_status_column(
    *,
    serial_number: str,
    status_column: str,
    expected_status: str,
    new_status: str,
    event_type: str,
    actor_user_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    correct_response: Optional[bool] = None,
    create_notifications: bool = False,
    stale_before: Optional[datetime] = None,
) -> DeviceTransitionResult:
    pool = await get_pool()

    async with pool.acquire() as conn:
        async with conn.transaction():
            current = await conn.fetchrow(
                f"SELECT {_DEVICE_COLUMNS} FROM devices WHERE serial_number = $1 FOR UPDATE",
                serial_number,
            )
            if current is None:
                return DeviceTransitionResult(success=False, error_code="device_not_found")

            current_device = _row_to_dict(current)
            current_status = current_device.get(status_column)
            if current_status != expected_status:
                return DeviceTransitionResult(
                    success=False,
                    error_code="invalid_status_transition",
                    device=current_device,
                    current_status=current_status,
                )

            if status_column == "connectivity_status" and stale_before is not None:
                freshness_reference = current_device.get("last_seen_at") or current_device.get("created_at")
                if freshness_reference is not None and freshness_reference > stale_before:
                    return DeviceTransitionResult(
                        success=False,
                        error_code="not_stale",
                        device=current_device,
                        current_status=current_status,
                    )

            updated = await conn.fetchrow(
                f"""
                UPDATE devices
                SET {status_column} = $2,
                    updated_at = NOW()
                WHERE serial_number = $1
                RETURNING {_DEVICE_COLUMNS}
                """,
                serial_number,
                new_status,
            )

            event_payload = {
                "previous_status": expected_status,
                "new_status": new_status,
                "status_field": status_column,
            }
            if actor_user_id:
                event_payload["actor_user_id"] = actor_user_id
            if payload:
                event_payload.update(payload)
            if stale_before is not None and status_column == "connectivity_status":
                event_payload["stale_before"] = stale_before.isoformat()

            if correct_response is None and event_type == "assistance_requested":
                correct_response = True

            event_row = await conn.fetchrow(
                f"""
                INSERT INTO device_events (device_id, event_type, payload, correct_response)
                VALUES ($1::uuid, $2, $3::jsonb, $4)
                RETURNING {_DEVICE_EVENT_COLUMNS}
                """,
                str(updated["id"]),
                event_type,
                json.dumps(event_payload),
                correct_response,
            )

            created_notifications = None
            if create_notifications:
                from app.services.notification_service import (
                    create_assistance_request_notifications_with_conn,
                    create_device_offline_notifications_with_conn,
                )

                if status_column == "operational_status":
                    created_notifications = await create_assistance_request_notifications_with_conn(
                        conn,
                        device_id=str(updated["id"]),
                        device_event_id=str(event_row["id"]),
                        serial_number=serial_number,
                        device_name=updated.get("name"),
                    )
                elif status_column == "connectivity_status":
                    created_notifications = await create_device_offline_notifications_with_conn(
                        conn,
                        device_id=str(updated["id"]),
                        device_event_id=str(event_row["id"]),
                        serial_number=serial_number,
                        device_name=updated.get("name"),
                    )

            await publish_mobile_home_update_with_conn(
                conn,
                scope="device_status",
                payload={
                    "event_type": event_type,
                    "new_status": new_status,
                    "serial_number": serial_number,
                    "status_field": status_column,
                },
            )

    return DeviceTransitionResult(
        success=True,
        device=_row_to_dict(updated),
        notifications=created_notifications,
    )


async def transition_device_status(
    *,
    serial_number: str,
    expected_status: str,
    new_status: str,
    event_type: str,
    actor_user_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    correct_response: Optional[bool] = None,
    create_notifications: bool = False,
) -> DeviceTransitionResult:
    result = await _transition_device_status_column(
        serial_number=serial_number,
        status_column="operational_status",
        expected_status=expected_status,
        new_status=new_status,
        event_type=event_type,
        actor_user_id=actor_user_id,
        payload=payload,
        correct_response=correct_response,
        create_notifications=create_notifications,
    )
    if result.success:
        try:
            from app.services.device_twin_service import update_device_desired_properties

            await update_device_desired_properties(
                serial_number,
                {
                    "operational_status": new_status,
                },
            )
        except RuntimeError:
            logger.info(
                "IoT Hub service connection string is not configured; skipping twin sync for %s",
                serial_number,
            )
        except Exception:
            logger.exception("Failed to sync desired properties for %s", serial_number)
    return result


async def transition_device_connectivity_status(
    *,
    serial_number: str,
    expected_status: str,
    new_status: str,
    event_type: str,
    actor_user_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    create_notifications: bool = False,
    stale_before: Optional[datetime] = None,
) -> DeviceTransitionResult:
    return await _transition_device_status_column(
        serial_number=serial_number,
        status_column="connectivity_status",
        expected_status=expected_status,
        new_status=new_status,
        event_type=event_type,
        actor_user_id=actor_user_id,
        payload=payload,
        create_notifications=create_notifications,
        stale_before=stale_before,
    )


async def create_device_event(
    *,
    serial_number: str,
    event_type: str,
    payload: Optional[dict[str, Any]] = None,
    correct_response: Optional[bool] = None,
) -> Optional[dict]:
    pool = await get_pool()
    if correct_response is None and event_type == "assistance_requested":
        correct_response = True
    if event_type != "assistance_requested":
        correct_response = None
    row = await pool.fetchrow(
        f"""
        INSERT INTO device_events (device_id, event_type, payload, correct_response)
        SELECT id, $2, $3::jsonb, $4
        FROM devices
        WHERE serial_number = $1
        RETURNING {_DEVICE_EVENT_COLUMNS}
        """,
        serial_number,
        event_type,
        json.dumps(payload or {}),
        correct_response,
    )
    if row is None:
        return None
    return _event_row_to_dict(row)


async def get_device_events(*, serial_number: str, skip: int = 0, limit: int = 50) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT de.id, de.device_id, de.event_type, de.payload, de.correct_response, de.created_at
        FROM device_events de
        JOIN devices d ON d.id = de.device_id
        WHERE d.serial_number = $1
        ORDER BY de.created_at DESC
        OFFSET $2 LIMIT $3
        """,
        serial_number,
        skip,
        limit,
    )

    results = []
    for row in rows:
        results.append(_event_row_to_dict(row))
    return results


async def mark_assistance_request_false_positive(
    *,
    serial_number: str,
    device_event_id: str,
) -> DeviceEventLabelResult:
    pool = await get_pool()

    async with pool.acquire() as conn:
        async with conn.transaction():
            current = await conn.fetchrow(
                f"SELECT {_DEVICE_COLUMNS} FROM devices WHERE serial_number = $1 FOR UPDATE",
                serial_number,
            )
            if current is None:
                return DeviceEventLabelResult(success=False, error_code="device_not_found")

            current_device = _row_to_dict(current)
            current_status = current_device.get("operational_status")
            if current_status not in {"assistance_requested", "available"}:
                return DeviceEventLabelResult(
                    success=False,
                    device=current_device,
                    current_status=current_status,
                    error_code="invalid_status_transition",
                )

            event = await conn.fetchrow(
                f"""
                SELECT {_DEVICE_EVENT_COLUMNS}
                FROM device_events
                WHERE id = $1::uuid
                  AND device_id = $2::uuid
                FOR UPDATE
                """,
                device_event_id,
                str(current_device["id"]),
            )
            if event is None:
                return DeviceEventLabelResult(
                    success=False,
                    device=current_device,
                    current_status=current_status,
                    error_code="device_event_not_found",
                )

            current_event = _event_row_to_dict(event)
            if current_event.get("event_type") != "assistance_requested":
                return DeviceEventLabelResult(
                    success=False,
                    device=current_device,
                    device_event=current_event,
                    current_status=current_status,
                    error_code="invalid_event_type",
                )

            updated_event = await conn.fetchrow(
                f"""
                UPDATE device_events
                SET correct_response = FALSE
                WHERE id = $1::uuid
                RETURNING {_DEVICE_EVENT_COLUMNS}
                """,
                device_event_id,
            )

            updated_device = current_device
            if current_status == "assistance_requested":
                updated = await conn.fetchrow(
                    f"""
                    UPDATE devices
                    SET operational_status = 'available',
                        updated_at = NOW()
                    WHERE id = $1::uuid
                    RETURNING {_DEVICE_COLUMNS}
                    """,
                    str(current_device["id"]),
                )
                updated_device = _row_to_dict(updated)

            await publish_mobile_home_update_with_conn(
                conn,
                scope="notifications",
                payload={
                    "action": "false_positive",
                    "device_event_id": device_event_id,
                    "serial_number": serial_number,
                },
            )

    if current_status == "assistance_requested":
        try:
            from app.services.device_twin_service import update_device_desired_properties

            await update_device_desired_properties(
                serial_number,
                {
                    "operational_status": "available",
                },
            )
        except RuntimeError:
            logger.info(
                "IoT Hub service connection string is not configured; skipping twin sync for %s",
                serial_number,
            )
        except Exception:
            logger.exception("Failed to sync desired properties for %s", serial_number)

    return DeviceEventLabelResult(
        success=True,
        device=updated_device,
        device_event=_event_row_to_dict(updated_event),
    )

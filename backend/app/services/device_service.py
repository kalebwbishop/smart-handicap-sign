from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from typing import Any, Optional

from app.config.database import get_pool


@dataclass
class DeviceTransitionResult:
    success: bool
    device: Optional[dict] = None
    error_code: Optional[str] = None
    current_status: Optional[str] = None
    notifications: Optional[list[dict]] = None


_DEVICE_COLUMNS = """
    id,
    serial_number,
    model_code,
    hardware_revision,
    firmware_version,
    operational_status,
    last_seen_at,
    name,
    created_at,
    updated_at
"""


def _row_to_dict(row) -> dict:
    device = dict(row)
    if device.get("id"):
        device["id"] = str(device["id"])
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
            updated_at = NOW()
        WHERE serial_number = $1
        RETURNING {_DEVICE_COLUMNS}
        """,
        serial_number,
        timestamp,
    )
    return _row_to_dict(row) if row else None


async def transition_device_status(
    *,
    serial_number: str,
    expected_status: str,
    new_status: str,
    event_type: str,
    actor_user_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    create_notifications: bool = False,
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
            current_status = current_device["operational_status"]
            if current_status != expected_status:
                return DeviceTransitionResult(
                    success=False,
                    error_code="invalid_status_transition",
                    device=current_device,
                    current_status=current_status,
                )

            updated = await conn.fetchrow(
                f"""
                UPDATE devices
                SET operational_status = $2,
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
            }
            if actor_user_id:
                event_payload["actor_user_id"] = actor_user_id
            if payload:
                event_payload.update(payload)

            event_row = await conn.fetchrow(
                """
                INSERT INTO device_events (device_id, event_type, payload)
                VALUES ($1::uuid, $2, $3::jsonb)
                RETURNING id, device_id, event_type, payload, created_at
                """,
                str(updated["id"]),
                event_type,
                json.dumps(event_payload),
            )

            created_notifications = None
            if create_notifications:
                from app.services.notification_service import (
                    create_assistance_request_notifications_with_conn,
                )

                created_notifications = await create_assistance_request_notifications_with_conn(
                    conn,
                    device_id=str(updated["id"]),
                    device_event_id=str(event_row["id"]),
                    serial_number=serial_number,
                    device_name=updated.get("name"),
                )

    return DeviceTransitionResult(
        success=True,
        device=_row_to_dict(updated),
        notifications=created_notifications,
    )


async def create_device_event(
    *,
    serial_number: str,
    event_type: str,
    payload: Optional[dict[str, Any]] = None,
) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO device_events (device_id, event_type, payload)
        SELECT id, $2, $3::jsonb
        FROM devices
        WHERE serial_number = $1
        RETURNING id, device_id, event_type, payload, created_at
        """,
        serial_number,
        event_type,
        json.dumps(payload or {}),
    )
    if row is None:
        return None
    return _event_row_to_dict(row)


async def get_device_events(*, serial_number: str, skip: int = 0, limit: int = 50) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT de.id, de.device_id, de.event_type, de.payload, de.created_at
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

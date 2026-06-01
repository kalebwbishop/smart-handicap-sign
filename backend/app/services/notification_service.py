from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.config.database import get_pool


_NOTIFICATION_COLUMNS = """
    id,
    user_id,
    device_id,
    device_event_id,
    kind,
    title,
    body,
    read,
    created_at,
    updated_at
"""


def _notification_row_to_dict(row) -> dict:
    notification = dict(row)
    notification["id"] = str(notification["id"])
    notification["user_id"] = str(notification["user_id"])
    notification["device_id"] = str(notification["device_id"])
    notification["device_event_id"] = str(notification["device_event_id"])
    return notification


def _assistance_request_copy(*, serial_number: str, device_name: Optional[str]) -> tuple[str, str]:
    label = device_name.strip() if device_name and device_name.strip() else serial_number
    return (
        "Assistance requested",
        f"{label} is requesting assistance.",
    )


def _device_offline_copy(*, serial_number: str, device_name: Optional[str]) -> tuple[str, str]:
    label = device_name.strip() if device_name and device_name.strip() else serial_number
    return (
        "Device offline",
        f"{label} has not checked in recently and was marked offline.",
    )


def _preference_row_to_dict(row) -> dict:
    preference = dict(row)
    preference["user_id"] = str(preference["user_id"])
    return preference


def _push_token_row_to_dict(row) -> dict:
    push_token = dict(row)
    push_token["id"] = str(push_token["id"])
    push_token["user_id"] = str(push_token["user_id"])
    return push_token


async def _create_operator_notifications_with_conn(
    conn,
    *,
    device_id: str,
    device_event_id: str,
    kind: str,
    title: str,
    body: str,
) -> list[dict]:
    rows = await conn.fetch(
        f"""
        INSERT INTO notifications (
            user_id,
            device_id,
            device_event_id,
            kind,
            title,
            body
        )
        SELECT
            u.id,
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            $5
        FROM users u
        LEFT JOIN notification_preferences np ON np.user_id = u.id
        WHERE COALESCE(np.assistance_requests_enabled, TRUE)
        ON CONFLICT (user_id, device_event_id) DO NOTHING
        RETURNING {_NOTIFICATION_COLUMNS}
        """,
        device_id,
        device_event_id,
        kind,
        title,
        body,
    )
    return [_notification_row_to_dict(row) for row in rows]


async def create_assistance_request_notifications_with_conn(
    conn,
    *,
    device_id: str,
    device_event_id: str,
    serial_number: str,
    device_name: Optional[str] = None,
) -> list[dict]:
    title, body = _assistance_request_copy(
        serial_number=serial_number,
        device_name=device_name,
    )
    return await _create_operator_notifications_with_conn(
        conn,
        device_id=device_id,
        device_event_id=device_event_id,
        kind="assistance_requested",
        title=title,
        body=body,
    )


async def create_device_offline_notifications_with_conn(
    conn,
    *,
    device_id: str,
    device_event_id: str,
    serial_number: str,
    device_name: Optional[str] = None,
) -> list[dict]:
    title, body = _device_offline_copy(
        serial_number=serial_number,
        device_name=device_name,
    )
    return await _create_operator_notifications_with_conn(
        conn,
        device_id=device_id,
        device_event_id=device_event_id,
        kind="device_offline",
        title=title,
        body=body,
    )


async def list_notifications(
    *,
    user_id: str,
    after: Optional[datetime] = None,
    read: Optional[bool] = None,
    limit: int = 100,
) -> list[dict]:
    pool = await get_pool()

    where_clauses = ["user_id = $1::uuid"]
    params: list[object] = [user_id]

    if after is not None:
        where_clauses.append(f"created_at > ${len(params) + 1}")
        params.append(after)
    if read is not None:
        where_clauses.append(f"read = ${len(params) + 1}")
        params.append(read)

    params.append(limit)
    rows = await pool.fetch(
        f"""
        SELECT {_NOTIFICATION_COLUMNS}
        FROM notifications
        WHERE {" AND ".join(where_clauses)}
        ORDER BY created_at DESC
        LIMIT ${len(params)}
        """,
        *params,
    )
    return [_notification_row_to_dict(row) for row in rows]


async def get_unread_count(*, user_id: str) -> int:
    pool = await get_pool()
    count = await pool.fetchval(
        """
        SELECT COUNT(*)
        FROM notifications
        WHERE user_id = $1::uuid
          AND read = FALSE
        """,
        user_id,
    )
    return int(count or 0)


async def mark_notification_read(*, notification_id: str, user_id: str) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        f"""
        UPDATE notifications
        SET read = TRUE,
            updated_at = NOW()
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        RETURNING {_NOTIFICATION_COLUMNS}
        """,
        notification_id,
        user_id,
    )
    return _notification_row_to_dict(row) if row else None


async def mark_all_notifications_read(*, user_id: str) -> int:
    pool = await get_pool()
    count = await pool.fetchval(
        """
        WITH updated AS (
            UPDATE notifications
            SET read = TRUE,
                updated_at = NOW()
            WHERE user_id = $1::uuid
              AND read = FALSE
            RETURNING 1
        )
        SELECT COUNT(*) FROM updated
        """,
        user_id,
    )
    return int(count or 0)


async def get_notification_preferences(*, user_id: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT user_id, assistance_requests_enabled, push_enabled
        FROM notification_preferences
        WHERE user_id = $1::uuid
        """,
        user_id,
    )
    if row is None:
        return {
            "user_id": user_id,
            "assistance_requests_enabled": True,
            "push_enabled": True,
        }
    return _preference_row_to_dict(row)


async def update_notification_preferences(
    *,
    user_id: str,
    assistance_requests_enabled: Optional[bool] = None,
    push_enabled: Optional[bool] = None,
) -> dict:
    if assistance_requests_enabled is None and push_enabled is None:
        return await get_notification_preferences(user_id=user_id)

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO notification_preferences (
            user_id,
            assistance_requests_enabled,
            push_enabled
        )
        VALUES (
            $1::uuid,
            COALESCE($2, TRUE),
            COALESCE($3, TRUE)
        )
        ON CONFLICT (user_id) DO UPDATE
        SET assistance_requests_enabled = COALESCE($2, notification_preferences.assistance_requests_enabled),
            push_enabled = COALESCE($3, notification_preferences.push_enabled),
            updated_at = NOW()
        RETURNING user_id, assistance_requests_enabled, push_enabled
        """,
        user_id,
        assistance_requests_enabled,
        push_enabled,
    )
    return _preference_row_to_dict(row)


async def register_push_token(
    *,
    user_id: str,
    expo_push_token: str,
    platform: Optional[str] = None,
    device_name: Optional[str] = None,
) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO push_tokens (
            user_id,
            expo_push_token,
            platform,
            device_name
        )
        VALUES ($1::uuid, $2, $3, $4)
        ON CONFLICT (expo_push_token) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            platform = COALESCE(EXCLUDED.platform, push_tokens.platform),
            device_name = COALESCE(EXCLUDED.device_name, push_tokens.device_name),
            updated_at = NOW()
        RETURNING id, user_id, expo_push_token, platform, device_name, created_at, updated_at
        """,
        user_id,
        expo_push_token,
        platform,
        device_name,
    )
    return _push_token_row_to_dict(row)


async def unregister_push_token(*, user_id: str, expo_push_token: str) -> bool:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        DELETE FROM push_tokens
        WHERE user_id = $1::uuid
          AND expo_push_token = $2
        RETURNING id
        """,
        user_id,
        expo_push_token,
    )
    return row is not None

"""
Notification service – all notification-related database operations.

This module is imported by other services (e.g. event_service) so that
cross-domain logic like "create a notification after an event" stays
decoupled from the HTTP layer.
"""

from datetime import datetime
from typing import List, Optional

from asyncpg import Pool

from app.config.database import get_pool
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    """Normalise a database row into a plain dict with string IDs."""
    d = dict(row)
    d["id"] = str(d["id"])
    d["event_id"] = str(d["event_id"]) if d.get("event_id") else None
    return d


# ── create ───────────────────────────────────────────────────────────


async def create_notification(
    *,
    event_id: Optional[str] = None,
    title: str,
    body: str,
    read: bool = False,
    pool: Optional[Pool] = None,
) -> dict:
    """Insert a new notification and return the created row as a dict.

    Accepts an optional *pool* so callers that already hold a connection /
    transaction can pass it in, avoiding an extra pool acquisition.
    """
    pool = pool or await get_pool()

    if event_id is not None:
        event_check = await pool.fetchrow(
            "SELECT id FROM events WHERE id = $1", event_id
        )
        if not event_check:
            raise ValueError(f"Event {event_id} not found")

    query = """
        INSERT INTO notifications (event_id, title, body, read)
        VALUES ($1, $2, $3, $4)
        RETURNING id, event_id, title, body, read,
                  created_at, updated_at
    """
    row = await pool.fetchrow(query, event_id, title, body, read)

    if not row:
        raise RuntimeError("Failed to create notification")

    logger.info(f"✅ Notification created: {row['id']}")
    return _row_to_dict(row)


# ── list ─────────────────────────────────────────────────────────────


async def list_notifications(
    *,
    event_id: Optional[str] = None,
    read: Optional[bool] = None,
    after: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    pool = await get_pool()

    conditions: list[str] = []
    params: list = []
    idx = 1

    if event_id is not None:
        conditions.append(f"event_id = ${idx}")
        params.append(event_id)
        idx += 1

    if read is not None:
        conditions.append(f"read = ${idx}")
        params.append(read)
        idx += 1

    if after is not None:
        conditions.append(f"created_at > ${idx}")
        params.append(after)
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT id, event_id, title, body, read,
               created_at, updated_at
        FROM notifications
        {where}
        ORDER BY created_at DESC
        OFFSET ${idx} LIMIT ${idx + 1}
    """
    params.extend([skip, limit])

    rows = await pool.fetch(query, *params)
    logger.info(f"Retrieved {len(rows)} notifications")
    return [_row_to_dict(r) for r in rows]


# ── unread count ─────────────────────────────────────────────────────


async def get_unread_count() -> int:
    pool = await get_pool()
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE read = FALSE"
    )
    logger.info(f"Unread notifications count: {count}")
    return count


# ── get one ──────────────────────────────────────────────────────────


async def get_notification(notification_id: str) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, event_id, title, body, read,
               created_at, updated_at
        FROM notifications
        WHERE id = $1
        """,
        notification_id,
    )
    if row:
        logger.info(f"Retrieved notification: {notification_id}")
    return _row_to_dict(row) if row else None


# ── update ───────────────────────────────────────────────────────────


async def update_notification(
    notification_id: str,
    *,
    title: Optional[str] = None,
    body: Optional[str] = None,
    read: Optional[bool] = None,
) -> Optional[dict]:
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM notifications WHERE id = $1", notification_id
    )
    if not existing:
        return None

    updates: list[str] = []
    params: list = []
    idx = 1

    if title is not None:
        updates.append(f"title = ${idx}")
        params.append(title)
        idx += 1
    if body is not None:
        updates.append(f"body = ${idx}")
        params.append(body)
        idx += 1
    if read is not None:
        updates.append(f"read = ${idx}")
        params.append(read)
        idx += 1

    if not updates:
        row = await pool.fetchrow(
            """
            SELECT id, event_id, title, body, read,
                   created_at, updated_at
            FROM notifications WHERE id = $1
            """,
            notification_id,
        )
        return _row_to_dict(row)

    updates.append("updated_at = NOW()")
    params.append(notification_id)

    query = f"""
        UPDATE notifications
        SET {', '.join(updates)}
        WHERE id = ${idx}
        RETURNING id, event_id, title, body, read,
                  created_at, updated_at
    """
    row = await pool.fetchrow(query, *params)
    if not row:
        raise RuntimeError("Failed to update notification")

    logger.info(f"✅ Notification updated: {notification_id}")
    return _row_to_dict(row)


# ── mark read ────────────────────────────────────────────────────────


async def mark_as_read(notification_id: str) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE notifications
        SET read = TRUE, updated_at = NOW()
        WHERE id = $1
        RETURNING id, event_id, title, body, read,
                  created_at, updated_at
        """,
        notification_id,
    )
    if row:
        logger.info(f"✅ Notification marked as read: {notification_id}")
    return _row_to_dict(row) if row else None


async def mark_all_as_read() -> int:
    pool = await get_pool()
    result = await pool.execute(
        "UPDATE notifications SET read = TRUE, updated_at = NOW() WHERE read = FALSE"
    )
    count = int(result.split()[-1]) if result else 0
    logger.info(f"✅ Marked {count} notifications as read")
    return count


# ── delete ───────────────────────────────────────────────────────────


async def delete_notification(notification_id: str) -> bool:
    """Delete a notification. Returns True if it existed, False otherwise."""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM notifications WHERE id = $1", notification_id
    )
    if not existing:
        return False

    await pool.execute("DELETE FROM notifications WHERE id = $1", notification_id)
    logger.info(f"✅ Notification deleted: {notification_id}")
    return True

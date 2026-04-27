"""
Event service – all event-related database operations.

Imports notification_service for the "create notification after event"
workflow, keeping the cross-domain logic inside the service layer
rather than the HTTP route.
"""

import json
from typing import Any, Dict, List, Optional

from asyncpg import Pool

from app.config.database import get_pool
from app.services import notification_service
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    """Normalise a database row into a plain dict with string IDs."""
    d = dict(row)
    d["id"] = str(d["id"])
    d["sign_id"] = str(d["sign_id"])
    if isinstance(d.get("data"), str):
        d["data"] = json.loads(d["data"])
    return d


# ── create ───────────────────────────────────────────────────────────


async def create_event(
    *,
    sign_id: str,
    event_type: str,
    data: Optional[Dict[str, Any]] = None,
    create_notification: bool = False,
    notification_title: Optional[str] = None,
    notification_body: Optional[str] = None,
    notify_org: bool = False,
) -> dict:
    """Create an event and optionally a linked notification.

    When *notify_org* is True the notification is fanned out to every
    member of the sign's organization.  Otherwise a single global
    notification is created.

    Raises ValueError for business-rule violations (sign not found,
    missing notification_title, etc.).
    """
    pool = await get_pool()

    # Verify the sign exists and fetch its org
    sign_row = await pool.fetchrow(
        "SELECT id, organization_id FROM signs WHERE id = $1", sign_id
    )
    if not sign_row:
        raise ValueError("Sign not found")

    if create_notification and not notification_title:
        raise ValueError(
            "notification_title is required when create_notification is True"
        )

    event_data = json.dumps(data if data else {})

    row = await pool.fetchrow(
        """
        INSERT INTO events (sign_id, type, data)
        VALUES ($1, $2, $3::jsonb)
        RETURNING id, sign_id, type, data,
                  created_at, updated_at
        """,
        sign_id,
        event_type,
        event_data,
    )

    if not row:
        raise RuntimeError("Failed to create event")

    event_dict = _row_to_dict(row)
    logger.info(f"✅ Event created: {event_dict['id']}")

    # Cross-domain: create linked notification(s)
    if create_notification:
        body = (
            notification_body
            if notification_body
            else f"{event_type} event on sign {sign_id}"
        )
        org_id = str(sign_row["organization_id"]) if sign_row["organization_id"] else None

        if notify_org and org_id:
            notifs = await notification_service.create_notifications_for_org(
                org_id=org_id,
                event_id=str(row["id"]),
                title=notification_title,
                body=body,
                pool=pool,
            )
            logger.info(
                "✅ %d org notifications created for event %s",
                len(notifs), event_dict["id"],
            )
        else:
            notif = await notification_service.create_notification(
                event_id=str(row["id"]),
                title=notification_title,
                body=body,
                pool=pool,
            )
            logger.info(
                "✅ Notification auto-created: %s for event %s",
                notif["id"], event_dict["id"],
            )

    return event_dict


# ── list ─────────────────────────────────────────────────────────────


async def list_events(
    *,
    sign_id: Optional[str] = None,
    event_type: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    pool = await get_pool()

    conditions: list[str] = []
    params: list = []
    idx = 1

    if sign_id is not None:
        conditions.append(f"e.sign_id = ${idx}")
        params.append(sign_id)
        idx += 1

    if event_type is not None:
        conditions.append(f"e.type = ${idx}")
        params.append(event_type)
        idx += 1

    if user_id is not None:
        conditions.append(
            f"e.sign_id IN (SELECT s.id FROM signs s "
            f"WHERE s.organization_id IN "
            f"(SELECT organization_id FROM organization_members WHERE user_id = ${idx}))"
        )
        params.append(user_id)
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT e.id, e.sign_id, e.type, e.data,
               e.created_at, e.updated_at
        FROM events e
        {where}
        ORDER BY e.created_at DESC
        OFFSET ${idx} LIMIT ${idx + 1}
    """
    params.extend([skip, limit])

    rows = await pool.fetch(query, *params)
    logger.info(f"Retrieved {len(rows)} events")
    return [_row_to_dict(r) for r in rows]


# ── get one ──────────────────────────────────────────────────────────


async def get_event(event_id: str) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, sign_id, type, data,
               created_at, updated_at
        FROM events WHERE id = $1
        """,
        event_id,
    )
    if row:
        logger.info(f"Retrieved event: {event_id}")
    return _row_to_dict(row) if row else None


# ── get notifications for event ──────────────────────────────────────


async def get_event_notifications(event_id: str) -> List[dict]:
    """Return all notifications linked to *event_id*.

    Raises ValueError if the event does not exist.
    """
    pool = await get_pool()

    event_check = await pool.fetchrow(
        "SELECT id FROM events WHERE id = $1", event_id
    )
    if not event_check:
        raise ValueError("Event not found")

    rows = await pool.fetch(
        """
        SELECT id, event_id, user_id, title, body, read,
               created_at, updated_at
        FROM notifications
        WHERE event_id = $1
        ORDER BY created_at DESC
        """,
        event_id,
    )

    result = []
    for row in rows:
        d = dict(row)
        d["id"] = str(d["id"])
        d["event_id"] = str(d["event_id"]) if d.get("event_id") else None
        d["user_id"] = str(d["user_id"]) if d.get("user_id") else None
        result.append(d)

    logger.info(f"Retrieved {len(result)} notifications for event {event_id}")
    return result


# ── update ───────────────────────────────────────────────────────────


async def update_event(
    event_id: str,
    *,
    event_type: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Optional[dict]:
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM events WHERE id = $1", event_id
    )
    if not existing:
        return None

    updates: list[str] = []
    params: list = []
    idx = 1

    if event_type is not None:
        updates.append(f"type = ${idx}")
        params.append(event_type)
        idx += 1

    if data is not None:
        updates.append(f"data = ${idx}::jsonb")
        params.append(json.dumps(data))
        idx += 1

    if not updates:
        row = await pool.fetchrow(
            """
            SELECT id, sign_id, type, data,
                   created_at, updated_at
            FROM events WHERE id = $1
            """,
            event_id,
        )
        return _row_to_dict(row)

    updates.append("updated_at = NOW()")
    params.append(event_id)

    query = f"""
        UPDATE events
        SET {', '.join(updates)}
        WHERE id = ${idx}
        RETURNING id, sign_id, type, data,
                  created_at, updated_at
    """
    row = await pool.fetchrow(query, *params)
    if not row:
        raise RuntimeError("Failed to update event")

    logger.info(f"✅ Event updated: {event_id}")
    return _row_to_dict(row)


# ── delete ───────────────────────────────────────────────────────────


async def delete_event(event_id: str) -> bool:
    """Delete an event and its linked notifications. Returns False if not found."""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM events WHERE id = $1", event_id
    )
    if not existing:
        return False

    await pool.execute("DELETE FROM notifications WHERE event_id = $1", event_id)
    await pool.execute("DELETE FROM events WHERE id = $1", event_id)

    logger.info(f"✅ Event deleted (with notifications): {event_id}")
    return True

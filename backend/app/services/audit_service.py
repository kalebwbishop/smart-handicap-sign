"""
Audit logging service — records all security-relevant actions.

Standard actions:
    device.claimed            – user claimed a device
    device.revoked            – device claim was revoked
    device.transferred        – device was transferred to another owner
    device.released           – device was released / unlinked
    device.claim_regenerated  – device claim code was regenerated
    site.created              – site was created
    site.updated              – site was updated
    site.deleted              – site was deleted
    parking_space.created     – parking space was created
    parking_space.updated     – parking space was updated
    parking_space.deleted     – parking space was deleted
    installation.created      – installation was created
"""

import json
from typing import Any, Optional

from app.config.database import get_pool
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    if d.get("actor_user_id"):
        d["actor_user_id"] = str(d["actor_user_id"])
    d["entity_id"] = str(d["entity_id"])
    if isinstance(d.get("metadata"), str):
        d["metadata"] = json.loads(d["metadata"])
    return d


# ── create ───────────────────────────────────────────────────────────


async def log_action(
    *,
    actor_user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> dict:
    """
    Create an audit log entry.

    Args:
        actor_user_id: The user who performed the action (None for system actions).
        action: What was done (e.g., 'device.claimed', 'device.revoked').
        entity_type: The type of entity affected (e.g., 'device', 'site').
        entity_id: The ID of the affected entity.
        metadata: Optional additional context (stored as JSONB).

    Returns:
        The created audit log record as a dict.
    """
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, actor_user_id, action, entity_type, entity_id, metadata, created_at
        """,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        json.dumps(metadata or {}),
    )

    if not row:
        raise RuntimeError("Failed to create audit log entry")

    logger.info(
        "📋 Audit: %s on %s/%s by %s",
        action,
        entity_type,
        entity_id,
        actor_user_id or "system",
    )
    return _row_to_dict(row)


# ── queries ──────────────────────────────────────────────────────────


async def get_audit_logs_for_entity(
    entity_type: str,
    entity_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Retrieve audit logs for a specific entity, ordered by most recent first."""
    pool = await get_pool()

    rows = await pool.fetch(
        """
        SELECT id, actor_user_id, action, entity_type, entity_id, metadata, created_at
        FROM audit_logs
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        """,
        entity_type,
        entity_id,
        limit,
        offset,
    )

    return [_row_to_dict(r) for r in rows]


async def get_audit_logs_for_actor(
    actor_user_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Retrieve audit logs for a specific actor/user, ordered by most recent first."""
    pool = await get_pool()

    rows = await pool.fetch(
        """
        SELECT id, actor_user_id, action, entity_type, entity_id, metadata, created_at
        FROM audit_logs
        WHERE actor_user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        actor_user_id,
        limit,
        offset,
    )

    return [_row_to_dict(r) for r in rows]

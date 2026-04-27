"""
Push-token service – stores and retrieves Expo push tokens per user.

Tokens are unique by expo_push_token value; if a token is re-registered
it is updated to the new user/device (handles device transfers).
"""

from typing import List, Optional

from asyncpg import Pool

from app.config.database import get_pool
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    """Normalise a database row into a plain dict with string IDs."""
    d = dict(row)
    d["id"] = str(d["id"])
    d["user_id"] = str(d["user_id"])
    return d


# ── register ─────────────────────────────────────────────────────────


async def register_token(
    user_id: str,
    expo_push_token: str,
    device_id: Optional[str] = None,
    *,
    pool: Optional[Pool] = None,
) -> dict:
    """Insert a push token, or update the owner if it already exists.

    A single Expo push token can transfer between users/devices, so we
    use ON CONFLICT … DO UPDATE to keep the table consistent.
    """
    pool = pool or await get_pool()

    query = """
        INSERT INTO push_tokens (user_id, expo_push_token, device_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (expo_push_token) DO UPDATE
            SET user_id   = EXCLUDED.user_id,
                device_id = EXCLUDED.device_id
        RETURNING id, user_id, expo_push_token, device_id, created_at
    """
    row = await pool.fetchrow(query, user_id, expo_push_token, device_id)

    if not row:
        raise RuntimeError("Failed to register push token")

    logger.info("✅ Push token registered for user %s", user_id)
    return _row_to_dict(row)


# ── unregister ───────────────────────────────────────────────────────


async def unregister_token(
    expo_push_token: str,
    *,
    pool: Optional[Pool] = None,
) -> bool:
    """Delete a push token. Returns True if it existed, False otherwise."""
    pool = pool or await get_pool()

    result = await pool.execute(
        "DELETE FROM push_tokens WHERE expo_push_token = $1",
        expo_push_token,
    )
    deleted = result == "DELETE 1"

    if deleted:
        logger.info("✅ Push token unregistered: %s", expo_push_token)
    return deleted


# ── queries ──────────────────────────────────────────────────────────


async def get_tokens_for_user(
    user_id: str,
    *,
    pool: Optional[Pool] = None,
) -> List[dict]:
    """Return all push tokens belonging to a single user."""
    pool = pool or await get_pool()

    rows = await pool.fetch(
        """
        SELECT id, user_id, expo_push_token, device_id, created_at
        FROM push_tokens
        WHERE user_id = $1
        ORDER BY created_at
        """,
        user_id,
    )
    logger.info("Retrieved %d push tokens for user %s", len(rows), user_id)
    return [_row_to_dict(r) for r in rows]


async def get_tokens_for_users(
    user_ids: List[str],
    *,
    pool: Optional[Pool] = None,
) -> List[dict]:
    """Return all push tokens for multiple users (e.g. org-wide notifications)."""
    pool = pool or await get_pool()

    if not user_ids:
        return []

    rows = await pool.fetch(
        """
        SELECT id, user_id, expo_push_token, device_id, created_at
        FROM push_tokens
        WHERE user_id = ANY($1::uuid[])
        ORDER BY created_at
        """,
        user_ids,
    )
    logger.info("Retrieved %d push tokens for %d users", len(rows), len(user_ids))
    return [_row_to_dict(r) for r in rows]

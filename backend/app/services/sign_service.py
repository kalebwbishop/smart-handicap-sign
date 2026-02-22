"""
Sign service – all sign-related database operations.
"""

from typing import List, Optional

from app.config.database import get_pool
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    return d


# ── create ───────────────────────────────────────────────────────────


async def create_sign(
    *,
    name: str,
    location: str,
    status: str = "available",
) -> dict:
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        INSERT INTO signs (name, location, status)
        VALUES ($1, $2, $3)
        RETURNING id, name, location, status, last_updated
        """,
        name,
        location,
        status,
    )

    if not row:
        raise RuntimeError("Failed to create sign")

    logger.info(f"✅ Sign created: {row['id']}")
    return _row_to_dict(row)


# ── list ─────────────────────────────────────────────────────────────


async def list_signs(
    *,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    pool = await get_pool()

    if status:
        rows = await pool.fetch(
            """
            SELECT id, name, location, status, last_updated
            FROM signs
            WHERE status = $1
            ORDER BY last_updated DESC
            OFFSET $2 LIMIT $3
            """,
            status,
            skip,
            limit,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT id, name, location, status, last_updated
            FROM signs
            ORDER BY last_updated DESC
            OFFSET $1 LIMIT $2
            """,
            skip,
            limit,
        )

    logger.info(f"Retrieved {len(rows)} signs")
    return [_row_to_dict(r) for r in rows]


# ── get one ──────────────────────────────────────────────────────────


async def get_sign(sign_id: str) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, name, location, status, last_updated
        FROM signs WHERE id = $1
        """,
        sign_id,
    )
    if row:
        logger.info(f"Retrieved sign: {sign_id}")
    return _row_to_dict(row) if row else None


# ── update ───────────────────────────────────────────────────────────


async def update_sign(
    sign_id: str,
    *,
    name: Optional[str] = None,
    location: Optional[str] = None,
    status: Optional[str] = None,
) -> Optional[dict]:
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM signs WHERE id = $1", sign_id
    )
    if not existing:
        return None

    updates: list[str] = []
    params: list = []
    idx = 1

    if name is not None:
        updates.append(f"name = ${idx}")
        params.append(name)
        idx += 1
    if location is not None:
        updates.append(f"location = ${idx}")
        params.append(location)
        idx += 1
    if status is not None:
        updates.append(f"status = ${idx}")
        params.append(status)
        idx += 1

    if not updates:
        row = await pool.fetchrow(
            """
            SELECT id, name, location, status, last_updated
            FROM signs WHERE id = $1
            """,
            sign_id,
        )
        return _row_to_dict(row)

    updates.append("last_updated = NOW()")
    params.append(sign_id)

    query = f"""
        UPDATE signs
        SET {', '.join(updates)}
        WHERE id = ${idx}
        RETURNING id, name, location, status, last_updated
    """
    row = await pool.fetchrow(query, *params)
    if not row:
        raise RuntimeError("Failed to update sign")

    logger.info(f"✅ Sign updated: {sign_id}")
    return _row_to_dict(row)


# ── delete ───────────────────────────────────────────────────────────


async def delete_sign(sign_id: str) -> bool:
    """Delete a sign. Returns False if it did not exist."""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM signs WHERE id = $1", sign_id
    )
    if not existing:
        return False

    await pool.execute("DELETE FROM signs WHERE id = $1", sign_id)
    logger.info(f"✅ Sign deleted: {sign_id}")
    return True

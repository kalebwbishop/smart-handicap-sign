"""
Parking space service — CRUD operations for parking spaces.
"""

from typing import List, Optional
from decimal import Decimal

from app.config.database import get_pool
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    d["site_id"] = str(d["site_id"])
    if d.get("current_device_id"):
        d["current_device_id"] = str(d["current_device_id"])
    # Convert Decimal to float for JSON serialization
    if d.get("latitude") is not None:
        d["latitude"] = float(d["latitude"])
    if d.get("longitude") is not None:
        d["longitude"] = float(d["longitude"])
    return d


# ── create ───────────────────────────────────────────────────────────


async def create_parking_space(
    *,
    site_id: str,
    label: str,
    accessible_type: str = "standard",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    notes: Optional[str] = None,
) -> dict:
    """Create a new parking space for a site."""
    pool = await get_pool()

    lat = Decimal(str(latitude)) if latitude is not None else None
    lon = Decimal(str(longitude)) if longitude is not None else None

    row = await pool.fetchrow(
        """
        INSERT INTO parking_spaces (site_id, label, accessible_type, latitude, longitude, notes)
        VALUES ($1, $2, $3::accessible_parking_type, $4, $5, $6)
        RETURNING id, site_id, label, accessible_type, latitude, longitude,
                  notes, current_device_id, created_at, updated_at
        """,
        site_id,
        label,
        accessible_type,
        lat,
        lon,
        notes,
    )

    if not row:
        raise RuntimeError("Failed to create parking space")

    logger.info("✅ Parking space created: %s for site %s", row["id"], site_id)
    return _row_to_dict(row)


# ── list ─────────────────────────────────────────────────────────────


async def list_parking_spaces(
    *,
    site_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    """
    List parking spaces. Filter by site_id or organization_id.
    If organization_id is provided, returns spaces for all sites in that org.
    """
    pool = await get_pool()

    conditions: list[str] = []
    params: list = []
    idx = 1

    if site_id:
        conditions.append(f"ps.site_id = ${idx}")
        params.append(site_id)
        idx += 1
    elif organization_id:
        conditions.append(
            f"ps.site_id IN (SELECT id FROM sites WHERE organization_id = ${idx})"
        )
        params.append(organization_id)
        idx += 1

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    params.append(limit)
    limit_idx = idx
    idx += 1
    params.append(skip)
    offset_idx = idx

    rows = await pool.fetch(
        f"""
        SELECT ps.id, ps.site_id, ps.label, ps.accessible_type,
               ps.latitude, ps.longitude, ps.notes,
               ps.current_device_id, ps.created_at, ps.updated_at
        FROM parking_spaces ps
        {where}
        ORDER BY ps.label
        LIMIT ${limit_idx} OFFSET ${offset_idx}
        """,
        *params,
    )

    return [_row_to_dict(r) for r in rows]


# ── get one ──────────────────────────────────────────────────────────


async def get_parking_space(space_id: str) -> Optional[dict]:
    """Get a parking space by ID."""
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        SELECT id, site_id, label, accessible_type, latitude, longitude,
               notes, current_device_id, created_at, updated_at
        FROM parking_spaces
        WHERE id = $1
        """,
        space_id,
    )

    return _row_to_dict(row) if row else None


# ── update ───────────────────────────────────────────────────────────


async def update_parking_space(
    space_id: str,
    *,
    label: Optional[str] = None,
    accessible_type: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    notes: Optional[str] = None,
) -> Optional[dict]:
    """Update a parking space. Returns None if not found."""
    pool = await get_pool()

    sets: list[str] = []
    params: list = []
    idx = 1

    if label is not None:
        sets.append(f"label = ${idx}")
        params.append(label)
        idx += 1

    if accessible_type is not None:
        sets.append(f"accessible_type = ${idx}::accessible_parking_type")
        params.append(accessible_type)
        idx += 1

    if latitude is not None:
        sets.append(f"latitude = ${idx}")
        params.append(Decimal(str(latitude)))
        idx += 1

    if longitude is not None:
        sets.append(f"longitude = ${idx}")
        params.append(Decimal(str(longitude)))
        idx += 1

    if notes is not None:
        sets.append(f"notes = ${idx}")
        params.append(notes)
        idx += 1

    if not sets:
        return await get_parking_space(space_id)

    sets.append(f"updated_at = CURRENT_TIMESTAMP")
    params.append(space_id)

    row = await pool.fetchrow(
        f"""
        UPDATE parking_spaces
        SET {', '.join(sets)}
        WHERE id = ${idx}
        RETURNING id, site_id, label, accessible_type, latitude, longitude,
                  notes, current_device_id, created_at, updated_at
        """,
        *params,
    )

    if not row:
        return None

    logger.info("✅ Parking space updated: %s", space_id)
    return _row_to_dict(row)


# ── delete ───────────────────────────────────────────────────────────


async def delete_parking_space(space_id: str) -> bool:
    """Delete a parking space. Returns False if not found. Fails if a device is currently assigned."""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id, current_device_id FROM parking_spaces WHERE id = $1",
        space_id,
    )

    if not existing:
        return False

    if existing["current_device_id"] is not None:
        raise ValueError(
            f"Cannot delete parking space {space_id}: "
            f"device {existing['current_device_id']} is still assigned. "
            "Unassign the device first."
        )

    await pool.execute("DELETE FROM parking_spaces WHERE id = $1", space_id)
    logger.info("✅ Parking space deleted: %s", space_id)
    return True


# ── convenience ──────────────────────────────────────────────────────


async def get_spaces_for_site(site_id: str) -> List[dict]:
    """Get all parking spaces for a given site."""
    pool = await get_pool()

    rows = await pool.fetch(
        """
        SELECT id, site_id, label, accessible_type, latitude, longitude,
               notes, current_device_id, created_at, updated_at
        FROM parking_spaces
        WHERE site_id = $1
        ORDER BY label
        """,
        site_id,
    )

    return [_row_to_dict(r) for r in rows]

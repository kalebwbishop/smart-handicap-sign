"""Site service — CRUD operations for sites."""

from typing import List, Optional

from app.config.database import get_pool
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    d["organization_id"] = str(d["organization_id"])
    return d


# ── create ───────────────────────────────────────────────────────────


async def create_site(
    *,
    organization_id: str,
    name: str,
    address_line_1: Optional[str] = None,
    address_line_2: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    postal_code: Optional[str] = None,
    country: str = "US",
    jurisdiction: Optional[str] = None,
) -> dict:
    """Create a new site for an organization."""
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        INSERT INTO sites (
            organization_id, name, address_line_1, address_line_2,
            city, state, postal_code, country, jurisdiction
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, organization_id, name, address_line_1, address_line_2,
                  city, state, postal_code, country, jurisdiction,
                  created_at, updated_at
        """,
        organization_id,
        name,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        jurisdiction,
    )

    if not row:
        raise RuntimeError("Failed to create site")

    logger.info(f"✅ Site created: {row['id']}")
    return _row_to_dict(row)


# ── list ─────────────────────────────────────────────────────────────


async def list_sites(
    *,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    """
    List sites. If user_id is provided, returns sites for all orgs the user
    belongs to. If organization_id is provided, filters to that org only.
    """
    pool = await get_pool()

    conditions: list[str] = []
    params: list = []
    idx = 1

    if organization_id:
        conditions.append(f"s.organization_id = ${idx}")
        params.append(organization_id)
        idx += 1

    if user_id:
        conditions.append(
            f"s.organization_id IN "
            f"(SELECT organization_id FROM organization_members WHERE user_id = ${idx})"
        )
        params.append(user_id)
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT s.id, s.organization_id, s.name, s.address_line_1,
               s.address_line_2, s.city, s.state, s.postal_code,
               s.country, s.jurisdiction, s.created_at, s.updated_at
        FROM sites s
        {where}
        ORDER BY s.created_at DESC
        OFFSET ${idx} LIMIT ${idx + 1}
    """
    params.extend([skip, limit])

    rows = await pool.fetch(query, *params)
    logger.info(f"Retrieved {len(rows)} sites")
    return [_row_to_dict(r) for r in rows]


# ── get one ──────────────────────────────────────────────────────────


async def get_site(site_id: str) -> Optional[dict]:
    """Get a site by ID."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, organization_id, name, address_line_1, address_line_2,
               city, state, postal_code, country, jurisdiction,
               created_at, updated_at
        FROM sites WHERE id = $1
        """,
        site_id,
    )
    if row:
        logger.info(f"Retrieved site: {site_id}")
    return _row_to_dict(row) if row else None


# ── update ───────────────────────────────────────────────────────────


async def update_site(
    site_id: str,
    *,
    name: Optional[str] = None,
    address_line_1: Optional[str] = None,
    address_line_2: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    postal_code: Optional[str] = None,
    country: Optional[str] = None,
    jurisdiction: Optional[str] = None,
) -> Optional[dict]:
    """Update a site. Returns None if not found."""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM sites WHERE id = $1", site_id
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
    if address_line_1 is not None:
        updates.append(f"address_line_1 = ${idx}")
        params.append(address_line_1)
        idx += 1
    if address_line_2 is not None:
        updates.append(f"address_line_2 = ${idx}")
        params.append(address_line_2)
        idx += 1
    if city is not None:
        updates.append(f"city = ${idx}")
        params.append(city)
        idx += 1
    if state is not None:
        updates.append(f"state = ${idx}")
        params.append(state)
        idx += 1
    if postal_code is not None:
        updates.append(f"postal_code = ${idx}")
        params.append(postal_code)
        idx += 1
    if country is not None:
        updates.append(f"country = ${idx}")
        params.append(country)
        idx += 1
    if jurisdiction is not None:
        updates.append(f"jurisdiction = ${idx}")
        params.append(jurisdiction)
        idx += 1

    if not updates:
        row = await pool.fetchrow(
            """
            SELECT id, organization_id, name, address_line_1, address_line_2,
                   city, state, postal_code, country, jurisdiction,
                   created_at, updated_at
            FROM sites WHERE id = $1
            """,
            site_id,
        )
        return _row_to_dict(row)

    updates.append("updated_at = NOW()")
    params.append(site_id)

    query = f"""
        UPDATE sites
        SET {', '.join(updates)}
        WHERE id = ${idx}
        RETURNING id, organization_id, name, address_line_1, address_line_2,
                  city, state, postal_code, country, jurisdiction,
                  created_at, updated_at
    """
    row = await pool.fetchrow(query, *params)
    if not row:
        raise RuntimeError("Failed to update site")

    logger.info(f"✅ Site updated: {site_id}")
    return _row_to_dict(row)


# ── delete ───────────────────────────────────────────────────────────


async def delete_site(site_id: str) -> bool:
    """Delete a site. Returns False if not found."""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM sites WHERE id = $1", site_id
    )
    if not existing:
        return False

    await pool.execute("DELETE FROM sites WHERE id = $1", site_id)
    logger.info(f"✅ Site deleted: {site_id}")
    return True

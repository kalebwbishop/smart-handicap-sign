"""
Organization service – all organization-related database operations.
"""

from typing import List, Optional

from app.config.database import get_pool
from app.utils.logger import logger


# ── row helpers ──────────────────────────────────────────────────────


def _org_to_dict(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    return d


def _member_to_dict(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    d["organization_id"] = str(d["organization_id"])
    d["user_id"] = str(d["user_id"])
    return d


# ── create ───────────────────────────────────────────────────────────


async def create_organization(*, name: str, owner_user_id: str) -> dict:
    """Create an organization and add the creator as owner."""
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        INSERT INTO organizations (name)
        VALUES ($1)
        RETURNING id, name, created_at, updated_at
        """,
        name,
    )
    if not row:
        raise RuntimeError("Failed to create organization")

    org = _org_to_dict(row)

    await pool.execute(
        """
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES ($1, $2, 'owner')
        """,
        row["id"],
        owner_user_id,
    )

    logger.info("✅ Organization created: %s by user %s", org["id"], owner_user_id)
    return org


# ── list ─────────────────────────────────────────────────────────────


async def list_organizations_for_user(user_id: str) -> List[dict]:
    """Return all organizations a user belongs to, with their role."""
    pool = await get_pool()

    rows = await pool.fetch(
        """
        SELECT o.id, o.name, o.created_at, o.updated_at, om.role
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = $1
        ORDER BY o.name
        """,
        user_id,
    )

    result = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        result.append(d)
    return result


# ── get one ──────────────────────────────────────────────────────────


async def get_organization(org_id: str) -> Optional[dict]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, name, created_at, updated_at
        FROM organizations WHERE id = $1
        """,
        org_id,
    )
    return _org_to_dict(row) if row else None


# ── update ───────────────────────────────────────────────────────────


async def update_organization(org_id: str, *, name: Optional[str] = None) -> Optional[dict]:
    pool = await get_pool()

    if name is None:
        return await get_organization(org_id)

    row = await pool.fetchrow(
        """
        UPDATE organizations SET name = $1
        WHERE id = $2
        RETURNING id, name, created_at, updated_at
        """,
        name,
        org_id,
    )
    if not row:
        return None

    logger.info("✅ Organization updated: %s", org_id)
    return _org_to_dict(row)


# ── delete ───────────────────────────────────────────────────────────


async def delete_organization(org_id: str) -> bool:
    pool = await get_pool()
    existing = await pool.fetchrow("SELECT id FROM organizations WHERE id = $1", org_id)
    if not existing:
        return False
    await pool.execute("DELETE FROM organizations WHERE id = $1", org_id)
    logger.info("✅ Organization deleted: %s", org_id)
    return True


# ── membership ───────────────────────────────────────────────────────


async def get_user_role(org_id: str, user_id: str) -> Optional[str]:
    """Return the user's role in the org, or None if not a member."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT role FROM organization_members
        WHERE organization_id = $1 AND user_id = $2
        """,
        org_id,
        user_id,
    )
    return str(row["role"]) if row else None


async def list_members(org_id: str) -> List[dict]:
    """Return all members of an organization with user details."""
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT om.id, om.organization_id, om.user_id, om.role,
               om.created_at, om.updated_at,
               u.email, u.name AS user_name
        FROM organization_members om
        JOIN users u ON om.user_id = u.id
        WHERE om.organization_id = $1
        ORDER BY om.role, u.name
        """,
        org_id,
    )
    result = []
    for r in rows:
        d = _member_to_dict(r)
        d["email"] = r["email"]
        d["user_name"] = r["user_name"]
        result.append(d)
    return result


async def add_member(org_id: str, user_id: str, role: str = "member") -> dict:
    """Add a user to an organization. Raises ValueError on duplicate."""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        org_id,
        user_id,
    )
    if existing:
        raise ValueError("User is already a member of this organization")

    row = await pool.fetchrow(
        """
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES ($1, $2, $3)
        RETURNING id, organization_id, user_id, role, created_at, updated_at
        """,
        org_id,
        user_id,
        role,
    )
    if not row:
        raise RuntimeError("Failed to add member")

    logger.info("✅ Member %s added to org %s as %s", user_id, org_id, role)
    return _member_to_dict(row)


async def update_member_role(org_id: str, user_id: str, role: str) -> Optional[dict]:
    """Update a member's role. Returns None if not a member."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE organization_members
        SET role = $1
        WHERE organization_id = $2 AND user_id = $3
        RETURNING id, organization_id, user_id, role, created_at, updated_at
        """,
        role,
        org_id,
        user_id,
    )
    if not row:
        return None
    logger.info("✅ Member %s role updated to %s in org %s", user_id, role, org_id)
    return _member_to_dict(row)


async def remove_member(org_id: str, user_id: str) -> bool:
    """Remove a member from an organization. Returns False if not found."""
    pool = await get_pool()
    existing = await pool.fetchrow(
        "SELECT id, role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        org_id,
        user_id,
    )
    if not existing:
        return False
    if existing["role"] == "owner":
        owner_count = await pool.fetchval(
            "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND role = 'owner'",
            org_id,
        )
        if owner_count <= 1:
            raise ValueError("Cannot remove the last owner of an organization")

    await pool.execute(
        "DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        org_id,
        user_id,
    )
    logger.info("✅ Member %s removed from org %s", user_id, org_id)
    return True


async def get_org_member_ids(org_id: str) -> List[str]:
    """Return a list of user IDs for all members of an organization."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT user_id FROM organization_members WHERE organization_id = $1",
        org_id,
    )
    return [str(r["user_id"]) for r in rows]


async def find_user_by_email(email: str) -> Optional[dict]:
    """Look up a user by email. Used for adding members by email."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, email, name FROM users WHERE email = $1",
        email,
    )
    if not row:
        return None
    d = dict(row)
    d["id"] = str(d["id"])
    return d

"""
Auth service – user-related database operations.
"""

from typing import Optional

from app.config.database import get_pool
from app.utils.logger import logger


async def find_user_by_workos_id(workos_user_id: str) -> Optional[dict]:
    """Return a user row by WorkOS user ID, or None."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM users WHERE workos_user_id = $1",
        workos_user_id,
    )
    return dict(row) if row else None


async def create_user(
    *,
    workos_user_id: str,
    email: str,
    name: str,
) -> dict:
    """Insert a new user and return the row."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO users (workos_user_id, email, name) VALUES ($1, $2, $3) RETURNING *",
        workos_user_id,
        email,
        name,
    )
    if not row:
        raise RuntimeError("Failed to create user")
    logger.info("New user created: %s", email)
    return dict(row)


async def get_user_with_profile(workos_user_id: str) -> Optional[dict]:
    """Return the user joined with their profile, or None."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT u.*, p.display_name, p.bio, p.profile_image_url,
                  p.cover_image_url, p.location, p.website
           FROM users u
           LEFT JOIN profiles p ON u.id = p.user_id
           WHERE u.workos_user_id = $1""",
        workos_user_id,
    )
    return dict(row) if row else None

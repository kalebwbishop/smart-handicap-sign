"""Wire up the shared deploy-box auth module for Hazard Hero."""

from functools import lru_cache

from deploy_box.auth import AuthConfig, create_auth_dependencies, create_router

from app.config.database import get_pool
from app.config.settings import get_settings
from app.utils.logger import logger


async def _get_user_with_profile(workos_user_id: str) -> dict | None:
    """Hazard Hero ``/auth/me`` query that JOINs the profiles table."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT u.*, p.display_name, p.bio, p.profile_image_url,
                  p.cover_image_url, p.location, p.website
           FROM users u
           LEFT JOIN profiles p ON u.id = p.user_id
           WHERE u.workos_user_id = $1""",
        workos_user_id,
    )
    if row is None:
        return None
    d = dict(row)
    d["id"] = str(d["id"])
    return d


@lru_cache(maxsize=1)
def get_auth_config() -> AuthConfig:
    settings = get_settings()
    return AuthConfig(
        get_pool=get_pool,
        workos_api_key=settings.workos_api_key,
        workos_client_id=settings.workos_client_id,
        workos_redirect_uri=settings.workos_redirect_uri,
        frontend_url=settings.frontend_url,
        environment=settings.environment,
        log=logger,
        allowed_redirect_prefixes=[
            "smartsign://",
            "exp://",
            "http://localhost:",
            "http://127.0.0.1:",
            settings.frontend_url,
        ],
        get_user_profile=_get_user_with_profile,
    )


_deps_cache = None


def build_auth_dependencies():
    """Create the shared auth dependencies (get_current_user, optional_auth).

    Cached so middleware re-exports and the router share the same instances.
    """
    global _deps_cache
    if _deps_cache is None:
        _deps_cache = create_auth_dependencies(get_auth_config())
    return _deps_cache


def build_auth_router():
    """Create the auth router, sharing the same get_current_user dependency."""
    cfg = get_auth_config()
    get_current_user, _ = build_auth_dependencies()
    return create_router(cfg, get_current_user=get_current_user)

from functools import lru_cache
from urllib.parse import urljoin

import httpx
import deploy_box.auth as deploy_box_auth
from deploy_box.auth import AuthConfig, create_auth_dependencies, create_router
from deploy_box.auth import client as deploy_box_client
from deploy_box.auth import middleware as deploy_box_middleware
from deploy_box.auth import routes as deploy_box_routes
from workos import WorkOSClient

from app.config.database import get_pool
from app.config.settings import get_settings
from app.utils.logger import logger


def _configure_development_workos_client(client: WorkOSClient) -> None:
    direct_client = getattr(client, "_client", None)
    if isinstance(direct_client, httpx.Client):
        direct_client.close()
        client._client = httpx.Client(
            timeout=direct_client.timeout,
            follow_redirects=True,
            verify=False,
        )
        return

    legacy_http_client = getattr(client, "_http_client", None)
    legacy_client = getattr(legacy_http_client, "_client", None)
    if isinstance(legacy_client, httpx.Client):
        legacy_client.close()
        legacy_http_client._client = httpx.Client(
            base_url=str(legacy_client.base_url),
            timeout=legacy_client.timeout,
            follow_redirects=True,
            verify=False,
        )


def _install_workos_compatibility_shims(client: WorkOSClient) -> None:
    user_management = client.user_management

    if hasattr(user_management, "get_jwks_url"):
        return

    def _get_jwks_url() -> str:
        api_client = getattr(user_management, "_client", None)
        client_id = getattr(api_client, "client_id", None) or getattr(
            client, "client_id", None
        )
        if not client_id:
            raise RuntimeError("WorkOS client ID is required to build the JWKS URL")

        base_url = str(
            getattr(api_client, "base_url", None)
            or getattr(api_client, "_base_url", None)
            or "https://api.workos.com/"
        )
        return urljoin(base_url, f"sso/jwks/{client_id}")

    setattr(user_management, "get_jwks_url", _get_jwks_url)


def _get_compatible_workos_client(config: AuthConfig) -> WorkOSClient:
    cached_client = deploy_box_client._clients.get(config.workos_client_id)
    if cached_client is not None:
        return cached_client

    if not config.workos_api_key:
        config.log.warning(
            "WorkOS API key not configured. Authentication endpoints will not work."
        )

    client = WorkOSClient(
        api_key=config.workos_api_key or "not-configured",
        client_id=config.workos_client_id,
    )

    if config.environment == "development":
        _configure_development_workos_client(client)

    _install_workos_compatibility_shims(client)
    deploy_box_client._clients[config.workos_client_id] = client
    return client


deploy_box_client.get_workos_client = _get_compatible_workos_client
deploy_box_routes.get_workos_client = _get_compatible_workos_client
deploy_box_middleware.get_workos_client = _get_compatible_workos_client
deploy_box_auth.get_workos_client = _get_compatible_workos_client


async def _get_user_with_profile(workos_user_id: str) -> dict | None:
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
            "hazardhero://",
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
    global _deps_cache
    if _deps_cache is None:
        _deps_cache = create_auth_dependencies(get_auth_config())
    return _deps_cache


def build_auth_router():
    cfg = get_auth_config()
    get_current_user, _ = build_auth_dependencies()
    return create_router(cfg, get_current_user=get_current_user)

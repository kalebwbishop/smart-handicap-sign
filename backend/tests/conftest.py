"""Shared fixtures for security tests.

All external dependencies (database, WorkOS, services) are mocked so the
tests exercise only route-level authorization logic — no real I/O required.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from types import ModuleType

from fastapi import HTTPException, status
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


def _install_deploy_box_stub() -> None:
    if "deploy_box.auth" in sys.modules:
        return

    deploy_box_module = ModuleType("deploy_box")
    auth_module = ModuleType("deploy_box.auth")
    client_module = ModuleType("deploy_box.auth.client")
    middleware_module = ModuleType("deploy_box.auth.middleware")
    routes_module = ModuleType("deploy_box.auth.routes")

    @dataclass
    class CurrentUser:
        id: str
        workos_user_id: str
        email: str
        name: str
        session_id: str

    @dataclass
    class AuthConfig:
        get_pool: object
        workos_api_key: str
        workos_client_id: str
        workos_redirect_uri: str
        frontend_url: str
        environment: str
        log: object
        allowed_redirect_prefixes: list[str]
        get_user_profile: object

    async def _get_current_user():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )

    def create_auth_dependencies(_config):
        return _get_current_user, _get_current_user

    def create_router(_config, **_kwargs):
        from fastapi import APIRouter

        return APIRouter()

    client_module._clients = {}
    client_module.get_workos_client = lambda *args, **kwargs: None
    middleware_module.get_workos_client = lambda *args, **kwargs: None
    routes_module.get_workos_client = lambda *args, **kwargs: None

    auth_module.CurrentUser = CurrentUser
    auth_module.AuthConfig = AuthConfig
    auth_module.create_auth_dependencies = create_auth_dependencies
    auth_module.create_router = create_router
    auth_module.client = client_module
    auth_module.middleware = middleware_module
    auth_module.routes = routes_module
    auth_module.get_workos_client = lambda *args, **kwargs: None

    sys.modules["deploy_box"] = deploy_box_module
    sys.modules["deploy_box.auth"] = auth_module
    sys.modules["deploy_box.auth.client"] = client_module
    sys.modules["deploy_box.auth.middleware"] = middleware_module
    sys.modules["deploy_box.auth.routes"] = routes_module


_install_deploy_box_stub()

from app.middleware.auth import CurrentUser


# ── fake users ───────────────────────────────────────────────────────

USER_ALICE = CurrentUser(
    id="user-alice",
    workos_user_id="wos-alice",
    email="alice@example.com",
    name="Alice Tester",
    session_id="sess-alice",
)

USER_BOB = CurrentUser(
    id="user-bob",
    workos_user_id="wos-bob",
    email="bob@example.com",
    name="Bob Outsider",
    session_id="sess-bob",
)


def _override_auth(user: CurrentUser):
    """Return a FastAPI dependency override that always resolves to *user*."""
    async def _fake_get_current_user():
        return user
    return _fake_get_current_user


# ── app fixture ──────────────────────────────────────────────────────


@pytest.fixture()
def app():
    """Import the FastAPI app with database pool creation disabled."""
    with patch("app.config.database.get_pool", new_callable=AsyncMock):
        from app.main import app as _app
        yield _app


@pytest.fixture()
def client_alice(app):
    """Test client authenticated as Alice (org member)."""
    from app.middleware.auth import get_current_user
    app.dependency_overrides.clear()
    app.dependency_overrides[get_current_user] = _override_auth(USER_ALICE)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def client_bob(app):
    """Test client authenticated as Bob (non-member)."""
    from app.middleware.auth import get_current_user
    app.dependency_overrides.clear()
    app.dependency_overrides[get_current_user] = _override_auth(USER_BOB)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def client_anon(app):
    """Unauthenticated test client."""
    app.dependency_overrides.clear()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()

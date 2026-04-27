"""Shared fixtures for security tests.

All external dependencies (database, WorkOS, services) are mocked so the
tests exercise only route-level authorization logic — no real I/O required.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

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
    app.dependency_overrides[get_current_user] = _override_auth(USER_ALICE)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def client_bob(app):
    """Test client authenticated as Bob (non-member)."""
    from app.middleware.auth import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(USER_BOB)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def client_anon(app):
    """Unauthenticated test client."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()

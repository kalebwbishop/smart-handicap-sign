"""Regression tests for WorkOS SDK compatibility shims."""

from __future__ import annotations

from deploy_box.auth import AuthConfig
from deploy_box.auth import client as deploy_box_client

from app.config.auth import _get_compatible_workos_client
from app.utils.logger import logger


async def _unused_pool():
    raise AssertionError("database access is not expected in this test")


def test_compatible_workos_client_exposes_legacy_jwks_url_helper():
    client_id = "client_compat_test"
    deploy_box_client._clients.pop(client_id, None)

    cfg = AuthConfig(
        get_pool=_unused_pool,
        workos_api_key="test-api-key",
        workos_client_id=client_id,
        workos_redirect_uri="https://example.com/auth/callback",
        frontend_url="https://example.com",
        environment="test",
        log=logger,
    )

    client = _get_compatible_workos_client(cfg)

    assert hasattr(client.user_management, "get_jwks_url")
    assert (
        client.user_management.get_jwks_url()
        == f"https://api.workos.com/sso/jwks/{client_id}"
    )

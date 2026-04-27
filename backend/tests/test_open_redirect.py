"""Tests for the OAuth callback open-redirect fix.

Verifies that the ``/auth/callback`` endpoint only redirects to
URLs matching the configured ``allowed_redirect_prefixes`` and rejects
attacker-controlled destinations.
"""

from __future__ import annotations

import base64
import json

import pytest
from unittest.mock import patch, AsyncMock

from app.config.auth import get_auth_config


# ── helpers ──────────────────────────────────────────────────────────


def _encode_state(redirect_uri: str) -> str:
    """Build the base64 state param the client would send."""
    return base64.urlsafe_b64encode(
        json.dumps({"redirect_uri": redirect_uri}).encode()
    ).decode()


# ── allowed redirects ────────────────────────────────────────────────


class TestAllowedRedirects:
    """Requests whose redirect_uri matches the allowlist MUST succeed."""

    @pytest.mark.parametrize(
        "uri",
        [
            "smartsign://callback",
            "exp://192.168.1.5:8081/--/auth",
            "http://localhost:8081/auth",
            "http://127.0.0.1:19006/callback",
        ],
    )
    def test_allowed_redirect_returns_302(self, client_anon, uri):
        state = _encode_state(uri)
        resp = client_anon.get(
            "/api/v1/auth/callback",
            params={"code": "test-code", "state": state},
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert uri in resp.headers["location"]
        assert "code=test-code" in resp.headers["location"]


# ── blocked redirects ────────────────────────────────────────────────


class TestBlockedRedirects:
    """Requests with an evil redirect MUST be rejected with 400."""

    @pytest.mark.parametrize(
        "uri",
        [
            "https://evil.com/steal",
            "javascript:alert(1)",
            "http://attacker.example.com/phish",
            "ftp://malicious.host/payload",
            # almost-valid — missing the trailing colon/slash
            "smartsignx://callback",
        ],
    )
    def test_malicious_redirect_returns_400(self, client_anon, uri):
        state = _encode_state(uri)
        resp = client_anon.get(
            "/api/v1/auth/callback",
            params={"code": "test-code", "state": state},
            follow_redirects=False,
        )
        assert resp.status_code == 400
        assert "Invalid redirect" in resp.json()["message"]


# ── edge cases ───────────────────────────────────────────────────────


class TestCallbackEdgeCases:
    """Edge-case behavior for the callback endpoint."""

    def test_no_state_redirects_to_frontend(self, client_anon):
        """No state → redirect to frontend_url/home?code=..."""
        resp = client_anon.get(
            "/api/v1/auth/callback",
            params={"code": "abc123"},
            follow_redirects=False,
        )
        assert resp.status_code == 302
        loc = resp.headers["location"]
        assert "/home" in loc
        assert "code=abc123" in loc

    def test_missing_code_returns_400(self, client_anon):
        resp = client_anon.get("/api/v1/auth/callback")
        assert resp.status_code == 400
        assert "code" in resp.json()["message"].lower()

    def test_corrupt_state_falls_through_to_frontend(self, client_anon):
        """Corrupt base64 state → graceful fallback to frontend redirect."""
        resp = client_anon.get(
            "/api/v1/auth/callback",
            params={"code": "c", "state": "~~~not-base64~~~"},
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert "/home" in resp.headers["location"]

    def test_allowlist_is_not_empty(self):
        """Sanity: the allowlist must contain at least one entry."""
        cfg = get_auth_config()
        assert len(cfg.allowed_redirect_prefixes) > 0

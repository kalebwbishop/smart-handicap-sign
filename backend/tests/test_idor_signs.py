"""Tests for IDOR protection on ``/api/v1/signs`` endpoints.

Verifies that ``_require_sign_access`` blocks users who are not members
of the sign's organization.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from tests.conftest import USER_ALICE, USER_BOB


# ── fake data ────────────────────────────────────────────────────────

_NOW = datetime.now(timezone.utc).isoformat()

SIGN_IN_ORG = {
    "id": "sign-1",
    "name": "Lobby Sign",
    "location": "Building A",
    "status": "available",
    "last_updated": _NOW,
    "organization_id": "org-1",
}

SIGN_NO_ORG = {
    "id": "sign-2",
    "name": "Public Sign",
    "location": "Park",
    "status": "available",
    "last_updated": _NOW,
    "organization_id": None,
}


# ── GET /signs/{id} ─────────────────────────────────────────────────


class TestGetSign:
    """Only org members may view a sign that belongs to an organization."""

    @patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_member_can_view_sign(self, mock_get, mock_role, client_alice):
        mock_get.return_value = SIGN_IN_ORG
        mock_role.return_value = "member"

        resp = client_alice.get("/api/v1/signs/sign-1")
        assert resp.status_code == 200
        assert resp.json()["id"] == "sign-1"

    @patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_non_member_gets_403(self, mock_get, mock_role, client_bob):
        mock_get.return_value = SIGN_IN_ORG
        mock_role.return_value = None  # Bob is not in the org

        resp = client_bob.get("/api/v1/signs/sign-1")
        assert resp.status_code == 403
        assert "Not a member" in resp.json()["detail"]

    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_not_found_returns_404(self, mock_get, client_alice):
        mock_get.return_value = None

        resp = client_alice.get("/api/v1/signs/nonexistent")
        assert resp.status_code == 404

    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_sign_without_org_is_accessible(self, mock_get, client_bob):
        """Signs with no organization_id are accessible to any authenticated user."""
        mock_get.return_value = SIGN_NO_ORG

        resp = client_bob.get("/api/v1/signs/sign-2")
        assert resp.status_code == 200


# ── PATCH /signs/{id} ───────────────────────────────────────────────


class TestUpdateSign:
    @patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_non_member_cannot_update(self, mock_get, mock_update, mock_role, client_bob):
        mock_get.return_value = SIGN_IN_ORG
        mock_role.return_value = None

        resp = client_bob.patch("/api/v1/signs/sign-1", json={"name": "Hacked"})
        assert resp.status_code == 403
        mock_update.assert_not_called()

    @patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_member_can_update(self, mock_get, mock_update, mock_role, client_alice):
        mock_get.return_value = SIGN_IN_ORG
        mock_role.return_value = "admin"
        mock_update.return_value = {**SIGN_IN_ORG, "name": "Renamed"}

        resp = client_alice.patch("/api/v1/signs/sign-1", json={"name": "Renamed"})
        assert resp.status_code == 200


# ── DELETE /signs/{id} ──────────────────────────────────────────────


class TestDeleteSign:
    @patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.delete_sign", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_non_member_cannot_delete(self, mock_get, mock_del, mock_role, client_bob):
        mock_get.return_value = SIGN_IN_ORG
        mock_role.return_value = None

        resp = client_bob.delete("/api/v1/signs/sign-1")
        assert resp.status_code == 403
        mock_del.assert_not_called()


# ── POST /signs/{id}/acknowledge ────────────────────────────────────


class TestAcknowledgeSign:
    @patch("app.routes.signs.event_service.create_event", new_callable=AsyncMock)
    @patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_non_member_cannot_acknowledge(self, mock_get, mock_upd, mock_role, mock_evt, client_bob):
        mock_get.return_value = {**SIGN_IN_ORG, "status": "assistance_requested"}
        mock_role.return_value = None

        resp = client_bob.post("/api/v1/signs/sign-1/acknowledge")
        assert resp.status_code == 403
        mock_upd.assert_not_called()


# ── POST /signs/{id}/resolve ────────────────────────────────────────


class TestResolveSign:
    @patch("app.routes.signs.event_service.create_event", new_callable=AsyncMock)
    @patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
    def test_non_member_cannot_resolve(self, mock_get, mock_upd, mock_role, mock_evt, client_bob):
        mock_get.return_value = {**SIGN_IN_ORG, "status": "assistance_in_progress"}
        mock_role.return_value = None

        resp = client_bob.post("/api/v1/signs/sign-1/resolve")
        assert resp.status_code == 403
        mock_upd.assert_not_called()

"""Tests for IDOR protection on ``/api/v1/events`` endpoints.

Verifies that ``_require_event_access`` blocks users who are not members
of the organization owning the sign associated with each event, and that
``list_events`` is scoped to the caller's orgs.
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

EVENT = {
    "id": "evt-1",
    "sign_id": "sign-1",
    "type": "alert",
    "data": {},
    "created_at": _NOW,
    "updated_at": _NOW,
}


# ── GET /events/{id} ────────────────────────────────────────────────


class TestGetEvent:
    @patch("app.routes.events.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.get_event", new_callable=AsyncMock)
    def test_member_can_view(self, mock_evt, mock_sign, mock_role, client_alice):
        mock_evt.return_value = EVENT
        mock_sign.return_value = SIGN_IN_ORG
        mock_role.return_value = "member"

        resp = client_alice.get("/api/v1/events/evt-1")
        assert resp.status_code == 200
        assert resp.json()["id"] == "evt-1"

    @patch("app.routes.events.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.get_event", new_callable=AsyncMock)
    def test_non_member_gets_403(self, mock_evt, mock_sign, mock_role, client_bob):
        mock_evt.return_value = EVENT
        mock_sign.return_value = SIGN_IN_ORG
        mock_role.return_value = None

        resp = client_bob.get("/api/v1/events/evt-1")
        assert resp.status_code == 403

    @patch("app.routes.events.event_service.get_event", new_callable=AsyncMock)
    def test_not_found_returns_404(self, mock_evt, client_alice):
        mock_evt.return_value = None

        resp = client_alice.get("/api/v1/events/missing")
        assert resp.status_code == 404


# ── POST /events ─────────────────────────────────────────────────────


class TestCreateEvent:
    @patch("app.routes.events.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.create_event", new_callable=AsyncMock)
    def test_non_member_cannot_create_event(self, mock_create, mock_sign, mock_role, client_bob):
        mock_sign.return_value = SIGN_IN_ORG
        mock_role.return_value = None

        resp = client_bob.post("/api/v1/events", json={
            "sign_id": "sign-1",
            "type": "alert",
        })
        assert resp.status_code == 403
        mock_create.assert_not_called()

    @patch("app.routes.events.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.create_event", new_callable=AsyncMock)
    def test_member_can_create_event(self, mock_create, mock_sign, mock_role, client_alice):
        mock_sign.return_value = SIGN_IN_ORG
        mock_role.return_value = "member"
        mock_create.return_value = EVENT

        resp = client_alice.post("/api/v1/events", json={
            "sign_id": "sign-1",
            "type": "alert",
        })
        assert resp.status_code == 201

    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    def test_create_event_for_nonexistent_sign_returns_404(self, mock_sign, client_alice):
        mock_sign.return_value = None

        resp = client_alice.post("/api/v1/events", json={
            "sign_id": "missing",
            "type": "alert",
        })
        assert resp.status_code == 404


# ── PATCH /events/{id} ──────────────────────────────────────────────


class TestUpdateEvent:
    @patch("app.routes.events.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.update_event", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.get_event", new_callable=AsyncMock)
    def test_non_member_cannot_update(self, mock_get, mock_upd, mock_sign, mock_role, client_bob):
        mock_get.return_value = EVENT
        mock_sign.return_value = SIGN_IN_ORG
        mock_role.return_value = None

        resp = client_bob.patch("/api/v1/events/evt-1", json={"type": "maintenance"})
        assert resp.status_code == 403
        mock_upd.assert_not_called()


# ── DELETE /events/{id} ─────────────────────────────────────────────


class TestDeleteEvent:
    @patch("app.routes.events.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.delete_event", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.get_event", new_callable=AsyncMock)
    def test_non_member_cannot_delete(self, mock_get, mock_del, mock_sign, mock_role, client_bob):
        mock_get.return_value = EVENT
        mock_sign.return_value = SIGN_IN_ORG
        mock_role.return_value = None

        resp = client_bob.delete("/api/v1/events/evt-1")
        assert resp.status_code == 403
        mock_del.assert_not_called()


# ── GET /events/{id}/notifications ──────────────────────────────────


class TestEventNotifications:
    @patch("app.routes.events.organization_service.get_user_role", new_callable=AsyncMock)
    @patch("app.routes.events.sign_service.get_sign", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.get_event_notifications", new_callable=AsyncMock)
    @patch("app.routes.events.event_service.get_event", new_callable=AsyncMock)
    def test_non_member_cannot_view_notifications(self, mock_get, mock_notifs, mock_sign, mock_role, client_bob):
        mock_get.return_value = EVENT
        mock_sign.return_value = SIGN_IN_ORG
        mock_role.return_value = None

        resp = client_bob.get("/api/v1/events/evt-1/notifications")
        assert resp.status_code == 403
        mock_notifs.assert_not_called()


# ── GET /events (list scoping) ──────────────────────────────────────


class TestListEvents:
    @patch("app.routes.events.event_service.list_events", new_callable=AsyncMock)
    def test_list_passes_user_id_for_scoping(self, mock_list, client_alice):
        """The list endpoint must forward the current user's id for org scoping."""
        mock_list.return_value = []

        resp = client_alice.get("/api/v1/events")
        assert resp.status_code == 200

        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args[1]
        assert call_kwargs["user_id"] == USER_ALICE.id

"""Tests for IDOR protection on ``/api/v1/notifications`` endpoints.

Verifies that ``_require_notification_ownership`` blocks users from
accessing notifications they do not own.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from tests.conftest import USER_ALICE, USER_BOB


# ── fake data ────────────────────────────────────────────────────────

_NOW = datetime.now(timezone.utc).isoformat()

NOTIF_ALICE = {
    "id": "notif-1",
    "event_id": "evt-1",
    "user_id": "user-alice",
    "title": "Alert",
    "body": "Something happened",
    "read": False,
    "created_at": _NOW,
    "updated_at": _NOW,
}

NOTIF_BOB = {
    "id": "notif-2",
    "event_id": "evt-2",
    "user_id": "user-bob",
    "title": "Bob's Alert",
    "body": "Bob's notification",
    "read": False,
    "created_at": _NOW,
    "updated_at": _NOW,
}


# ── GET /notifications/{id} ─────────────────────────────────────────


class TestGetNotification:
    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    def test_owner_can_view(self, mock_get, client_alice):
        mock_get.return_value = NOTIF_ALICE

        resp = client_alice.get("/api/v1/notifications/notif-1")
        assert resp.status_code == 200
        assert resp.json()["id"] == "notif-1"

    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    def test_non_owner_gets_403(self, mock_get, client_bob):
        mock_get.return_value = NOTIF_ALICE  # Alice's notification

        resp = client_bob.get("/api/v1/notifications/notif-1")
        assert resp.status_code == 403
        assert "Not your notification" in resp.json()["detail"]

    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    def test_not_found_returns_404(self, mock_get, client_alice):
        mock_get.return_value = None

        resp = client_alice.get("/api/v1/notifications/missing")
        assert resp.status_code == 404


# ── PATCH /notifications/{id} ───────────────────────────────────────


class TestUpdateNotification:
    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    @patch("app.routes.notifications.notification_service.update_notification", new_callable=AsyncMock)
    def test_non_owner_cannot_update(self, mock_upd, mock_get, client_bob):
        mock_get.return_value = NOTIF_ALICE

        resp = client_bob.patch("/api/v1/notifications/notif-1", json={"read": True})
        assert resp.status_code == 403
        mock_upd.assert_not_called()

    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    @patch("app.routes.notifications.notification_service.update_notification", new_callable=AsyncMock)
    def test_owner_can_update(self, mock_upd, mock_get, client_alice):
        mock_get.return_value = NOTIF_ALICE
        mock_upd.return_value = {**NOTIF_ALICE, "read": True}

        resp = client_alice.patch("/api/v1/notifications/notif-1", json={"read": True})
        assert resp.status_code == 200
        assert resp.json()["read"] is True


# ── POST /notifications/{id}/read ───────────────────────────────────


class TestMarkAsRead:
    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    @patch("app.routes.notifications.notification_service.mark_as_read", new_callable=AsyncMock)
    def test_non_owner_cannot_mark_read(self, mock_mark, mock_get, client_bob):
        mock_get.return_value = NOTIF_ALICE

        resp = client_bob.post("/api/v1/notifications/notif-1/read")
        assert resp.status_code == 403
        mock_mark.assert_not_called()

    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    @patch("app.routes.notifications.notification_service.mark_as_read", new_callable=AsyncMock)
    def test_owner_can_mark_read(self, mock_mark, mock_get, client_alice):
        mock_get.return_value = NOTIF_ALICE
        mock_mark.return_value = {**NOTIF_ALICE, "read": True}

        resp = client_alice.post("/api/v1/notifications/notif-1/read")
        assert resp.status_code == 200


# ── DELETE /notifications/{id} ──────────────────────────────────────


class TestDeleteNotification:
    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    @patch("app.routes.notifications.notification_service.delete_notification", new_callable=AsyncMock)
    def test_non_owner_cannot_delete(self, mock_del, mock_get, client_bob):
        mock_get.return_value = NOTIF_ALICE

        resp = client_bob.delete("/api/v1/notifications/notif-1")
        assert resp.status_code == 403
        mock_del.assert_not_called()

    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    @patch("app.routes.notifications.notification_service.delete_notification", new_callable=AsyncMock)
    def test_owner_can_delete(self, mock_del, mock_get, client_alice):
        mock_get.return_value = NOTIF_ALICE
        mock_del.return_value = True

        resp = client_alice.delete("/api/v1/notifications/notif-1")
        assert resp.status_code == 204


# ── POST /notifications (create) ────────────────────────────────────


class TestCreateNotification:
    @patch("app.routes.notifications.notification_service.create_notification", new_callable=AsyncMock)
    def test_create_binds_to_current_user(self, mock_create, client_alice):
        """POST /notifications must set user_id to the authenticated user."""
        mock_create.return_value = NOTIF_ALICE

        resp = client_alice.post("/api/v1/notifications", json={
            "title": "Test",
            "body": "Body",
        })
        assert resp.status_code == 201

        call_kwargs = mock_create.call_args[1]
        assert call_kwargs["user_id"] == USER_ALICE.id


# ── Cross-user isolation ────────────────────────────────────────────


class TestCrossUserIsolation:
    """Verify user A cannot touch user B's notification and vice-versa."""

    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    def test_alice_cannot_view_bobs_notification(self, mock_get, client_alice):
        mock_get.return_value = NOTIF_BOB

        resp = client_alice.get("/api/v1/notifications/notif-2")
        assert resp.status_code == 403

    @patch("app.routes.notifications.notification_service.get_notification", new_callable=AsyncMock)
    def test_bob_cannot_view_alices_notification(self, mock_get, client_bob):
        mock_get.return_value = NOTIF_ALICE

        resp = client_bob.get("/api/v1/notifications/notif-1")
        assert resp.status_code == 403

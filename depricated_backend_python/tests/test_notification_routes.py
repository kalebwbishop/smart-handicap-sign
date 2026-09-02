from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch


def _notification(read: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": "notif-1",
        "device_event_id": "evt-1",
        "user_id": "user-alice",
        "title": "Assistance requested",
        "body": "Pilot Handicap Sign is requesting assistance.",
        "read": read,
        "device_event_correct_response": True,
        "created_at": now,
        "updated_at": now,
    }


def _preferences() -> dict:
    return {
        "user_id": "user-alice",
        "assistance_requests_enabled": True,
        "push_enabled": True,
    }


class TestNotificationRoutes:
    @patch("app.routes.notifications.notification_service.list_notifications", new_callable=AsyncMock)
    def test_list_notifications_requires_auth(self, mock_list, client_anon):
        response = client_anon.get("/api/v1/notifications")

        assert response.status_code == 401
        mock_list.assert_not_called()

    @patch("app.routes.notifications.notification_service.list_notifications", new_callable=AsyncMock)
    def test_list_notifications_returns_current_user_notifications(self, mock_list, client_alice):
        mock_list.return_value = [_notification()]

        response = client_alice.get("/api/v1/notifications")

        assert response.status_code == 200
        assert response.json()[0]["id"] == "notif-1"
        assert response.json()[0]["device_event_correct_response"] is True
        mock_list.assert_awaited_once()

    @patch("app.routes.notifications.notification_service.get_unread_count", new_callable=AsyncMock)
    def test_get_unread_count_returns_count(self, mock_count, client_alice):
        mock_count.return_value = 3

        response = client_alice.get("/api/v1/notifications/unread/count")

        assert response.status_code == 200
        assert response.json() == {"unread_count": 3}

    @patch("app.routes.notifications.notification_service.mark_notification_read", new_callable=AsyncMock)
    def test_mark_notification_read_returns_notification(self, mock_mark, client_alice):
        mock_mark.return_value = _notification(read=True)

        response = client_alice.post("/api/v1/notifications/notif-1/read")

        assert response.status_code == 200
        assert response.json()["read"] is True
        assert response.json()["device_event_correct_response"] is True

    @patch("app.routes.notifications.notification_service.mark_notification_read", new_callable=AsyncMock)
    def test_mark_notification_read_returns_404_for_missing_notification(self, mock_mark, client_alice):
        mock_mark.return_value = None

        response = client_alice.post("/api/v1/notifications/missing/read")

        assert response.status_code == 404

    @patch("app.routes.notifications.notification_service.mark_all_notifications_read", new_callable=AsyncMock)
    def test_mark_all_notifications_read_returns_count(self, mock_mark_all, client_alice):
        mock_mark_all.return_value = 2

        response = client_alice.post("/api/v1/notifications/read-all")

        assert response.status_code == 200
        assert response.json() == {"marked_read": 2}

    @patch("app.routes.notifications.notification_service.get_notification_preferences", new_callable=AsyncMock)
    def test_get_notification_preferences_returns_current_settings(self, mock_get_preferences, client_alice):
        mock_get_preferences.return_value = _preferences()

        response = client_alice.get("/api/v1/notifications/preferences")

        assert response.status_code == 200
        assert response.json() == {
            "assistance_requests_enabled": True,
            "push_enabled": True,
        }

    @patch("app.routes.notifications.notification_service.update_notification_preferences", new_callable=AsyncMock)
    def test_update_notification_preferences_returns_updated_settings(self, mock_update_preferences, client_alice):
        mock_update_preferences.return_value = {
            "user_id": "user-alice",
            "assistance_requests_enabled": False,
            "push_enabled": True,
        }

        response = client_alice.patch(
            "/api/v1/notifications/preferences",
            json={"assistance_requests_enabled": False},
        )

        assert response.status_code == 200
        assert response.json() == {
            "assistance_requests_enabled": False,
            "push_enabled": True,
        }


class TestPushTokenRoutes:
    @patch("app.routes.push_tokens.notification_service.register_push_token", new_callable=AsyncMock)
    def test_register_push_token_requires_auth(self, mock_register, client_anon):
        response = client_anon.post(
            "/api/v1/push-tokens",
            json={"expo_push_token": "ExponentPushToken[abc]"},
        )

        assert response.status_code == 401
        mock_register.assert_not_called()

    @patch("app.routes.push_tokens.notification_service.register_push_token", new_callable=AsyncMock)
    def test_register_push_token_returns_registered_token(self, mock_register, client_alice):
        mock_register.return_value = {"expo_push_token": "ExponentPushToken[abc]"}

        response = client_alice.post(
            "/api/v1/push-tokens",
            json={"expo_push_token": "ExponentPushToken[abc]"},
        )

        assert response.status_code == 200
        assert response.json() == {"expo_push_token": "ExponentPushToken[abc]"}

    @patch("app.routes.push_tokens.notification_service.unregister_push_token", new_callable=AsyncMock)
    def test_unregister_push_token_returns_removed_state(self, mock_unregister, client_alice):
        mock_unregister.return_value = True

        response = client_alice.request(
            "DELETE",
            "/api/v1/push-tokens",
            json={"expo_push_token": "ExponentPushToken[abc]"},
        )

        assert response.status_code == 200
        assert response.json() == {"removed": True}

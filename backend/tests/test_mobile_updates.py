from __future__ import annotations

import asyncio
import json
from unittest.mock import patch

from app.services.live_updates import (
    MOBILE_HOME_UPDATES_CHANNEL,
    _should_forward_mobile_home_update,
    publish_mobile_home_update_with_conn,
)


class _FakeConn:
    def __init__(self):
        self.fetchval_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchval(self, query: str, *args):
        self.fetchval_calls.append((query, args))
        return 1


def test_should_forward_notification_updates_only_for_matching_user():
    assert _should_forward_mobile_home_update(
        user_id="user-alice",
        payload={"scope": "notifications", "user_id": "user-alice"},
    )
    assert not _should_forward_mobile_home_update(
        user_id="user-alice",
        payload={"scope": "notifications", "user_id": "user-bob"},
    )


def test_should_forward_device_status_updates_to_all_subscribers():
    assert _should_forward_mobile_home_update(
        user_id="user-alice",
        payload={"scope": "device_status", "serial_number": "SHS-1"},
    )


def test_publish_mobile_home_update_with_conn_uses_pg_notify():
    conn = _FakeConn()

    asyncio.run(
        publish_mobile_home_update_with_conn(
            conn,
            scope="device_status",
            payload={"serial_number": "SHS-1", "new_status": "assistance_requested"},
        )
    )

    assert len(conn.fetchval_calls) == 1
    query, args = conn.fetchval_calls[0]
    assert "pg_notify" in query
    assert args[0] == MOBILE_HOME_UPDATES_CHANNEL
    payload = json.loads(args[1])
    assert payload["scope"] == "device_status"
    assert payload["serial_number"] == "SHS-1"
    assert payload["new_status"] == "assistance_requested"
    assert "occurred_at" in payload


def _finite_stream(*, user_id: str, request):
    del user_id, request

    async def _generator():
        yield b"data: {\"scope\":\"notifications\"}\n\n"

    return _generator()


class TestMobileUpdatesRoutes:
    @patch("app.routes.mobile_updates.stream_mobile_home_updates", new=_finite_stream)
    def test_mobile_updates_route_requires_auth(self, client_anon):
        response = client_anon.get("/api/v1/mobile/home/updates")

        assert response.status_code == 401

    @patch("app.routes.mobile_updates.stream_mobile_home_updates", new=_finite_stream)
    def test_mobile_updates_route_returns_event_stream(self, client_alice):
        response = client_alice.get("/api/v1/mobile/home/updates")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert "data: {\"scope\":\"notifications\"}" in response.text

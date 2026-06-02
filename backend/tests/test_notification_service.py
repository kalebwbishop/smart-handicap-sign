"""Tests for notification service SQL helpers."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.services import notification_service


def _notification_row(*, kind: str, title: str, body: str, read: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": "notif-1",
        "user_id": "user-alice",
        "device_id": "device-1",
        "device_event_id": "event-1",
        "kind": kind,
        "title": title,
        "body": body,
        "read": read,
        "created_at": now,
        "updated_at": now,
        "device_event_correct_response": True,
    }


class _FakeConn:
    def __init__(self, rows: list[dict] | None = None, row: dict | None = None, count: int | None = None):
        self.rows = rows
        self.row = row
        self.count = count
        self.last_query: str | None = None
        self.last_args: tuple[object, ...] | None = None
        self.last_fetch_query: str | None = None
        self.last_fetch_args: tuple[object, ...] | None = None
        self.last_fetchrow_query: str | None = None
        self.last_fetchrow_args: tuple[object, ...] | None = None
        self.last_fetchval_query: str | None = None
        self.last_fetchval_args: tuple[object, ...] | None = None
        self.notify_calls: list[tuple[str, str]] = []

    async def fetch(self, query: str, *args):
        self.last_query = query
        self.last_args = args
        self.last_fetch_query = query
        self.last_fetch_args = args
        return self.rows or []

    async def fetchrow(self, query: str, *args):
        self.last_query = query
        self.last_args = args
        self.last_fetchrow_query = query
        self.last_fetchrow_args = args
        return self.row

    async def fetchval(self, query: str, *args):
        self.last_query = query
        self.last_args = args
        self.last_fetchval_query = query
        self.last_fetchval_args = args
        if "pg_notify" in query.lower():
            self.notify_calls.append((args[0], args[1]))
            return 1
        return self.count or 0

    def transaction(self):
        return _FakeTransaction()


class _FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeAcquire:
    def __init__(self, conn: _FakeConn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakePool:
    def __init__(self, conn: _FakeConn):
        self.conn = conn

    def acquire(self):
        return _FakeAcquire(self.conn)


def test_create_assistance_request_notifications_uses_inserted_cte():
    conn = _FakeConn(
        [
            _notification_row(
                kind="assistance_requested",
                title="Assistance requested",
                body="Pilot Handicap Sign is requesting assistance.",
            )
        ]
    )

    rows = asyncio.run(
        notification_service.create_assistance_request_notifications_with_conn(
            conn,
            device_id="device-1",
            device_event_id="event-1",
            serial_number="SHS-2605-S01-A7K-00001-J",
            device_name="Pilot Handicap Sign",
        )
    )

    assert rows[0]["id"] == "notif-1"
    assert rows[0]["device_event_correct_response"] is True
    assert conn.last_fetch_args == (
        "device-1",
        "event-1",
        "assistance_requested",
        "Assistance requested",
        "Pilot Handicap Sign is requesting assistance.",
    )
    assert conn.last_fetch_query is not None
    assert "WITH inserted AS (" in conn.last_fetch_query
    assert "RETURNING *" in conn.last_fetch_query
    assert "FROM inserted n" in conn.last_fetch_query
    assert len(conn.notify_calls) == 1
    channel, payload = conn.notify_calls[0]
    assert channel == "mobile_home_updates"
    notification_update = json.loads(payload)
    assert notification_update["scope"] == "notifications"
    assert notification_update["action"] == "created"
    assert notification_update["notification_id"] == "notif-1"
    assert notification_update["user_id"] == "user-alice"


def test_create_device_offline_notifications_uses_inserted_cte():
    conn = _FakeConn(
        [
            _notification_row(
                kind="device_offline",
                title="Device offline",
                body="Pilot Handicap Sign has not checked in recently and was marked offline.",
            )
        ]
    )

    rows = asyncio.run(
        notification_service.create_device_offline_notifications_with_conn(
            conn,
            device_id="device-1",
            device_event_id="event-2",
            serial_number="SHS-2605-S01-A7K-00001-J",
            device_name="Pilot Handicap Sign",
        )
    )

    assert rows[0]["kind"] == "device_offline"
    assert conn.last_fetch_args == (
        "device-1",
        "event-2",
        "device_offline",
        "Device offline",
        "Pilot Handicap Sign has not checked in recently and was marked offline.",
    )
    assert conn.last_fetch_query is not None
    assert "WITH inserted AS (" in conn.last_fetch_query
    assert "RETURNING *" in conn.last_fetch_query
    assert "FROM inserted n" in conn.last_fetch_query
    assert len(conn.notify_calls) == 1
    channel, payload = conn.notify_calls[0]
    assert channel == "mobile_home_updates"
    notification_update = json.loads(payload)
    assert notification_update["scope"] == "notifications"
    assert notification_update["action"] == "created"
    assert notification_update["notification_id"] == "notif-1"
    assert notification_update["user_id"] == "user-alice"


@patch("app.services.notification_service.publish_mobile_home_update_with_conn", new_callable=AsyncMock)
@patch("app.services.notification_service.get_pool", new_callable=AsyncMock)
def test_mark_notification_read_publishes_update(mock_get_pool, mock_publish):
    conn = _FakeConn(row=_notification_row(kind="assistance_requested", title="Assistance requested", body="Pilot Handicap Sign is requesting assistance.", read=True))
    mock_get_pool.return_value = _FakePool(conn)

    notification = asyncio.run(
        notification_service.mark_notification_read(
            notification_id="notif-1",
            user_id="user-alice",
        )
    )

    assert notification is not None
    assert notification["read"] is True
    mock_publish.assert_awaited_once()
    assert mock_publish.await_args.args[0] is conn
    assert mock_publish.await_args.kwargs["scope"] == "notifications"
    assert mock_publish.await_args.kwargs["payload"] == {
        "action": "read",
        "notification_id": "notif-1",
        "user_id": "user-alice",
    }


@patch("app.services.notification_service.publish_mobile_home_update_with_conn", new_callable=AsyncMock)
@patch("app.services.notification_service.get_pool", new_callable=AsyncMock)
def test_mark_all_notifications_read_publishes_update(mock_get_pool, mock_publish):
    conn = _FakeConn(count=2)
    mock_get_pool.return_value = _FakePool(conn)

    marked_read = asyncio.run(notification_service.mark_all_notifications_read(user_id="user-alice"))

    assert marked_read == 2
    mock_publish.assert_awaited_once()
    assert mock_publish.await_args.args[0] is conn
    assert mock_publish.await_args.kwargs["scope"] == "notifications"
    assert mock_publish.await_args.kwargs["payload"] == {
        "action": "read_all",
        "user_id": "user-alice",
    }

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from fastapi import Request

from app.config.database import get_pool
from app.utils.logger import logger

MOBILE_HOME_UPDATES_CHANNEL = "mobile_home_updates"
MOBILE_HOME_UPDATES_HEARTBEAT_SECONDS = 15


def _encode_mobile_home_update(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(",", ":"), default=str)


def _should_forward_mobile_home_update(*, user_id: str, payload: dict[str, Any]) -> bool:
    scope = payload.get("scope")
    if scope == "device_status":
        return True
    if scope == "notifications":
        return payload.get("user_id") == user_id
    return False


async def publish_mobile_home_update_with_conn(
    conn,
    *,
    scope: str,
    payload: dict[str, Any],
) -> None:
    message = {
        "scope": scope,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    await conn.fetchval(
        "SELECT pg_notify($1, $2)",
        MOBILE_HOME_UPDATES_CHANNEL,
        _encode_mobile_home_update(message),
    )


async def publish_mobile_home_update(*, scope: str, payload: dict[str, Any]) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await publish_mobile_home_update_with_conn(conn, scope=scope, payload=payload)


async def stream_mobile_home_updates(
    *,
    user_id: str,
    request: Request,
) -> AsyncGenerator[bytes, None]:
    pool = await get_pool()
    queue: asyncio.Queue[str] = asyncio.Queue()

    def _handle_notification(_connection, _pid, _channel, payload):
        if payload:
            queue.put_nowait(payload)

    async with pool.acquire() as conn:
        await conn.add_listener(MOBILE_HOME_UPDATES_CHANNEL, _handle_notification)
        try:
            yield b"retry: 5000\n\n"
            while True:
                if await request.is_disconnected():
                    break

                try:
                    payload = await asyncio.wait_for(
                        queue.get(),
                        timeout=MOBILE_HOME_UPDATES_HEARTBEAT_SECONDS,
                    )
                except asyncio.TimeoutError:
                    yield b": keep-alive\n\n"
                    continue

                try:
                    message = json.loads(payload)
                except json.JSONDecodeError:
                    logger.warning("Skipping malformed mobile home update payload")
                    continue

                if not _should_forward_mobile_home_update(user_id=user_id, payload=message):
                    continue

                yield f"data: {_encode_mobile_home_update(message)}\n\n".encode("utf-8")
        finally:
            with suppress(Exception):
                await conn.remove_listener(MOBILE_HOME_UPDATES_CHANNEL, _handle_notification)

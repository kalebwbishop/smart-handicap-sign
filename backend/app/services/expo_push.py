from __future__ import annotations

from typing import Iterable

import httpx

from app.config.database import get_pool
from app.config.settings import get_settings
from app.utils.logger import logger

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_BATCH_SIZE = 100


def _chunk(items: list[dict], size: int) -> Iterable[list[dict]]:
    for index in range(0, len(items), size):
        yield items[index:index + size]


async def send_assistance_request_push_notifications(notifications: list[dict]) -> int:
    if not notifications:
        return 0

    notification_ids = [notification["id"] for notification in notifications]
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT
            n.id AS notification_id,
            n.title,
            n.body,
            pt.expo_push_token
        FROM notifications n
        JOIN push_tokens pt ON pt.user_id = n.user_id
        LEFT JOIN notification_preferences np ON np.user_id = n.user_id
        WHERE n.id = ANY($1::uuid[])
          AND COALESCE(np.push_enabled, TRUE)
        """,
        notification_ids,
    )

    if not rows:
        return 0

    messages = [
        {
            "to": row["expo_push_token"],
            "sound": "default",
            "title": row["title"],
            "body": row["body"],
            "data": {
                "target": "home",
                "notificationId": str(row["notification_id"]),
            },
        }
        for row in rows
    ]

    settings = get_settings()
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if settings.expo_push_access_token:
        headers["Authorization"] = f"Bearer {settings.expo_push_access_token}"

    delivered_count = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        for batch in _chunk(messages, EXPO_PUSH_BATCH_SIZE):
            response = await client.post(
                EXPO_PUSH_API_URL,
                json=batch,
                headers=headers,
            )
            response.raise_for_status()

            payload = response.json()
            results = payload.get("data", [])
            if isinstance(results, list):
                for result in results:
                    if result.get("status") != "ok":
                        logger.warning("Expo push delivery issue: %s", result)
            delivered_count += len(batch)

    return delivered_count

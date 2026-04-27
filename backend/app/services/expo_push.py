"""Expo Push Notification sender using the Expo Push API."""

import httpx
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notifications(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Send push notifications to a list of Expo push tokens.

    Fires and forgets — logs errors but never raises, so DB notification
    creation is never blocked by push failures.
    """
    if not tokens:
        return

    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            **({"data": data} if data else {}),
        }
        for token in tokens
    ]

    try:
        async with httpx.AsyncClient() as client:
            # Expo API accepts batches of up to 100
            for i in range(0, len(messages), 100):
                batch = messages[i : i + 100]
                resp = await client.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    logger.error(
                        "Expo push failed: %s %s", resp.status_code, resp.text
                    )
                else:
                    logger.info("Sent %d push notifications", len(batch))
    except Exception as e:
        logger.error("Expo push error: %s", e)

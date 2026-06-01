from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from app.config.database import get_pool
from app.services import device_service
from app.services.expo_push import send_push_notifications
from app.utils.logger import logger

CONNECTIVITY_STALE_THRESHOLD_MINUTES = 15
CONNECTIVITY_SWEEP_INTERVAL_SECONDS = 60


async def sweep_stale_online_devices() -> int:
    pool = await get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=CONNECTIVITY_STALE_THRESHOLD_MINUTES)
    rows = await pool.fetch(
        """
        SELECT serial_number
        FROM devices
        WHERE connectivity_status = 'online'
          AND COALESCE(last_seen_at, created_at) <= $1
        ORDER BY COALESCE(last_seen_at, created_at) ASC
        """,
        cutoff,
    )

    marked_offline = 0
    for row in rows:
        serial_number = row["serial_number"]
        try:
            transition = await device_service.transition_device_connectivity_status(
                serial_number=serial_number,
                expected_status="online",
                new_status="offline",
                event_type="connectivity_offline",
                payload={
                    "stale_threshold_minutes": CONNECTIVITY_STALE_THRESHOLD_MINUTES,
                },
                create_notifications=True,
                stale_before=cutoff,
            )
        except Exception:
            logger.exception("Failed to mark device %s offline during connectivity sweep", serial_number)
            continue

        if not transition.success:
            if transition.error_code != "not_stale":
                logger.warning("Connectivity sweep skipped %s: %s", serial_number, transition.error_code)
            continue

        marked_offline += 1
        notifications = transition.notifications or []
        if notifications:
            try:
                await send_push_notifications(notifications)
            except Exception:
                logger.exception("Failed to deliver device offline push notifications for %s", serial_number)

    if marked_offline:
        logger.info("Connectivity sweep marked %d device(s) offline", marked_offline)
    return marked_offline


async def run_connectivity_sweep_loop(stop_event: asyncio.Event) -> None:
    try:
        while not stop_event.is_set():
            try:
                await sweep_stale_online_devices()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Connectivity sweep failed")

            try:
                await asyncio.wait_for(stop_event.wait(), timeout=CONNECTIVITY_SWEEP_INTERVAL_SECONDS)
            except asyncio.TimeoutError:
                continue
    except asyncio.CancelledError:
        logger.info("Connectivity sweep loop cancelled")
        raise

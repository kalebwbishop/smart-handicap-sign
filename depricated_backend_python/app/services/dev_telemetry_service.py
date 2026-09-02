from __future__ import annotations

import json
from typing import Any, Optional

from app.config.database import get_pool


def _capture_row_to_dict(row) -> dict[str, Any]:
    capture = dict(row)
    capture["id"] = str(capture["id"])
    return capture


async def record_training_capture(
    *,
    serial_number: str,
    sample_count: int,
    samples: list[int],
    capture_label: str,
    firmware_version: Optional[str] = None,
    sample_interval_ms: int = 20,
) -> dict[str, Any]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO training_captures (
            device_serial_number,
            capture_label,
            firmware_version,
            sample_count,
            sample_interval_ms,
            samples
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING id,
                  device_serial_number,
                  capture_label,
                  firmware_version,
                  sample_count,
                  sample_interval_ms,
                  samples,
                  created_at
        """,
        serial_number,
        capture_label,
        firmware_version,
        sample_count,
        sample_interval_ms,
        json.dumps(samples),
    )
    if row is None:
        raise RuntimeError("Failed to insert training capture")
    return _capture_row_to_dict(row)

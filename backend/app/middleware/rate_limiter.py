"""Rate limiting middleware for device claim endpoints.

Implements in-memory sliding-window rate limiting as a FastAPI dependency.
Three scopes are enforced:
  - Per IP address:  20 requests / 15 min
  - Per (user, serial) pair:  5 requests / 15 min
  - Per serial number globally: 10 requests / 15 min
"""

import asyncio
import json
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request

from app.utils.logger import logger


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RateLimitConfig:
    """Configuration for a single rate-limit rule."""

    max_requests: int
    window_seconds: int


IP_LIMIT = RateLimitConfig(max_requests=20, window_seconds=900)           # 20 req / 15 min
USER_SERIAL_LIMIT = RateLimitConfig(max_requests=5, window_seconds=900)   #  5 req / 15 min
SERIAL_LIMIT = RateLimitConfig(max_requests=10, window_seconds=900)       # 10 req / 15 min

# How often (in seconds) the background cleanup is allowed to run.
_CLEANUP_INTERVAL: int = 300  # 5 minutes


# ---------------------------------------------------------------------------
# Sliding-window counter
# ---------------------------------------------------------------------------

class SlidingWindowCounter:
    """Async-safe sliding-window rate limiter backed by in-memory timestamps."""

    def __init__(self) -> None:
        # key -> sorted list of request epoch timestamps
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._last_cleanup: float = time.monotonic()

    # -- public API ----------------------------------------------------------

    async def is_rate_limited(
        self, key: str, config: RateLimitConfig
    ) -> tuple[bool, int]:
        """Check whether *key* has exceeded *config*.

        Returns ``(is_limited, retry_after_seconds)``.
        *retry_after_seconds* is ``0`` when not limited.
        """
        now = time.time()
        cutoff = now - config.window_seconds

        async with self._lock:
            timestamps = self._windows[key]
            # Prune expired entries for this key while we hold the lock.
            self._windows[key] = timestamps = [
                ts for ts in timestamps if ts > cutoff
            ]

            if len(timestamps) >= config.max_requests:
                # Earliest timestamp still in the window determines when a
                # slot opens up.
                retry_after = int(timestamps[0] - cutoff) + 1
                return True, max(retry_after, 1)

        return False, 0

    async def record_request(
        self, key: str, config: RateLimitConfig
    ) -> None:
        """Append the current timestamp to the window for *key*."""
        now = time.time()
        cutoff = now - config.window_seconds

        async with self._lock:
            timestamps = self._windows[key]
            # Prune while recording to keep lists compact.
            self._windows[key] = [ts for ts in timestamps if ts > cutoff]
            self._windows[key].append(now)

    async def cleanup(self) -> None:
        """Remove keys whose timestamps have all expired."""
        now = time.time()

        async with self._lock:
            expired_keys = [
                key
                for key, timestamps in self._windows.items()
                if not timestamps or timestamps[-1] < now - 900
            ]
            for key in expired_keys:
                del self._windows[key]

    async def maybe_cleanup(self) -> None:
        """Run :meth:`cleanup` if enough time has passed since the last run."""
        now = time.monotonic()
        if now - self._last_cleanup < _CLEANUP_INTERVAL:
            return
        self._last_cleanup = now
        await self.cleanup()


# Global singleton shared across all requests.
_limiter = SlidingWindowCounter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_client_ip(request: Request) -> str:
    """Extract the client IP, respecting the ``X-Forwarded-For`` header.

    When behind a reverse proxy the real client address is typically the
    *first* entry in ``X-Forwarded-For``.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # "client, proxy1, proxy2" -> take the leftmost (original client).
        return forwarded.split(",")[0].strip()
    # Fallback to the direct connection address.
    if request.client:
        return request.client.host
    return "unknown"


async def _parse_body_fields(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Attempt to extract *serial_number* and *user_id* from the JSON body.

    ``request.body()`` caches internally in FastAPI/Starlette so the body
    remains available for downstream route handlers.

    Returns ``(serial_number, user_id)`` — either may be ``None``.
    """
    try:
        raw = await request.body()
        if not raw:
            return None, None
        data = json.loads(raw)
        serial_number = data.get("serial_number") or data.get("serialNumber")
        user_id = data.get("user_id") or data.get("userId")
        return serial_number, user_id
    except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
        return None, None


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def check_claim_rate_limit(request: Request) -> None:
    """FastAPI dependency that enforces rate limits on claim endpoints.

    Usage::

        @router.post("/claim", dependencies=[Depends(check_claim_rate_limit)])
        async def claim_device(...):
            ...

    Raises :class:`~fastapi.HTTPException` with status **429** when any
    rate-limit scope is exceeded.
    """
    # Trigger periodic cleanup of stale entries.
    await _limiter.maybe_cleanup()

    client_ip = get_client_ip(request)
    serial_number, user_id = await _parse_body_fields(request)

    # --- 1. Per-IP limit ---------------------------------------------------
    ip_key = f"ip:{client_ip}"
    limited, retry_after = await _limiter.is_rate_limited(ip_key, IP_LIMIT)
    if limited:
        logger.warning(
            "Rate limit exceeded for IP %s on %s (ip scope)",
            client_ip,
            request.url.path,
        )
        raise HTTPException(
            status_code=429,
            detail="Too many requests from this IP address. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    # --- 2. Per-serial limit (global) --------------------------------------
    if serial_number:
        serial_key = f"serial:{serial_number}"
        limited, retry_after = await _limiter.is_rate_limited(serial_key, SERIAL_LIMIT)
        if limited:
            logger.warning(
                "Rate limit exceeded for serial %s from IP %s (serial scope)",
                serial_number,
                client_ip,
            )
            raise HTTPException(
                status_code=429,
                detail="Too many claim attempts for this device. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

    # --- 3. Per (user_id, serial_number) limit -----------------------------
    if user_id and serial_number:
        pair_key = f"user_serial:{user_id}:{serial_number}"
        limited, retry_after = await _limiter.is_rate_limited(
            pair_key, USER_SERIAL_LIMIT
        )
        if limited:
            logger.warning(
                "Rate limit exceeded for user %s + serial %s from IP %s "
                "(user-serial scope)",
                user_id,
                serial_number,
                client_ip,
            )
            raise HTTPException(
                status_code=429,
                detail="Too many claim attempts for this user/device combination. "
                "Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

    # All checks passed — record the request in every applicable scope.
    await _limiter.record_request(ip_key, IP_LIMIT)
    if serial_number:
        await _limiter.record_request(f"serial:{serial_number}", SERIAL_LIMIT)
    if user_id and serial_number:
        await _limiter.record_request(
            f"user_serial:{user_id}:{serial_number}", USER_SERIAL_LIMIT
        )

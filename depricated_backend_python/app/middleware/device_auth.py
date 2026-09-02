"""Device authentication middleware.

Verifies per-device bearer tokens sent by hardware in the
``Authorization: Bearer <token>`` header. The token is validated
against the hashed value stored in the ``devices`` table.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Optional

from fastapi import Header, HTTPException, status
from pydantic import BaseModel

from app.config.database import get_pool
from app.utils.logger import logger


class AuthenticatedDevice(BaseModel):
    id: str
    serial_number: str


def _hash_token(token: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{token}".encode()).hexdigest()


async def get_authenticated_device(
    authorization: Optional[str] = Header(None),
) -> AuthenticatedDevice:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing device authorization header",
        )

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format; expected 'Bearer <serial>:<token>'",
        )

    credential = parts[1]
    if ":" not in credential:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credential format; expected '<serial>:<token>'",
        )

    serial_number, token = credential.split(":", 1)

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, serial_number, auth_token_hash, auth_token_salt
        FROM devices
        WHERE serial_number = $1
        """,
        serial_number,
    )

    if not row:
        logger.warning("Device auth failed: unknown serial %s", serial_number)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown device",
        )

    stored_hash = row.get("auth_token_hash")
    stored_salt = row.get("auth_token_salt")

    if not stored_hash or not stored_salt:
        logger.warning("Device auth failed: no token configured for %s", serial_number)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device has no auth token configured",
        )

    computed_hash = _hash_token(token, stored_salt)
    if not hmac.compare_digest(computed_hash, stored_hash):
        logger.warning("Device auth failed: invalid token for %s", serial_number)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device token",
        )

    return AuthenticatedDevice(
        id=str(row["id"]),
        serial_number=row["serial_number"],
    )

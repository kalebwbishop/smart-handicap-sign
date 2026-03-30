from dataclasses import dataclass
from functools import lru_cache
from typing import Union
import ssl

import jwt as pyjwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, Request

from app.config.database import get_pool
from app.config.workos_client import get_workos_client
from app.utils.logger import logger


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    """Return a cached JWKS client for verifying WorkOS access tokens."""
    workos = get_workos_client()
    jwks_url = workos.user_management.get_jwks_url()
    # Allow unverified SSL for local/corporate proxy environments
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    return PyJWKClient(jwks_url, ssl_context=ssl_context)


@dataclass
class CurrentUser:
    id: str
    workos_user_id: str
    email: str
    name: str
    session_id: str = ""


async def get_current_user(request: Request) -> CurrentUser:
    """FastAPI dependency that verifies the bearer token (JWT access token)
    via WorkOS JWKS and resolves the internal user from the database."""
    try:
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail={"error": "Unauthorized", "message": "No authentication token provided"},
            )

        access_token = auth_header.removeprefix("Bearer ")

        try:
            workos = get_workos_client()
            jwks_client = _get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(access_token)
            decoded = pyjwt.decode(
                access_token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False},
                leeway=60,  # tolerate up to 60s clock skew
            )
            user_id = decoded.get("sub")
            if not user_id:
                raise ValueError("Token missing 'sub' claim")
            session_id = decoded.get("sid", "")
            user = workos.user_management.get_user(user_id)
        except Exception:
            logger.error("WorkOS token verification failed", exc_info=True)
            raise HTTPException(
                status_code=401,
                detail={"error": "Unauthorized", "message": "Invalid or expired token"},
            )

        pool = await get_pool()
        row = await pool.fetchrow(
            "SELECT id FROM users WHERE workos_user_id = $1",
            user.id,
        )

        if row is None:
            raise HTTPException(
                status_code=401,
                detail={"error": "Unauthorized", "message": "User account not found"},
            )

        first = user.first_name or ""
        last = user.last_name or ""

        return CurrentUser(
            id=str(row["id"]),
            workos_user_id=user.id,
            email=user.email,
            name=f"{first} {last}".strip(),
            session_id=session_id,
        )
    except Exception as e:
        logger.error("Error in get_current_user: %s", str(e))
        logger.error("Error in get_current_user", exc_info=True)
        raise


async def optional_auth(request: Request) -> Union[CurrentUser, None]:
    """Same as get_current_user but returns None instead of raising."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

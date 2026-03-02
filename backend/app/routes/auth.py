from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional
import json
import base64
import pyperclip

from app.config.settings import get_settings
from app.config.workos_client import get_workos_client
from app.middleware.auth import CurrentUser, get_current_user
from app.services import auth_service
from app.utils.logger import logger


router = APIRouter(prefix="/auth", tags=["auth"])


# ── request / response models ────────────────────────────────────────


class ExchangePayload(BaseModel):
    data: dict  # expects {"code": "..."}


class RefreshPayload(BaseModel):
    refreshToken: str


class UserOut(BaseModel):
    id: str
    workosUserId: str
    email: str
    name: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# ── GET /auth/login ──────────────────────────────────────────────────


@router.get("/login")
async def login(mobile_redirect: Optional[str] = Query(None)):
    """Initiate WorkOS OAuth / AuthKit flow."""
    try:
        settings = get_settings()
        workos = get_workos_client()

        # Encode mobile redirect URI in state so the callback can use it
        state = None
        if mobile_redirect:
            state = base64.urlsafe_b64encode(
                json.dumps({"mobile_redirect": mobile_redirect}).encode()
            ).decode()

        authorization_url = workos.user_management.get_authorization_url(
            provider="authkit",
            redirect_uri=settings.workos_redirect_uri,
            state=state,
        )

        return {"authorizationUrl": authorization_url}
    except Exception:
        logger.error("Login initiation failed", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "message": "Failed to initiate login"},
        )


# ── GET /auth/callback ──────────────────────────────────────────────


@router.get("/callback")
async def callback(code: Optional[str] = None, state: Optional[str] = None):
    """Redirect back to the frontend with the authorization code."""
    if not code:
        return JSONResponse(
            status_code=400,
            content={"error": "Bad Request", "message": "Authorization code is required"},
        )
    logger.info(f"OAuth callback redirecting with code to frontend")

    # Check if state contains a mobile redirect URI
    if state:
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state).decode())
            mobile_redirect = state_data.get("mobile_redirect")
            if mobile_redirect:
                separator = "&" if "?" in mobile_redirect else "?"
                return RedirectResponse(url=f"{mobile_redirect}{separator}code={code}")
        except Exception:
            logger.warning("Failed to decode state parameter", exc_info=True)

    settings = get_settings()
    frontend_url = settings.frontend_url

    return RedirectResponse(url=f"{frontend_url}/home?code={code}")


# ── POST /auth/exchange ─────────────────────────────────────────────


@router.post("/exchange")
async def exchange(payload: ExchangePayload):
    """Exchange an authorization code for user profile + access token."""
    try:
        code = payload.data.get("code")
        if not code or not isinstance(code, str):
            return JSONResponse(
                status_code=400,
                content={"error": "Bad Request", "message": "Authorization code is required"},
            )

        workos = get_workos_client()

        auth_response = workos.user_management.authenticate_with_code(
            code=code,
        )

        user = auth_response.user
        access_token = auth_response.access_token

        # Look up or create user via the auth service
        try:
            db_user = await auth_service.find_user_by_workos_id(user.id)
        except Exception as e:
            logger.error("Database query failed: %s", str(e), exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"error": "Internal Server Error", "message": "Failed to fetch user data"},
            )

        if db_user is None:
            db_user = await auth_service.create_user(
                workos_user_id=user.id,
                email=user.email,
                name=f"{user.first_name} {user.last_name}",
            )

        user_out = {
            "id": str(db_user["id"]),
            "workosUserId": db_user["workos_user_id"],
            "email": db_user["email"],
            "name": db_user["name"],
            "createdAt": str(db_user["created_at"]) if db_user.get("created_at") else None,
            "updatedAt": str(db_user["updated_at"]) if db_user.get("updated_at") else None,
        }


        refresh_token = auth_response.refresh_token

        logger.info("OAuth exchange successful for user: %s", user.email)

        # Copy access token to clipboard for testing if pyperclip is available
        try:
            pyperclip.copy(access_token)
        except Exception:
            pass

        return {"user": user_out, "accessToken": access_token, "refreshToken": refresh_token}

    except Exception as e:
        logger.error("OAuth exchange failed: %s", str(e), exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "message": "Authentication failed"},
        )


# ── POST /auth/refresh ───────────────────────────────────────────────


@router.post("/refresh")
async def refresh(payload: RefreshPayload):
    """Use a refresh token to obtain a new access token (and refresh token)."""
    try:
        workos = get_workos_client()

        auth_response = workos.user_management.authenticate_with_refresh_token(
            refresh_token=payload.refreshToken,
        )

        return {
            "accessToken": auth_response.access_token,
            "refreshToken": auth_response.refresh_token,
        }
    except Exception as e:
        logger.error("Token refresh failed: %s", str(e), exc_info=True)
        return JSONResponse(
            status_code=401,
            content={"error": "Unauthorized", "message": "Refresh token is invalid or expired"},
        )


# ── GET /auth/me ─────────────────────────────────────────────────────


@router.get("/me")
async def me(current_user: CurrentUser = Depends(get_current_user)):
    """Return the authenticated user's full profile."""
    try:
        user_data = await auth_service.get_user_with_profile(
            current_user.workos_user_id
        )

        if user_data is None:
            return JSONResponse(
                status_code=404, content={"error": "User not found"}
            )

        return {"user": user_data}

    except Exception:
        logger.error("Get current user failed", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "message": "Failed to fetch user data",
            },
        )


# ── POST /auth/logout ───────────────────────────────────────────────


@router.post("/logout")
async def logout(current_user: CurrentUser = Depends(get_current_user)):
    """Logout the user by revoking the session via WorkOS."""
    try:
        workos = get_workos_client()

        logout_url = workos.user_management.get_logout_url(
            session_id=current_user.session_id,
        )

        return {"message": "Logged out successfully", "logoutUrl": logout_url}
    except Exception:
        logger.error("Logout failed", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "message": "Failed to logout"},
        )

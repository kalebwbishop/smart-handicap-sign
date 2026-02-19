from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional

from app.config.database import get_pool
from app.config.settings import get_settings
from app.config.workos_client import get_workos_client
from app.middleware.auth import CurrentUser, get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/auth", tags=["auth"])


# ── request / response models ────────────────────────────────────────


class ExchangePayload(BaseModel):
    data: dict  # expects {"code": "..."}


class UserOut(BaseModel):
    id: str
    workosUserId: str
    email: str
    name: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# ── GET /auth/login ──────────────────────────────────────────────────


@router.get("/login")
async def login():
    """Initiate WorkOS OAuth / AuthKit flow."""
    try:
        settings = get_settings()
        workos = get_workos_client()

        authorization_url = workos.user_management.get_authorization_url(
            provider="authkit",
            redirect_uri=settings.workos_redirect_uri,
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
async def callback(code: Optional[str] = None):
    """Redirect back to the frontend with the authorization code."""
    if not code:
        return JSONResponse(
            status_code=400,
            content={"error": "Bad Request", "message": "Authorization code is required"},
        )
    logger.info(f"OAuth callback redirecting with code to frontend")

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

        pool = await get_pool()        

        # Check if user exists in database
        try:
            existing = await pool.fetchrow(
                "SELECT * FROM users WHERE workos_user_id = $1",
                user.id,
            )
        except Exception as e:
            logger.error("Database query failed: %s", str(e), exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"error": "Internal Server Error", "message": "Failed to fetch user data"},
            )

        if existing is None:
            # Create new user
            new_user = await pool.fetchrow(
                "INSERT INTO users (workos_user_id, email, name) VALUES ($1, $2, $3) RETURNING *",
                user.id,
                user.email,
                f"{user.first_name} {user.last_name}",
            )

            db_user = new_user
            logger.info("New user created: %s", user.email)
        else:
            db_user = existing

        user_out = {
            "id": str(db_user["id"]),
            "workosUserId": db_user["workos_user_id"],
            "email": db_user["email"],
            "name": db_user["name"],
            "createdAt": str(db_user["created_at"]) if db_user.get("created_at") else None,
            "updatedAt": str(db_user["updated_at"]) if db_user.get("updated_at") else None,
        }

        return {"user": user_out, "accessToken": access_token}

    except Exception as e:
        logger.error("OAuth exchange failed: %s", str(e), exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "message": "Authentication failed"},
        )


# ── GET /auth/me ─────────────────────────────────────────────────────


@router.get("/me")
async def me(current_user: CurrentUser = Depends(get_current_user)):
    """Return the authenticated user's full profile."""
    try:
        pool = await get_pool()

        row = await pool.fetchrow(
            """SELECT u.*, p.display_name, p.bio, p.profile_image_url,
                      p.cover_image_url, p.location, p.website
               FROM users u
               LEFT JOIN profiles p ON u.id = p.user_id
               WHERE u.workos_user_id = $1""",
            current_user.workos_user_id,
        )

        if row is None:
            return JSONResponse(
                status_code=404, content={"error": "User not found"}
            )

        return {"user": dict(row)}

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

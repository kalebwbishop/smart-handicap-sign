from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

from app.middleware.auth import CurrentUser, get_current_user, optional_auth
from app.services import event_service, sign_service, organization_service
from app.utils.logger import logger

router = APIRouter(prefix="/signs", tags=["signs"])


# ── enums ────────────────────────────────────────────────────────────


class SignStatus(str, Enum):
    available = "available"
    assistance_requested = "assistance_requested"
    assistance_in_progress = "assistance_in_progress"
    offline = "offline"
    error = "error"
    training_ready = "training_ready"
    training_positive = "training_positive"
    training_negative = "training_negative"


# ── request / response models ────────────────────────────────────────


class SignCreate(BaseModel):
    name: str = Field(..., description="Display name for the sign")
    location: str = Field(..., description="Physical location of the sign")
    organization_id: Optional[str] = Field(None, description="Organization this sign belongs to")
    status: Optional[SignStatus] = Field(
        default=SignStatus.available,
        description="Current status of the sign"
    )


class SignUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Display name for the sign")
    location: Optional[str] = Field(None, description="Physical location of the sign")
    status: Optional[SignStatus] = Field(None, description="Current status of the sign")
    organization_id: Optional[str] = Field(None, description="Organization this sign belongs to")


class SignOut(BaseModel):
    id: str
    name: str
    location: str
    status: SignStatus
    last_updated: datetime
    organization_id: Optional[str] = None


# ── CREATE /signs ────────────────────────────────────────────────────


@router.post("", response_model=SignOut, status_code=201)
async def create_sign(
    sign: SignCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new sign. If organization_id is provided, validates membership."""
    try:
        if sign.organization_id:
            role = await organization_service.get_user_role(sign.organization_id, current_user.id)
            if role not in ("owner", "admin"):
                raise HTTPException(status_code=403, detail="Must be org owner or admin to assign signs")

        result = await sign_service.create_sign(
            name=sign.name,
            location=sign.location,
            status=sign.status.value if sign.status else SignStatus.available.value,
            organization_id=sign.organization_id,
        )
        return SignOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create sign: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── READ /signs ──────────────────────────────────────────────────────


@router.get("", response_model=List[SignOut])
async def list_signs(
    status: Optional[SignStatus] = Query(None, description="Filter by status"),
    organization_id: Optional[str] = Query(None, description="Filter by organization"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve signs scoped to the current user's organizations."""
    try:
        rows = await sign_service.list_signs(
            status=status.value if status else None,
            organization_id=organization_id,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
        )
        return [SignOut(**r) for r in rows]

    except Exception as e:
        logger.error(f"Failed to list signs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{sign_id}", response_model=SignOut)
async def get_sign(
    sign_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a specific sign by ID."""
    try:
        result = await sign_service.get_sign(sign_id)
        if not result:
            raise HTTPException(status_code=404, detail="Sign not found")
        return SignOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve sign: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── STATUS /signs/{sign_id}/status (lightweight, no auth) ────────────


class SignStatusOut(BaseModel):
    sign_id: str
    status: SignStatus


@router.get("/{sign_id}/status", response_model=SignStatusOut)
async def get_sign_status(
    sign_id: str,
    _current_user: CurrentUser = Depends(optional_auth),
):
    """Return only the current status of a sign (used by ESP32 devices)."""
    try:
        result = await sign_service.get_sign(sign_id)
        if not result:
            raise HTTPException(status_code=404, detail="Sign not found")
        return SignStatusOut(sign_id=result["id"], status=result["status"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch sign status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── UPDATE /signs/{sign_id} ──────────────────────────────────────────


@router.patch("/{sign_id}", response_model=SignOut)
async def update_sign(
    sign_id: str,
    sign: SignUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a specific sign."""
    try:
        result = await sign_service.update_sign(
            sign_id,
            name=sign.name,
            location=sign.location,
            status=sign.status.value if sign.status else None,
            organization_id=sign.organization_id,
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Sign not found")
        return SignOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update sign: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── ACKNOWLEDGE /signs/{sign_id}/acknowledge ────────────────────────


@router.post("/{sign_id}/acknowledge", response_model=SignOut)
async def acknowledge_sign(
    sign_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Acknowledge an assistance request, moving the sign to *assistance_in_progress*."""
    try:
        sign = await sign_service.get_sign(sign_id)
        if not sign:
            raise HTTPException(status_code=404, detail="Sign not found")

        if sign["status"] != "assistance_requested":
            raise HTTPException(
                status_code=409,
                detail=f"Sign is '{sign['status']}', not 'assistance_requested'",
            )

        result = await sign_service.update_sign(
            sign_id, status="assistance_in_progress"
        )

        await event_service.create_event(
            sign_id=sign_id,
            event_type="status_change",
            data={
                "previous_status": "assistance_requested",
                "new_status": "assistance_in_progress",
                "acknowledged_by": current_user.id,
            },
            create_notification=True,
            notify_org=True,
            notification_title="Assistance Acknowledged",
            notification_body=(
                f"Sign {sign_id} assistance request has been acknowledged."
            ),
        )

        logger.info("Sign %s acknowledged by user %s", sign_id, current_user.id)
        return SignOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge sign: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── RESOLVE /signs/{sign_id}/resolve ─────────────────────────────────


@router.post("/{sign_id}/resolve", response_model=SignOut)
async def resolve_sign(
    sign_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark assistance as complete, returning the sign to *available*."""
    try:
        sign = await sign_service.get_sign(sign_id)
        if not sign:
            raise HTTPException(status_code=404, detail="Sign not found")

        if sign["status"] not in ("assistance_requested", "assistance_in_progress"):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Sign is '{sign['status']}'; must be "
                    "'assistance_requested' or 'assistance_in_progress' to resolve"
                ),
            )

        previous_status = sign["status"]
        result = await sign_service.update_sign(sign_id, status="available")

        await event_service.create_event(
            sign_id=sign_id,
            event_type="status_change",
            data={
                "previous_status": previous_status,
                "new_status": "available",
                "resolved_by": current_user.id,
            },
            create_notification=True,
            notify_org=True,
            notification_title="Assistance Resolved",
            notification_body=(
                f"Sign {sign_id} has been resolved and is now available."
            ),
        )

        logger.info("Sign %s resolved by user %s", sign_id, current_user.id)
        return SignOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve sign: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── DELETE /signs/{sign_id} ──────────────────────────────────────────


@router.delete("/{sign_id}", status_code=204)
async def delete_sign(
    sign_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a specific sign."""
    try:
        deleted = await sign_service.delete_sign(sign_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Sign not found")
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete sign: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

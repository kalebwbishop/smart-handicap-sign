from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

from app.middleware.auth import CurrentUser, get_current_user
from app.services import sign_service
from app.utils.logger import logger

router = APIRouter(prefix="/signs", tags=["signs"])


# ── enums ────────────────────────────────────────────────────────────


class SignStatus(str, Enum):
    available = "available"
    occupied = "occupied"
    offline = "offline"
    error = "error"
    training_ready = "training_ready"
    training_positive = "training_positive"
    training_negative = "training_negative"


# ── request / response models ────────────────────────────────────────


class SignCreate(BaseModel):
    name: str = Field(..., description="Display name for the sign")
    location: str = Field(..., description="Physical location of the sign")
    status: Optional[SignStatus] = Field(
        default=SignStatus.available,
        description="Current status of the sign"
    )


class SignUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Display name for the sign")
    location: Optional[str] = Field(None, description="Physical location of the sign")
    status: Optional[SignStatus] = Field(None, description="Current status of the sign")


class SignOut(BaseModel):
    id: str
    name: str
    location: str
    status: SignStatus
    last_updated: datetime


# ── CREATE /signs ────────────────────────────────────────────────────


@router.post("/", response_model=SignOut, status_code=201)
async def create_sign(
    sign: SignCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new sign."""
    try:
        result = await sign_service.create_sign(
            name=sign.name,
            location=sign.location,
            status=sign.status.value if sign.status else SignStatus.available.value,
        )
        return SignOut(**result)

    except Exception as e:
        logger.error(f"Failed to create sign: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── READ /signs ──────────────────────────────────────────────────────


@router.get("/", response_model=List[SignOut])
async def list_signs(
    status: Optional[SignStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve all signs with optional filtering."""
    try:
        rows = await sign_service.list_signs(
            status=status.value if status else None,
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
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Sign not found")
        return SignOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update sign: {e}", exc_info=True)
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

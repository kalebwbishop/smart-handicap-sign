from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.middleware.auth import CurrentUser, get_current_user
from app.services import parking_space_service, site_service, organization_service
from app.utils.logger import logger

router = APIRouter(tags=["parking-spaces"])


# ── authorization helpers ────────────────────────────────────────────


async def _require_site_access(
    site_id: str, user_id: str, require_role: Optional[set] = None,
) -> dict:
    """Verify user has org membership for a site. Optionally require specific roles."""
    site = await site_service.get_site(site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    role = await organization_service.get_user_role(site["organization_id"], user_id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    if require_role and role not in require_role:
        raise HTTPException(
            status_code=403,
            detail=f"Requires one of: {', '.join(sorted(require_role))}",
        )
    return site


async def _require_space_access(
    space_id: str, user_id: str, require_admin: bool = False,
) -> dict:
    """Fetch a parking space, verify org membership, optionally require admin/owner."""
    space = await parking_space_service.get_parking_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Parking space not found")
    site = await site_service.get_site(space["site_id"])
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    role = await organization_service.get_user_role(site["organization_id"], user_id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    if require_admin and role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Requires admin or owner role")
    return space


# ── request / response models ────────────────────────────────────────


class ParkingSpaceCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    accessible_type: str = Field(
        default="standard",
        description="standard, van_accessible, temporary, reserved",
    )
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class ParkingSpaceUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=50)
    accessible_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class ParkingSpaceOut(BaseModel):
    id: str
    site_id: str
    label: str
    accessible_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    current_device_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── site-scoped endpoints ────────────────────────────────────────────


@router.get(
    "/sites/{site_id}/parking-spaces",
    response_model=List[ParkingSpaceOut],
)
async def list_parking_spaces(
    site_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
):
    """List all parking spaces for a site."""
    try:
        await _require_site_access(site_id, user.id)
        spaces = await parking_space_service.list_parking_spaces(
            site_id=site_id, skip=skip, limit=limit,
        )
        return spaces
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing parking spaces: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/sites/{site_id}/parking-spaces",
    response_model=ParkingSpaceOut,
    status_code=201,
)
async def create_parking_space(
    site_id: str,
    body: ParkingSpaceCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a parking space within a site (admin/owner/installer)."""
    try:
        await _require_site_access(
            site_id, user.id, require_role={"owner", "admin", "installer"},
        )
        space = await parking_space_service.create_parking_space(
            site_id=site_id,
            label=body.label,
            accessible_type=body.accessible_type,
            latitude=body.latitude,
            longitude=body.longitude,
            notes=body.notes,
        )
        return space
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating parking space: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── space-scoped endpoints ───────────────────────────────────────────


@router.get(
    "/parking-spaces/{space_id}",
    response_model=ParkingSpaceOut,
)
async def get_parking_space(
    space_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single parking space by ID."""
    try:
        space = await _require_space_access(space_id, user.id)
        return space
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting parking space: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch(
    "/parking-spaces/{space_id}",
    response_model=ParkingSpaceOut,
)
async def update_parking_space(
    space_id: str,
    body: ParkingSpaceUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update a parking space (admin/owner only)."""
    try:
        await _require_space_access(space_id, user.id, require_admin=True)
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        updated = await parking_space_service.update_parking_space(
            space_id, **updates,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Parking space not found")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating parking space: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/parking-spaces/{space_id}",
    status_code=204,
)
async def delete_parking_space(
    space_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a parking space (admin/owner only). Fails 409 if a device is assigned."""
    try:
        await _require_space_access(space_id, user.id, require_admin=True)
        await parking_space_service.delete_parking_space(space_id)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error("Error deleting parking space: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.middleware.auth import CurrentUser, get_current_user
from app.services import site_service, organization_service
from app.utils.logger import logger

router = APIRouter(prefix="/sites", tags=["sites"])


# ── authorization helpers ────────────────────────────────────────────


async def _require_site_access(
    site_id: str, user_id: str, require_admin: bool = False
) -> dict:
    """Fetch a site and verify the user has access via org membership.

    Returns the site dict. Raises HTTPException on not-found or forbidden.
    """
    site = await site_service.get_site(site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    role = await organization_service.get_user_role(site["organization_id"], user_id)
    if role is None:
        raise HTTPException(
            status_code=403, detail="Not a member of this site's organization"
        )
    if require_admin and role not in ("owner", "admin"):
        raise HTTPException(
            status_code=403, detail="Requires admin or owner role"
        )
    return site


# ── request / response models ────────────────────────────────────────


class SiteCreate(BaseModel):
    organization_id: str = Field(..., description="Organization this site belongs to")
    name: str = Field(..., min_length=1)
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "US"
    jurisdiction: Optional[str] = None


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    jurisdiction: Optional[str] = None


class SiteOut(BaseModel):
    id: str
    organization_id: str
    name: str
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    jurisdiction: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── LIST /sites ──────────────────────────────────────────────────────


@router.get("", response_model=List[SiteOut])
async def list_sites(
    organization_id: Optional[str] = Query(None, description="Filter by organization"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List sites for the current user's organizations."""
    try:
        rows = await site_service.list_sites(
            organization_id=organization_id,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
        )
        return [SiteOut(**r) for r in rows]

    except Exception as e:
        logger.error(f"Failed to list sites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── CREATE /sites ────────────────────────────────────────────────────


@router.post("", response_model=SiteOut, status_code=201)
async def create_site(
    body: SiteCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new site. Requires admin or owner role in the target organization."""
    try:
        role = await organization_service.get_user_role(
            body.organization_id, current_user.id
        )
        if role not in ("owner", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Must be org owner or admin to create sites",
            )

        result = await site_service.create_site(
            organization_id=body.organization_id,
            name=body.name,
            address_line_1=body.address_line_1,
            address_line_2=body.address_line_2,
            city=body.city,
            state=body.state,
            postal_code=body.postal_code,
            country=body.country,
            jurisdiction=body.jurisdiction,
        )
        return SiteOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create site: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /sites/{site_id} ────────────────────────────────────────────


@router.get("/{site_id}", response_model=SiteOut)
async def get_site(
    site_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a specific site by ID. Requires org membership."""
    try:
        site = await _require_site_access(site_id, current_user.id)
        return SiteOut(**site)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve site: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── UPDATE /sites/{site_id} ─────────────────────────────────────────


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(
    site_id: str,
    body: SiteUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a site. Requires admin or owner role."""
    try:
        await _require_site_access(site_id, current_user.id, require_admin=True)

        result = await site_service.update_site(
            site_id,
            name=body.name,
            address_line_1=body.address_line_1,
            address_line_2=body.address_line_2,
            city=body.city,
            state=body.state,
            postal_code=body.postal_code,
            country=body.country,
            jurisdiction=body.jurisdiction,
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Site not found")
        return SiteOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update site: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── DELETE /sites/{site_id} ──────────────────────────────────────────


@router.delete("/{site_id}", status_code=204)
async def delete_site(
    site_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a site. Requires admin or owner role."""
    try:
        await _require_site_access(site_id, current_user.id, require_admin=True)

        deleted = await site_service.delete_site(site_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Site not found")
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete site: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

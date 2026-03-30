from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

from app.middleware.auth import CurrentUser, get_current_user
from app.services import organization_service
from app.utils.logger import logger

router = APIRouter(prefix="/organizations", tags=["organizations"])


# ── enums ────────────────────────────────────────────────────────────


class OrgRole(str, Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


# ── request / response models ────────────────────────────────────────


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")


class OrgUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class OrgOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    role: Optional[str] = None


class MemberAdd(BaseModel):
    email: str = Field(..., description="Email of the user to add")
    role: OrgRole = Field(default=OrgRole.member, description="Role to assign")


class MemberRoleUpdate(BaseModel):
    role: OrgRole = Field(..., description="New role")


class MemberOut(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: str
    email: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── helpers ──────────────────────────────────────────────────────────


async def _require_role(org_id: str, user_id: str, min_roles: list[str]) -> str:
    """Check that the user has one of the required roles. Returns the role."""
    role = await organization_service.get_user_role(org_id, user_id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    if role not in min_roles:
        raise HTTPException(status_code=403, detail=f"Requires one of {min_roles}, you have '{role}'")
    return role


# ── CREATE /organizations ────────────────────────────────────────────


@router.post("", response_model=OrgOut, status_code=201)
async def create_organization(
    body: OrgCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new organization. The creator becomes the owner."""
    try:
        org = await organization_service.create_organization(
            name=body.name,
            owner_user_id=current_user.id,
        )
        org["role"] = "owner"
        return OrgOut(**org)
    except Exception as e:
        logger.error("Failed to create organization: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── LIST /organizations ──────────────────────────────────────────────


@router.get("", response_model=List[OrgOut])
async def list_organizations(
    current_user: CurrentUser = Depends(get_current_user),
):
    """List organizations the current user belongs to."""
    try:
        orgs = await organization_service.list_organizations_for_user(current_user.id)
        return [OrgOut(**o) for o in orgs]
    except Exception as e:
        logger.error("Failed to list organizations: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /organizations/{org_id} ──────────────────────────────────────


@router.get("/{org_id}", response_model=OrgOut)
async def get_organization(
    org_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get organization details. Must be a member."""
    role = await _require_role(org_id, current_user.id, ["owner", "admin", "member"])
    org = await organization_service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org["role"] = role
    return OrgOut(**org)


# ── UPDATE /organizations/{org_id} ───────────────────────────────────


@router.patch("/{org_id}", response_model=OrgOut)
async def update_organization(
    org_id: str,
    body: OrgUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update organization details. Requires owner or admin role."""
    await _require_role(org_id, current_user.id, ["owner", "admin"])
    result = await organization_service.update_organization(org_id, name=body.name)
    if not result:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrgOut(**result)


# ── DELETE /organizations/{org_id} ───────────────────────────────────


@router.delete("/{org_id}", status_code=204)
async def delete_organization(
    org_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete an organization. Requires owner role."""
    await _require_role(org_id, current_user.id, ["owner"])
    deleted = await organization_service.delete_organization(org_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Organization not found")
    return None


# ── LIST MEMBERS /organizations/{org_id}/members ─────────────────────


@router.get("/{org_id}/members", response_model=List[MemberOut])
async def list_members(
    org_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all members of an organization. Must be a member."""
    await _require_role(org_id, current_user.id, ["owner", "admin", "member"])
    members = await organization_service.list_members(org_id)
    return [MemberOut(**m) for m in members]


# ── ADD MEMBER /organizations/{org_id}/members ───────────────────────


@router.post("/{org_id}/members", response_model=MemberOut, status_code=201)
async def add_member(
    org_id: str,
    body: MemberAdd,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Add a member by email. Requires owner or admin role."""
    caller_role = await _require_role(org_id, current_user.id, ["owner", "admin"])

    # Admins cannot add owners
    if body.role == OrgRole.owner and caller_role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can add other owners")

    user = await organization_service.find_user_by_email(body.email)
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found with email {body.email}")

    try:
        member = await organization_service.add_member(org_id, user["id"], body.role.value)
        member["email"] = user["email"]
        member["user_name"] = user["name"]
        return MemberOut(**member)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# ── UPDATE MEMBER ROLE /organizations/{org_id}/members/{user_id} ─────


@router.patch("/{org_id}/members/{user_id}", response_model=MemberOut)
async def update_member_role(
    org_id: str,
    user_id: str,
    body: MemberRoleUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a member's role. Requires owner (or admin for non-owner changes)."""
    caller_role = await _require_role(org_id, current_user.id, ["owner", "admin"])

    target_role = await organization_service.get_user_role(org_id, user_id)
    if target_role is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Only owners can change to/from owner role
    if (target_role == "owner" or body.role == OrgRole.owner) and caller_role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can modify owner roles")

    result = await organization_service.update_member_role(org_id, user_id, body.role.value)
    if not result:
        raise HTTPException(status_code=404, detail="Member not found")
    return MemberOut(**result)


# ── REMOVE MEMBER /organizations/{org_id}/members/{user_id} ──────────


@router.delete("/{org_id}/members/{user_id}", status_code=204)
async def remove_member(
    org_id: str,
    user_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Remove a member from the organization. Requires owner or admin role."""
    caller_role = await _require_role(org_id, current_user.id, ["owner", "admin"])

    target_role = await organization_service.get_user_role(org_id, user_id)
    if target_role is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Admins cannot remove owners
    if target_role == "owner" and caller_role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can remove owners")

    try:
        removed = await organization_service.remove_member(org_id, user_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Member not found")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return None

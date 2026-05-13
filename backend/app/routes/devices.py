from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.config.database import get_pool
from app.middleware.auth import CurrentUser, get_current_user
from app.services import device_service, organization_service
from app.utils.logger import logger

router = APIRouter(prefix="/devices", tags=["devices"])


# ── authorization helpers ────────────────────────────────────────────


async def _require_device_access(
    serial_number: str,
    user_id: str,
    require_admin: bool = False,
) -> dict:
    """Fetch device, verify user access. Raises HTTPException on auth failure."""
    device = await device_service.get_device_by_serial(serial_number)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if not device.get("organization_id"):
        if require_admin:
            raise HTTPException(
                status_code=403,
                detail="Device not assigned to an organization",
            )
        return device

    role = await organization_service.get_user_role(
        device["organization_id"], user_id
    )
    if role is None:
        raise HTTPException(
            status_code=403,
            detail="Not a member of this device's organization",
        )
    if require_admin and role not in ("owner", "admin"):
        raise HTTPException(
            status_code=403, detail="Requires admin or owner role"
        )
    return device


# ── request / response models ────────────────────────────────────────


class DeviceOut(BaseModel):
    serial_number: str
    model_code: Optional[str] = None
    hardware_revision: Optional[str] = None
    firmware_version: Optional[str] = None
    lifecycle_status: Optional[str] = None
    operational_status: Optional[str] = None
    claim_status: Optional[str] = None
    organization_id: Optional[str] = None
    current_site_id: Optional[str] = None
    current_parking_space_id: Optional[str] = None
    name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RevokeRequest(BaseModel):
    reason: str = Field(..., description="Reason for revoking the device")


class TransferRequest(BaseModel):
    new_site_id: str = Field(..., description="Target site ID")
    new_parking_space_id: str = Field(..., description="Target parking space ID")
    accessible_type: str = Field(..., description="Accessible parking type")
    notes: Optional[str] = Field(None, description="Optional transfer notes")


class RegenerateClaimResponse(BaseModel):
    claim_id: str
    message: str


class DeviceEventOut(BaseModel):
    id: str
    device_id: str
    event_type: str
    payload: Optional[dict] = None
    created_at: Optional[datetime] = None


# ── LIST /devices ────────────────────────────────────────────────────


@router.get("", response_model=List[DeviceOut])
async def list_devices(
    organization_id: Optional[str] = Query(None, description="Filter by organization"),
    lifecycle_status: Optional[str] = Query(None, description="Filter by lifecycle status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List devices scoped to the current user's organizations."""
    try:
        rows = await device_service.list_devices(
            organization_id=organization_id,
            lifecycle_status=lifecycle_status,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
        )
        return [DeviceOut(**r) for r in rows]

    except Exception as e:
        logger.error(f"Failed to list devices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /devices/{serial_number}/status (device-facing, no auth) ──────


@router.get("/{serial_number}/status")
async def get_device_status(serial_number: str):
    """Lightweight status endpoint for hardware devices (no auth required).

    Returns the device operational and lifecycle status so the physical device
    knows whether it should be operating, waiting, or alerting.
    """
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT lifecycle_status, operational_status FROM devices WHERE serial_number = $1",
        serial_number,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")

    lifecycle = row["lifecycle_status"]
    operational = row.get("operational_status", "available")

    # If device is active, use operational_status; otherwise map lifecycle
    if lifecycle == "active":
        status = operational or "available"
    elif lifecycle in ("manufactured", "unclaimed", "claiming"):
        status = "pending"
    elif lifecycle in ("lost", "revoked", "retired"):
        status = "disabled"
    else:
        status = "unknown"

    return {
        "serial_number": serial_number,
        "status": status,
        "lifecycle_status": lifecycle,
        "operational_status": operational,
    }


# ── POST /devices/{serial_number}/acknowledge ────────────────────────


class AcknowledgeRequest(BaseModel):
    pass


@router.post("/{serial_number}/acknowledge", response_model=DeviceOut)
async def acknowledge_device(
    serial_number: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Acknowledge an assistance request — moves to assistance_in_progress."""
    device = await _require_device_access(serial_number, current_user.id)
    pool = await get_pool()
    await pool.execute(
        """UPDATE devices SET operational_status = 'assistance_in_progress', updated_at = NOW()
           WHERE serial_number = $1""",
        serial_number,
    )
    device["operational_status"] = "assistance_in_progress"
    return DeviceOut(**device)


# ── POST /devices/{serial_number}/resolve ────────────────────────────


@router.post("/{serial_number}/resolve", response_model=DeviceOut)
async def resolve_device(
    serial_number: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Resolve an assistance request — moves back to available."""
    device = await _require_device_access(serial_number, current_user.id)
    pool = await get_pool()
    await pool.execute(
        """UPDATE devices SET operational_status = 'available', updated_at = NOW()
           WHERE serial_number = $1""",
        serial_number,
    )
    device["operational_status"] = "available"
    return DeviceOut(**device)


# ── GET /devices/{serial_number} ─────────────────────────────────────


@router.get("/{serial_number}", response_model=DeviceOut)
async def get_device(
    serial_number: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a specific device by serial number."""
    try:
        device = await _require_device_access(serial_number, current_user.id)
        return DeviceOut(**device)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve device: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── REVOKE /devices/{serial_number}/revoke ───────────────────────────


@router.post("/{serial_number}/revoke", response_model=DeviceOut)
async def revoke_device(
    serial_number: str,
    body: RevokeRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Revoke a device. Requires admin or owner role."""
    try:
        await _require_device_access(
            serial_number, current_user.id, require_admin=True
        )

        result = await device_service.revoke_device(
            serial_number=serial_number,
            actor_user_id=current_user.id,
            reason=body.reason,
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Device not found")

        return DeviceOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke device: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── TRANSFER /devices/{serial_number}/transfer ───────────────────────


@router.post("/{serial_number}/transfer", response_model=DeviceOut)
async def transfer_device(
    serial_number: str,
    body: TransferRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Transfer a device to a new site/parking space. Requires admin or owner role."""
    try:
        await _require_device_access(
            serial_number, current_user.id, require_admin=True
        )

        result = await device_service.transfer_device(
            serial_number=serial_number,
            new_site_id=body.new_site_id,
            new_parking_space_id=body.new_parking_space_id,
            accessible_type=body.accessible_type,
            actor_user_id=current_user.id,
            notes=body.notes,
        )
        if result is None:
            raise HTTPException(
                status_code=409,
                detail="Transfer failed — device may not be in active state",
            )

        return DeviceOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to transfer device: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── RELEASE /devices/{serial_number}/release ─────────────────────────


@router.post("/{serial_number}/release", response_model=DeviceOut)
async def release_device(
    serial_number: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Release a device back to unclaimed. Requires admin or owner role."""
    try:
        await _require_device_access(
            serial_number, current_user.id, require_admin=True
        )

        result = await device_service.release_device(
            serial_number=serial_number,
            actor_user_id=current_user.id,
        )
        if result is None:
            raise HTTPException(
                status_code=409,
                detail="Release failed — device may not be in active state",
            )

        return DeviceOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to release device: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── REGENERATE CLAIM /devices/{serial_number}/regenerate-claim ───────


@router.post(
    "/{serial_number}/regenerate-claim",
    response_model=RegenerateClaimResponse,
)
async def regenerate_claim(
    serial_number: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate a new claim ID for an unclaimed device. Requires admin or owner role."""
    try:
        await _require_device_access(
            serial_number, current_user.id, require_admin=True
        )

        new_claim_id = await device_service.regenerate_claim_id(
            serial_number=serial_number,
            actor_user_id=current_user.id,
        )
        if new_claim_id is None:
            raise HTTPException(
                status_code=409,
                detail="Regeneration failed — device may not be in a regenerable state",
            )

        return RegenerateClaimResponse(
            claim_id=new_claim_id,
            message="New claim ID generated successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate claim ID: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── EVENTS /devices/{serial_number}/events ───────────────────────────


@router.get("/{serial_number}/events", response_model=List[DeviceEventOut])
async def get_device_events(
    serial_number: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get events for a device. User must be a member of the device's organization."""
    try:
        device = await _require_device_access(serial_number, current_user.id)

        pool = await get_pool()
        rows = await pool.fetch(
            """
            SELECT id, device_id, event_type, payload, created_at
            FROM device_events
            WHERE device_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            device["id"],
            limit,
            skip,
        )

        results = []
        for r in rows:
            d = dict(r)
            d["id"] = str(d["id"])
            d["device_id"] = str(d["device_id"])
            # Parse JSON payload string if needed
            if isinstance(d.get("payload"), str):
                import json
                try:
                    d["payload"] = json.loads(d["payload"])
                except (json.JSONDecodeError, TypeError):
                    d["payload"] = None
            results.append(DeviceEventOut(**d))

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get device events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

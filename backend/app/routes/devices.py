from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.middleware.auth import CurrentUser, get_current_user
from app.services import device_service
from app.utils.logger import logger

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceOut(BaseModel):
    serial_number: str
    model_code: Optional[str] = None
    hardware_revision: Optional[str] = None
    firmware_version: Optional[str] = None
    lifecycle_status: Optional[str] = "active"
    operational_status: Optional[str] = None
    claim_status: Optional[str] = None
    organization_id: Optional[str] = None
    current_site_id: Optional[str] = None
    current_parking_space_id: Optional[str] = None
    name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DeviceStatusOut(BaseModel):
    serial_number: str
    status: str
    operational_status: str


class DeviceEventOut(BaseModel):
    id: str
    device_id: str
    event_type: str
    payload: Optional[dict] = None
    created_at: Optional[datetime] = None


async def _get_device_or_404(serial_number: str) -> dict:
    device = await device_service.get_device_by_serial(serial_number)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.get("", response_model=List[DeviceOut])
async def list_devices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    _current_user: CurrentUser = Depends(get_current_user),
):
    try:
        rows = await device_service.list_devices(skip=skip, limit=limit)
        return [DeviceOut(**row) for row in rows]
    except Exception as exc:
        logger.error("Failed to list devices: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{serial_number}/status", response_model=DeviceStatusOut)
async def get_device_status(serial_number: str):
    device = await _get_device_or_404(serial_number)
    status = device.get("operational_status") or "available"
    return {
        "serial_number": serial_number,
        "status": status,
        "operational_status": status,
    }


@router.post("/{serial_number}/acknowledge", response_model=DeviceOut)
async def acknowledge_device(
    serial_number: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    await _get_device_or_404(serial_number)

    try:
        result = await device_service.transition_device_status(
            serial_number=serial_number,
            expected_status="assistance_requested",
            new_status="assistance_in_progress",
            event_type="assistance_acknowledged",
            actor_user_id=current_user.id,
        )
    except Exception as exc:
        logger.error("Failed to acknowledge device: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    if not result.success:
        raise HTTPException(
            status_code=409,
            detail=f"Device must be in assistance_requested before acknowledge (current: {result.current_status})",
        )

    return DeviceOut(**result.device)


@router.post("/{serial_number}/resolve", response_model=DeviceOut)
async def resolve_device(
    serial_number: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    await _get_device_or_404(serial_number)

    try:
        result = await device_service.transition_device_status(
            serial_number=serial_number,
            expected_status="assistance_in_progress",
            new_status="available",
            event_type="assistance_resolved",
            actor_user_id=current_user.id,
        )
    except Exception as exc:
        logger.error("Failed to resolve device: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    if not result.success:
        raise HTTPException(
            status_code=409,
            detail=f"Device must be in assistance_in_progress before resolve (current: {result.current_status})",
        )

    return DeviceOut(**result.device)


@router.get("/{serial_number}", response_model=DeviceOut)
async def get_device(
    serial_number: str,
    _current_user: CurrentUser = Depends(get_current_user),
):
    try:
        device = await _get_device_or_404(serial_number)
        return DeviceOut(**device)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to retrieve device: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{serial_number}/events", response_model=List[DeviceEventOut])
async def get_device_events(
    serial_number: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    _current_user: CurrentUser = Depends(get_current_user),
):
    await _get_device_or_404(serial_number)

    try:
        rows = await device_service.get_device_events(
            serial_number=serial_number,
            skip=skip,
            limit=limit,
        )
        return [DeviceEventOut(**row) for row in rows]
    except Exception as exc:
        logger.error("Failed to get device events: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

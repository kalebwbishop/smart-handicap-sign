from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.middleware.auth import CurrentUser, get_current_user
from app.services import device_service
from app.services import device_twin_service
from app.utils.logger import logger

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceOut(BaseModel):
    serial_number: str
    model_code: Optional[str] = None
    hardware_revision: Optional[str] = None
    firmware_version: Optional[str] = None
    lifecycle_status: Optional[str] = "active"
    connectivity_status: Optional[str] = "online"
    operational_status: Optional[str] = None
    claim_status: Optional[str] = None
    organization_id: Optional[str] = None
    current_site_id: Optional[str] = None
    current_parking_space_id: Optional[str] = None
    name: Optional[str] = None
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DeviceStatusOut(BaseModel):
    serial_number: str
    status: str
    operational_status: str
    connectivity_status: str = "online"


class DeviceEventOut(BaseModel):
    id: str
    device_id: str
    event_type: str
    payload: Optional[dict] = None
    correct_response: Optional[bool]
    created_at: Optional[datetime] = None


class DeviceFalsePositiveOut(BaseModel):
    device: DeviceOut
    device_event: DeviceEventOut


class DeviceTwinOut(BaseModel):
    serial_number: str
    desired_properties: dict[str, Any] = Field(default_factory=dict)
    reported_properties: dict[str, Any] = Field(default_factory=dict)
    etag: Optional[str] = None


class DeviceTwinDesiredUpdateIn(BaseModel):
    desired_properties: dict[str, Any] = Field(min_length=1)


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


@router.get("/{serial_number}/status", response_model=DeviceStatusOut, deprecated=True)
async def get_device_status(serial_number: str):
    device = await device_service.update_device_last_seen(serial_number)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    status = device.get("operational_status") or "available"
    return {
        "serial_number": serial_number,
        "status": status,
        "operational_status": status,
        "connectivity_status": device.get("connectivity_status") or "online",
    }


@router.get("/{serial_number}/twin", response_model=DeviceTwinOut)
async def get_device_twin(
    serial_number: str,
    _current_user: CurrentUser = Depends(get_current_user),
):
    await _get_device_or_404(serial_number)

    try:
        twin = await device_twin_service.get_device_twin_state(serial_number)
        return DeviceTwinOut(**twin)
    except RuntimeError as exc:
        logger.error("IoT Hub twin lookup is not configured: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to retrieve device twin: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=str(exc))


@router.patch("/{serial_number}/twin/desired", response_model=DeviceTwinOut)
async def update_device_twin_desired_properties(
    serial_number: str,
    payload: DeviceTwinDesiredUpdateIn,
    _current_user: CurrentUser = Depends(get_current_user),
):
    await _get_device_or_404(serial_number)

    try:
        twin = await device_twin_service.update_device_desired_properties(
            serial_number,
            payload.desired_properties,
        )
        return DeviceTwinOut(**twin)
    except RuntimeError as exc:
        logger.error("IoT Hub desired-property update is not configured: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to update device twin desired properties: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=str(exc))


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


@router.post("/{serial_number}/events/{device_event_id}/false-positive", response_model=DeviceFalsePositiveOut)
async def mark_device_event_false_positive(
    serial_number: str,
    device_event_id: str,
    _current_user: CurrentUser = Depends(get_current_user),
):
    await _get_device_or_404(serial_number)

    try:
        result = await device_service.mark_assistance_request_false_positive(
            serial_number=serial_number,
            device_event_id=device_event_id,
        )
    except Exception as exc:
        logger.error("Failed to mark false positive: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    if not result.success:
        error_code = getattr(result, "error_code", None)
        if error_code in {"device_not_found", "device_event_not_found"}:
            raise HTTPException(status_code=404, detail="Device event not found")
        raise HTTPException(
            status_code=409,
            detail=f"Device must be in assistance_requested before marking false positive (current: {result.current_status})",
        )

    return DeviceFalsePositiveOut(
        device=DeviceOut(**result.device),
        device_event=DeviceEventOut(**result.device_event),
    )


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

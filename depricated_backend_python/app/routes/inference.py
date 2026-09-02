from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.middleware.device_auth import AuthenticatedDevice, get_authenticated_device
from app.services import device_service
from app.services.telemetry_service import DeviceTelemetryIn as ClassifyRequest
from app.services.telemetry_service import process_device_signal

router = APIRouter(prefix="/inference", tags=["inference"])


class ClassifyResponse(BaseModel):
    label: str
    confidence: float


@router.post("/classify", response_model=ClassifyResponse, deprecated=True)
async def classify(
    payload: ClassifyRequest,
    device: AuthenticatedDevice = Depends(get_authenticated_device),
):
    await device_service.update_device_last_seen(device.serial_number)

    if payload.serial_number and payload.serial_number != device.serial_number:
        return JSONResponse(
            status_code=403,
            content={"error": "Device can only submit telemetry for its own serial number"},
        )
    if not payload.serial_number:
        payload.serial_number = device.serial_number

    try:
        result = await process_device_signal(payload.serial_number, payload.samples)
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": "Validation Error", "message": str(exc)},
        )

    return result

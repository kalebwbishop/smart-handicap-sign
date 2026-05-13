"""Device claims router — QR code registration endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

from app.middleware.auth import CurrentUser, get_current_user
from app.middleware.rate_limiter import check_claim_rate_limit
from app.services import device_service
from app.utils.logger import logger

router = APIRouter(prefix="/device-claims", tags=["device-claims"])


# ── request / response models ────────────────────────────────────────

class ClaimValidateRequest(BaseModel):
    serial_number: str = Field(..., description="Device serial number from QR code")
    claim_id: str = Field(..., description="One-time claim code from QR code")


class DeviceSummary(BaseModel):
    serial_number: str
    model_code: Optional[str] = None
    hardware_revision: Optional[str] = None
    lifecycle_status: str


class ClaimValidateResponse(BaseModel):
    valid: bool
    device: Optional[DeviceSummary] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class ClaimRequest(BaseModel):
    serial_number: str
    claim_id: str
    customer_id: str = Field(..., description="Organization ID to assign device to")
    site_id: str
    parking_space_id: str
    accessible_type: str = Field(..., description="standard, van_accessible, temporary, or reserved")
    installation_photos: List[str] = Field(default_factory=list)
    install_notes: Optional[str] = None


class ClaimDeviceResult(BaseModel):
    serial_number: str
    lifecycle_status: str
    customer_id: str
    site_id: str
    parking_space_id: str


class ClaimResponse(BaseModel):
    success: bool
    device: Optional[ClaimDeviceResult] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


# ── POST /device-claims/validate ─────────────────────────────────────

@router.post(
    "/validate",
    response_model=ClaimValidateResponse,
    dependencies=[Depends(check_claim_rate_limit)],
)
async def validate_device_claim(
    body: ClaimValidateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Validate a device claim before committing.
    Checks device exists, is claimable, and claim ID is correct.
    Rate-limited to prevent brute-force.
    """
    result = await device_service.validate_claim(body.serial_number, body.claim_id)

    if not result.valid:
        return ClaimValidateResponse(
            valid=False,
            error=result.error,
            error_code=result.error_code,
        )

    return ClaimValidateResponse(
        valid=True,
        device=DeviceSummary(
            serial_number=result.device["serial_number"],
            model_code=result.device.get("model_code"),
            hardware_revision=result.device.get("hardware_revision"),
            lifecycle_status=result.device["lifecycle_status"],
        ),
    )


# ── POST /device-claims/claim ────────────────────────────────────────

@router.post(
    "/claim",
    response_model=ClaimResponse,
    dependencies=[Depends(check_claim_rate_limit)],
)
async def claim_device(
    body: ClaimRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Execute the device claim. Atomically assigns the device to the specified
    organization, site, and parking space. Creates installation record and audit log.

    Requires authenticated user who is a member (installer/admin/owner) of the target organization.
    """
    # Authorization check: user must be a member of the target org
    from app.services import organization_service
    role = await organization_service.get_user_role(body.customer_id, current_user.id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a member of the target organization")
    if role not in ("owner", "admin", "installer"):
        raise HTTPException(status_code=403, detail="Insufficient role to claim devices (requires installer, admin, or owner)")

    result = await device_service.execute_claim(
        serial_number=body.serial_number,
        claim_id=body.claim_id,
        user_id=current_user.id,
        organization_id=body.customer_id,
        site_id=body.site_id,
        parking_space_id=body.parking_space_id,
        accessible_type=body.accessible_type,
        installation_photos=body.installation_photos,
        install_notes=body.install_notes,
    )

    if not result.success:
        status_map = {
            "invalid_serial": 400,
            "device_not_found": 404,
            "invalid_claim_id": 400,
            "claim_already_used": 409,
            "claim_expired": 410,
            "claim_revoked": 410,
            "device_already_active": 409,
            "device_revoked": 409,
            "device_retired": 409,
            "device_not_claimable": 409,
            "no_claim_configured": 500,
            "site_not_found": 404,
            "site_org_mismatch": 403,
            "space_not_found": 404,
            "space_site_mismatch": 400,
            "space_occupied": 409,
        }
        status_code = status_map.get(result.error_code, 400)
        raise HTTPException(
            status_code=status_code,
            detail={
                "error": result.error,
                "error_code": result.error_code,
            },
        )

    logger.info("Device %s claimed by user %s for org %s", body.serial_number, current_user.id, body.customer_id)

    return ClaimResponse(
        success=True,
        device=ClaimDeviceResult(
            serial_number=body.serial_number,
            lifecycle_status="active",
            customer_id=body.customer_id,
            site_id=body.site_id,
            parking_space_id=body.parking_space_id,
        ),
    )

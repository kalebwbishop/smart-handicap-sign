from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.middleware.auth import CurrentUser, get_current_user
from app.services import push_token_service
from app.utils.logger import logger

router = APIRouter(prefix="/push-tokens", tags=["push-tokens"])


# ── request / response models ────────────────────────────────────────


class PushTokenRegister(BaseModel):
    expo_push_token: str = Field(..., description="Expo push notification token")
    device_id: Optional[str] = Field(None, description="Optional device identifier")


class PushTokenUnregister(BaseModel):
    expo_push_token: str = Field(..., description="Expo push notification token to remove")


class PushTokenOut(BaseModel):
    id: str
    user_id: str
    expo_push_token: str
    device_id: Optional[str]
    created_at: datetime


# ── POST /push-tokens ────────────────────────────────────────────────


@router.post("", response_model=PushTokenOut, status_code=201)
async def register_push_token(
    body: PushTokenRegister,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Register an Expo push token for the current user."""
    try:
        result = await push_token_service.register_token(
            user_id=current_user.id,
            expo_push_token=body.expo_push_token,
            device_id=body.device_id,
        )
        return PushTokenOut(**result)

    except Exception as e:
        logger.error(f"Failed to register push token: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── DELETE /push-tokens ──────────────────────────────────────────────


@router.delete("", status_code=204)
async def unregister_push_token(
    body: PushTokenUnregister,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Unregister an Expo push token."""
    try:
        await push_token_service.unregister_token(
            expo_push_token=body.expo_push_token,
        )
        return Response(status_code=204)

    except Exception as e:
        logger.error(f"Failed to unregister push token: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

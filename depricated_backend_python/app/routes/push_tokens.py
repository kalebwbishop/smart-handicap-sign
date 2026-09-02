from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel, Field

from app.middleware.auth import CurrentUser, get_current_user
from app.services import notification_service
from app.utils.logger import logger

router = APIRouter(prefix="/push-tokens", tags=["push-tokens"])


class PushTokenRegisterRequest(BaseModel):
    expo_push_token: str = Field(..., min_length=1)
    device_id: Optional[str] = None
    platform: Optional[str] = None
    device_name: Optional[str] = None


class PushTokenDeleteRequest(BaseModel):
    expo_push_token: str = Field(..., min_length=1)


class PushTokenOut(BaseModel):
    expo_push_token: str


class PushTokenDeleteOut(BaseModel):
    removed: bool


@router.post("", response_model=PushTokenOut)
async def register_push_token(
    payload: PushTokenRegisterRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await notification_service.register_push_token(
            user_id=current_user.id,
            expo_push_token=payload.expo_push_token,
            platform=payload.platform,
            device_name=payload.device_name,
        )
        return PushTokenOut(expo_push_token=result["expo_push_token"])
    except Exception as exc:
        logger.error("Failed to register push token: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("", response_model=PushTokenDeleteOut)
async def unregister_push_token(
    payload: PushTokenDeleteRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        removed = await notification_service.unregister_push_token(
            user_id=current_user.id,
            expo_push_token=payload.expo_push_token,
        )
        return {"removed": removed}
    except Exception as exc:
        logger.error("Failed to unregister push token: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

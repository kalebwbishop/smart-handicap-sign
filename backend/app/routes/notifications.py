from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.middleware.auth import CurrentUser, get_current_user
from app.services import notification_service
from app.utils.logger import logger

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: str
    device_event_id: str | None = None
    user_id: str | None = None
    title: str
    body: str
    read: bool
    created_at: datetime
    updated_at: datetime


class UnreadCountOut(BaseModel):
    unread_count: int


class MarkAllReadOut(BaseModel):
    marked_read: int


class NotificationPreferencesOut(BaseModel):
    assistance_requests_enabled: bool
    push_enabled: bool


class NotificationPreferencesUpdate(BaseModel):
    assistance_requests_enabled: bool | None = None
    push_enabled: bool | None = None


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    after: datetime | None = Query(default=None),
    read: bool | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        rows = await notification_service.list_notifications(
            user_id=current_user.id,
            after=after,
            read=read,
        )
        return [NotificationOut(**row) for row in rows]
    except Exception as exc:
        logger.error("Failed to list notifications: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/unread/count", response_model=UnreadCountOut)
async def get_unread_count(current_user: CurrentUser = Depends(get_current_user)):
    try:
        unread_count = await notification_service.get_unread_count(user_id=current_user.id)
        return {"unread_count": unread_count}
    except Exception as exc:
        logger.error("Failed to get unread notification count: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        notification = await notification_service.mark_notification_read(
            notification_id=notification_id,
            user_id=current_user.id,
        )
    except Exception as exc:
        logger.error("Failed to mark notification as read: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationOut(**notification)


@router.post("/read-all", response_model=MarkAllReadOut)
async def mark_all_notifications_read(current_user: CurrentUser = Depends(get_current_user)):
    try:
        marked_read = await notification_service.mark_all_notifications_read(
            user_id=current_user.id,
        )
        return {"marked_read": marked_read}
    except Exception as exc:
        logger.error("Failed to mark all notifications as read: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/preferences", response_model=NotificationPreferencesOut)
async def get_notification_preferences(current_user: CurrentUser = Depends(get_current_user)):
    try:
        preferences = await notification_service.get_notification_preferences(
            user_id=current_user.id,
        )
        return NotificationPreferencesOut(**preferences)
    except Exception as exc:
        logger.error("Failed to get notification preferences: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/preferences", response_model=NotificationPreferencesOut)
async def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        preferences = await notification_service.update_notification_preferences(
            user_id=current_user.id,
            assistance_requests_enabled=payload.assistance_requests_enabled,
            push_enabled=payload.push_enabled,
        )
        return NotificationPreferencesOut(**preferences)
    except Exception as exc:
        logger.error("Failed to update notification preferences: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

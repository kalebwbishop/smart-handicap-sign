from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.middleware.auth import CurrentUser, get_current_user
from app.services import notification_service
from app.utils.logger import logger

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── request / response models ────────────────────────────────────────


class NotificationCreate(BaseModel):
    event_id: Optional[str] = Field(
        None, description="Optional ID of the event that triggered this notification"
    )
    title: str = Field(..., description="Notification title")
    body: str = Field(..., description="Notification body text")
    read: Optional[bool] = Field(
        default=False,
        description="Whether the notification has been read",
    )


class NotificationUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Notification title")
    body: Optional[str] = Field(None, description="Notification body text")
    read: Optional[bool] = Field(
        None, description="Whether the notification has been read"
    )


class NotificationOut(BaseModel):
    id: str
    event_id: Optional[str]
    user_id: Optional[str] = None
    title: str
    body: str
    read: bool
    created_at: datetime
    updated_at: datetime


# ── CREATE /notifications ────────────────────────────────────────────


@router.post("", response_model=NotificationOut, status_code=201)
async def create_notification(
    notification: NotificationCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new notification."""
    try:
        result = await notification_service.create_notification(
            event_id=notification.event_id,
            title=notification.title,
            body=notification.body,
            read=notification.read if notification.read is not None else False,
        )
        return NotificationOut(**result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── READ /notifications ─────────────────────────────────────────────


@router.get("", response_model=List[NotificationOut])
async def list_notifications(
    event_id: Optional[str] = Query(None, description="Filter by event ID"),
    read: Optional[bool] = Query(None, description="Filter by read status"),
    after: Optional[datetime] = Query(None, description="Return notifications created after this date/time (ISO 8601)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve notifications for the current user with optional filtering."""
    try:
        rows = await notification_service.list_notifications(
            user_id=current_user.id,
            event_id=event_id,
            read=read,
            after=after,
            skip=skip,
            limit=limit,
        )
        return [NotificationOut(**r) for r in rows]

    except Exception as e:
        logger.error(f"Failed to list notifications: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread/count")
async def unread_count(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get the count of unread notifications for the current user."""
    try:
        count = await notification_service.get_unread_count(user_id=current_user.id)
        return {"unread_count": count}

    except Exception as e:
        logger.error(f"Failed to get unread count: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notification_id}", response_model=NotificationOut)
async def get_notification(
    notification_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a specific notification by ID."""
    try:
        result = await notification_service.get_notification(notification_id)
        if not result:
            raise HTTPException(status_code=404, detail="Notification not found")
        return NotificationOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── UPDATE /notifications/{notification_id} ──────────────────────────


@router.patch("/{notification_id}", response_model=NotificationOut)
async def update_notification(
    notification_id: str,
    notification: NotificationUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a specific notification."""
    try:
        result = await notification_service.update_notification(
            notification_id,
            title=notification.title,
            body=notification.body,
            read=notification.read,
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Notification not found")
        return NotificationOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── MARK READ ────────────────────────────────────────────────────────


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_as_read(
    notification_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark a single notification as read."""
    try:
        result = await notification_service.mark_as_read(notification_id)
        if not result:
            raise HTTPException(status_code=404, detail="Notification not found")
        return NotificationOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark notification as read: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/read-all", status_code=200)
async def mark_all_as_read(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark all unread notifications as read for the current user."""
    try:
        count = await notification_service.mark_all_as_read(user_id=current_user.id)
        return {"marked_read": count}

    except Exception as e:
        logger.error(f"Failed to mark all as read: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── DELETE /notifications/{notification_id} ──────────────────────────


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a specific notification."""
    try:
        deleted = await notification_service.delete_notification(notification_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Notification not found")
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum

from app.middleware.auth import CurrentUser, get_current_user
from app.services import event_service
from app.utils.logger import logger

router = APIRouter(prefix="/events", tags=["events"])


# ── enums ────────────────────────────────────────────────────────────


class EventType(str, Enum):
    status_change = "status_change"
    alert = "alert"
    maintenance = "maintenance"
    misuse = "misuse"


# ── request / response models ────────────────────────────────────────


class EventCreate(BaseModel):
    sign_id: str = Field(..., description="ID of the sign this event belongs to")
    type: EventType = Field(..., description="Type of event")
    data: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Arbitrary JSON payload with event-specific details",
    )
    create_notification: Optional[bool] = Field(
        default=False,
        description="Whether to also create a notification for this event",
    )
    notification_title: Optional[str] = Field(
        None,
        description="Title for the auto-created notification (required if create_notification is True)",
    )
    notification_body: Optional[str] = Field(
        None,
        description="Body for the auto-created notification (defaults to event type description)",
    )


class EventUpdate(BaseModel):
    type: Optional[EventType] = Field(None, description="Type of event")
    data: Optional[Dict[str, Any]] = Field(
        None, description="Arbitrary JSON payload with event-specific details"
    )


class EventOut(BaseModel):
    id: str
    sign_id: str
    type: EventType
    data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ── CREATE /events ───────────────────────────────────────────────────


@router.post("", response_model=EventOut, status_code=201)
async def create_event(
    event: EventCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new event for a sign, optionally creating a notification."""
    try:
        result = await event_service.create_event(
            sign_id=event.sign_id,
            event_type=event.type.value,
            data=event.data,
            create_notification=bool(event.create_notification),
            notification_title=event.notification_title,
            notification_body=event.notification_body,
        )
        return EventOut(**result)

    except ValueError as e:
        raise HTTPException(
            status_code=404 if "not found" in str(e).lower() else 400,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to create event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── READ /events ─────────────────────────────────────────────────────


@router.get("", response_model=List[EventOut])
async def list_events(
    sign_id: Optional[str] = Query(None, description="Filter by sign ID"),
    type: Optional[EventType] = Query(None, description="Filter by event type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve events with optional filtering."""
    try:
        rows = await event_service.list_events(
            sign_id=sign_id,
            event_type=type.value if type else None,
            skip=skip,
            limit=limit,
        )
        return [EventOut(**r) for r in rows]

    except Exception as e:
        logger.error(f"Failed to list events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{event_id}", response_model=EventOut)
async def get_event(
    event_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a specific event by ID."""
    try:
        result = await event_service.get_event(event_id)
        if not result:
            raise HTTPException(status_code=404, detail="Event not found")
        return EventOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /events/{event_id}/notifications ─────────────────────────────


@router.get("/{event_id}/notifications")
async def get_event_notifications(
    event_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve all notifications linked to a specific event."""
    try:
        return await event_service.get_event_notifications(event_id)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to retrieve event notifications: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── UPDATE /events/{event_id} ────────────────────────────────────────


@router.patch("/{event_id}", response_model=EventOut)
async def update_event(
    event_id: str,
    event: EventUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a specific event."""
    try:
        result = await event_service.update_event(
            event_id,
            event_type=event.type.value if event.type else None,
            data=event.data,
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Event not found")
        return EventOut(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── DELETE /events/{event_id} ────────────────────────────────────────


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a specific event and its linked notifications."""
    try:
        deleted = await event_service.delete_event(event_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Event not found")
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

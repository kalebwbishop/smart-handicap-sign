from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.middleware.auth import CurrentUser, get_current_user
from app.services.live_updates import stream_mobile_home_updates

router = APIRouter(prefix="/mobile", tags=["mobile-updates"])


@router.get("/home/updates")
async def stream_home_updates(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
):
    return StreamingResponse(
        stream_mobile_home_updates(user_id=current_user.id, request=request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

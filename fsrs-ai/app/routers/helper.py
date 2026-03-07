"""Helper router — FSRS Helper endpoints (reschedule, etc.)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import RescheduleResponse, UserIDRequest
from app.services import optimizer_service

router = APIRouter(prefix="/api/v1/fsrs/helper", tags=["FSRS Helper"])


@router.post("/reschedule", response_model=RescheduleResponse)
async def reschedule(
    request: UserIDRequest,
    db: AsyncSession = Depends(get_db),
):
    """Lập lịch lại toàn bộ card sau khi đã optimize weights.

    Replay lại review history với scheduler mới để cập nhật next_review.
    """
    count = await optimizer_service.reschedule_cards(db, request.user_id)
    return RescheduleResponse(status="success", cards_rescheduled=count)

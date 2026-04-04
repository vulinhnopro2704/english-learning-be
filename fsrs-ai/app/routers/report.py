"""Reporting router — human-readable analytics endpoints."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import DailyReportResponse, NarrativeResponse, RiskCardsResponse
from app.services import report_service
from app.utils.auth import resolve_user_id

router = APIRouter(prefix="/api/v1/fsrs", tags=["FSRS Reports"])


@router.get(
    "/insights",
    response_model=NarrativeResponse,
    summary="Get Learning Insights",
    description=(
        "Tra ve KPI tong hop theo cua so thoi gian (`7d|30d|90d`).\n\n"
        "Response luon co 2 lop:\n"
        "- `metrics`: du lieu cho chart\n"
        "- `narrative`: 1-3 cau tieng Viet cho user doc nhanh"
    ),
)
async def insights(
    request: Request,
    user_id: UUID | None = Query(
        None, description="User UUID (optional when gateway forwards x-user-id)"
    ),
    window: str = Query("30d", pattern="^(7d|30d|90d)$"),
    db: AsyncSession = Depends(get_db),
):
    effective_user_id = resolve_user_id(request, user_id)
    return await report_service.get_insights(db, effective_user_id, window)


@router.get(
    "/report/daily",
    response_model=DailyReportResponse,
    summary="Get Daily Time-Series Report",
    description=(
        "Chuoi thoi gian theo ngay trong khoang `from` -> `to`:\n"
        "- reviews/day\n"
        "- accuracy/day\n"
        "- avg response time/day\n"
        "- due created vs due completed"
    ),
)
async def daily_report(
    request: Request,
    user_id: UUID | None = Query(
        None, description="User UUID (optional when gateway forwards x-user-id)"
    ),
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: AsyncSession = Depends(get_db),
):
    effective_user_id = resolve_user_id(request, user_id)
    return await report_service.get_daily_report(
        db,
        effective_user_id,
        from_date,
        to_date,
    )


@router.get(
    "/recommendations",
    response_model=NarrativeResponse,
    summary="Get Study Recommendations",
    description=(
        "Sinh goi y tu dong cho user dua tren tinh trang qua han, toc do, "
        "va do chinh xac gan day."
    ),
)
async def recommendations(
    request: Request,
    user_id: UUID | None = Query(
        None, description="User UUID (optional when gateway forwards x-user-id)"
    ),
    db: AsyncSession = Depends(get_db),
):
    effective_user_id = resolve_user_id(request, user_id)
    return await report_service.get_recommendations(db, effective_user_id)


@router.get(
    "/cards/risk",
    response_model=RiskCardsResponse,
    summary="Get High-Risk Cards",
    description=(
        "Tra ve top cards co rui ro quen cao de uu tien on tap.\n\n"
        "Risk score duoc tinh tu retrievability va muc do overdue."
    ),
)
async def risk_cards(
    request: Request,
    user_id: UUID | None = Query(
        None, description="User UUID (optional when gateway forwards x-user-id)"
    ),
    take: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    effective_user_id = resolve_user_id(request, user_id)
    return await report_service.get_risk_cards(db, effective_user_id, take)

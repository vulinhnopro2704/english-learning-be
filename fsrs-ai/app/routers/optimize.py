"""Optimize router — AI optimizer endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import OptimizeResponse, UserIDRequest
from app.services import optimizer_service

router = APIRouter(prefix="/api/v1/fsrs", tags=["FSRS Optimizer"])


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize(
    request: UserIDRequest,
    db: AsyncSession = Depends(get_db),
):
    """Chạy AI Optimizer để tính bộ trọng số FSRS tối ưu cho user.

    Yêu cầu: User phải có ít nhất 10 review logs.
    """
    result = await optimizer_service.optimize_parameters(db, request.user_id)
    return OptimizeResponse(**result)

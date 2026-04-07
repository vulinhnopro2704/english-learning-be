"""Optimize router — AI optimizer endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas import (
    OptimizeResponse,
    RollbackRequest,
    RollbackResponse,
    UserIDRequest,
)
from app.services import optimizer_service

router = APIRouter(prefix="/api/v1/fsrs", tags=["FSRS Optimizer"])


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    summary="Optimize FSRS Weights",
    description=(
        "Chay optimizer FSRS v6 voi policy gate.\n\n"
        "Dieu kien train (env configurable):\n"
        "- `valid_logs >= FSRS_TRAIN_MIN_VALID_LOGS`\n"
        "- Cach lan train accepted truoc >= `FSRS_TRAIN_MIN_DAYS_SINCE_LAST`\n\n"
        "Candidate chi duoc accept neu metric tot hon baseline it nhat "
        "`FSRS_TRAIN_MIN_IMPROVEMENT_PCT`.\n"
        "Neu accepted va bat async flag, he thong se trigger reschedule nen."
    ),
)
async def optimize(
    request: UserIDRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Run optimizer with policy gate and optional async reschedule."""
    result = await optimizer_service.optimize_parameters(db, request.user_id)

    if (
        result.get("accepted")
        and settings.FSRS_ASYNC_RESCHEDULE_ENABLED
        and result.get("status") == "success"
    ):
        background_tasks.add_task(
            optimizer_service.run_reschedule_for_user,
            request.user_id,
        )

    return OptimizeResponse(**result)


@router.post(
    "/optimize/rollback",
    response_model=RollbackResponse,
    summary="Rollback FSRS Model",
    description=(
        "Rollback model hien tai ve ban accepted truoc do.\n\n"
        "- Neu co `targetVersion` thi rollback den version chi dinh.\n"
        "- Neu khong truyen, he thong chon ban accepted gan nhat < current version."
    ),
)
async def rollback(
    request: RollbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Rollback to previous accepted model version (or specific target version)."""
    result = await optimizer_service.rollback_model(
        db,
        request.user_id,
        request.target_version,
    )
    return RollbackResponse(**result)

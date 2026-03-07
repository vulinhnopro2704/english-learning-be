"""Review router — Core FSRS endpoints for scheduling and review."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    BulkReviewRequest,
    BulkReviewResponse,
    CardStateResponse,
    DueCardsResponse,
    FSRSStatsResponse,
    ReviewRequest,
    ReviewResponse,
)
from app.services import fsrs_service

router = APIRouter(prefix="/api/v1/fsrs", tags=["FSRS"])


@router.get("/due", response_model=DueCardsResponse)
async def get_due_cards(
    user_id: UUID = Query(..., description="User UUID"),
    limit: int = Query(20, ge=1, le=200, description="Max cards to return"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách word IDs đến hạn ôn tập (spaced repetition)."""
    word_ids = await fsrs_service.get_due_cards(db, user_id, limit)
    return DueCardsResponse(word_ids=word_ids, total=len(word_ids))


@router.post("/review", response_model=ReviewResponse)
async def review_card(
    request: ReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit kết quả review 1 từ (auto-grading từ is_correct + duration)."""
    card_state, grade = await fsrs_service.review_card(
        db=db,
        user_id=request.user_id,
        word_id=request.word_id,
        is_correct=request.is_correct,
        duration_ms=request.duration_ms,
        exercise_type=request.exercise_type,
    )
    return ReviewResponse(
        card=CardStateResponse(
            word_id=card_state.word_id,
            state=card_state.state,
            difficulty=card_state.difficulty,
            stability=card_state.stability,
            retrievability=card_state.retrievability,
            next_review=card_state.next_review,
            reps=card_state.reps,
            lapses=card_state.lapses,
            grade=grade,
        ),
    )


@router.post("/review/bulk", response_model=BulkReviewResponse)
async def bulk_review(
    request: BulkReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """Batch review nhiều từ một lúc (sau khi hoàn thành 1 practice session)."""
    items = [item.model_dump() for item in request.items]
    results = await fsrs_service.bulk_review(db, request.user_id, items)

    cards = []
    correct = 0
    for card_state, grade in results:
        cards.append(
            CardStateResponse(
                word_id=card_state.word_id,
                state=card_state.state,
                difficulty=card_state.difficulty,
                stability=card_state.stability,
                retrievability=card_state.retrievability,
                next_review=card_state.next_review,
                reps=card_state.reps,
                lapses=card_state.lapses,
                grade=grade,
            )
        )
        if grade >= 2:  # Hard, Good, Easy = correct
            correct += 1

    return BulkReviewResponse(
        cards=cards,
        total=len(cards),
        correct=correct,
    )


@router.post("/init-cards")
async def init_cards(
    user_id: UUID = Query(...),
    word_ids: list[int] = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Khởi tạo card mới cho các từ (khi user unlock lesson)."""
    cards = await fsrs_service.init_cards(db, user_id, word_ids)
    return {
        "message": f"Initialized {len(cards)} cards",
        "word_ids": [c.word_id for c in cards],
    }


@router.get("/stats", response_model=FSRSStatsResponse)
async def get_stats(
    user_id: UUID = Query(..., description="User UUID"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy thống kê FSRS cho user (số thẻ, due, retrievability, ...)."""
    stats = await fsrs_service.get_stats(db, user_id)
    return FSRSStatsResponse(**stats)

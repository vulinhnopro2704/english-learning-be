"""Review router — Core FSRS endpoints for scheduling and review."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    BulkReviewRequest,
    BulkReviewResponse,
    CardStateResponse,
    DueCardsResponse,
    FSRSStatsResponse,
    InitCardsResponse,
    ReviewRequest,
    ReviewResponse,
)
from app.services import fsrs_service
from app.utils.auth import resolve_user_id

router = APIRouter(prefix="/api/v1/fsrs", tags=["FSRS"])


@router.get(
    "/due",
    response_model=DueCardsResponse,
    summary="Get Due Card IDs",
    description=(
        "Tra ve danh sach `wordId` den han on tap cho user theo FSRS.\n\n"
        "- Loc theo `nextReview <= now` hoac card moi (`nextReview = null`).\n"
        "- Ton trong gioi han `maxReviewsPerDay` trong `fsrs_config`.\n"
        "- `limit` toi da 200."
    ),
)
async def get_due_cards(
    request: Request,
    user_id: UUID | None = Query(None, description="User UUID (optional when gateway forwards x-user-id)"),
    limit: int = Query(20, ge=1, le=200, description="Max cards to return"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách word IDs đến hạn ôn tập (spaced repetition)."""
    effective_user_id = resolve_user_id(request, user_id)
    word_ids = await fsrs_service.get_due_cards(db, effective_user_id, limit)
    return DueCardsResponse(word_ids=word_ids, total=len(word_ids))


@router.post(
    "/review",
    response_model=ReviewResponse,
    summary="Submit Single Review",
    description=(
        "Nhan ket qua on tap 1 the va cap nhat trang thai FSRS.\n\n"
        "- Bat buoc `durationMs > 0`.\n"
        "- Auto-grade tu `isCorrect + durationMs + exerciseType`.\n"
        "- Luu log train voi metadata `attempts`."
    ),
)
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
        exercise_type=request.exercise_type.value,
        attempts=request.attempts,
        had_wrong=request.had_wrong,
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


@router.post(
    "/review/bulk",
    response_model=BulkReviewResponse,
    summary="Submit Bulk Review",
    description=(
        "Nhan danh sach review items trong 1 practice session.\n\n"
        "- Moi item bat buoc `durationMs > 0`.\n"
        "- Xu ly theo tung card trong 1 transaction batch.\n"
        "- Tra ve trang thai card moi va grade da su dung."
    ),
)
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


@router.post(
    "/init-cards",
    response_model=InitCardsResponse,
    summary="Initialize Cards",
    description=(
        "Khoi tao FSRS cards cho danh sach tu moi user vua unlock.\n\n"
        "- Neu card da ton tai thi giu nguyen, khong tao trung.\n"
        "- Endpoint nay thuong duoc `learn` goi sau khi complete lesson."
    ),
)
async def init_cards(
    request: Request,
    user_id: UUID | None = Query(None),
    word_ids: list[int] = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Khởi tạo card mới cho các từ (khi user unlock lesson)."""
    effective_user_id = resolve_user_id(request, user_id)
    cards = await fsrs_service.init_cards(db, effective_user_id, word_ids)
    return {
        "message": f"Initialized {len(cards)} cards",
        "word_ids": [c.word_id for c in cards],
    }


@router.get(
    "/stats",
    response_model=FSRSStatsResponse,
    summary="Get FSRS Stats",
    description=(
        "Thong ke tong quan FSRS cho 1 user: so the theo state, due count, "
        "avg retrievability va tong so review logs."
    ),
)
async def get_stats(
    request: Request,
    user_id: UUID | None = Query(None, description="User UUID (optional when gateway forwards x-user-id)"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy thống kê FSRS cho user (số thẻ, due, retrievability, ...)."""
    effective_user_id = resolve_user_id(request, user_id)
    stats = await fsrs_service.get_stats(db, effective_user_id)
    return FSRSStatsResponse(**stats)

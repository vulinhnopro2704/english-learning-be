from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


def to_camel(s: str) -> str:
    """Convert snake_case to camelCase."""
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class CamelModel(BaseModel):
    """Base model that serializes to camelCase JSON."""

    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }


# ─── Request Schemas ──────────────────────────────────────────────────────────


class ReviewRequest(CamelModel):
    """Single review submission."""

    user_id: UUID
    word_id: int
    is_correct: bool
    duration_ms: int = Field(ge=0, default=0)
    exercise_type: str = "flashcard"  # flashcard, multi_choice, listen_fill, dictation


class ReviewItem(CamelModel):
    """Single item in a bulk review."""

    word_id: int
    is_correct: bool
    duration_ms: int = Field(ge=0, default=0)
    exercise_type: str = "flashcard"


class BulkReviewRequest(CamelModel):
    """Batch review submission."""

    user_id: UUID
    items: list[ReviewItem] = Field(min_length=1)


class UserIDRequest(CamelModel):
    """Request that only needs a user_id."""

    user_id: UUID


# ─── Response Schemas ─────────────────────────────────────────────────────────


class CardStateResponse(CamelModel):
    word_id: int
    state: int
    difficulty: float
    stability: float
    retrievability: float
    next_review: datetime | None
    reps: int
    lapses: int
    grade: int

    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
        "from_attributes": True,
    }


class ReviewResponse(CamelModel):
    """Response for a single review."""

    card: CardStateResponse
    message: str = "Review processed"


class BulkReviewResponse(CamelModel):
    """Response for batch review."""

    cards: list[CardStateResponse]
    total: int
    correct: int
    message: str = "Bulk review processed"


class DueCardsResponse(CamelModel):
    """Word IDs due for review."""

    word_ids: list[int]
    total: int


class OptimizeResponse(CamelModel):
    status: str
    new_weights: list[float]
    optimal_retention: float | None = None


class RescheduleResponse(CamelModel):
    status: str
    cards_rescheduled: int


class FSRSStatsResponse(CamelModel):
    total_cards: int
    due_count: int
    new_count: int
    learning_count: int
    review_count: int
    relearning_count: int
    average_retrievability: float
    total_reviews: int

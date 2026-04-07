from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


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


class ExerciseType(str, Enum):
    FLASHCARD = "FLASHCARD"
    FLIP = "FLIP"
    MULTI_CHOICE = "MULTI_CHOICE"
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    LISTEN_FILL = "LISTEN_FILL"
    DICTATION = "DICTATION"
    FILL_BLANK = "FILL_BLANK"
    MEANING_LOOKUP = "MEANING_LOOKUP"
    SPEED_CHALLENGE = "SPEED_CHALLENGE"
    WORD_PUZZLE = "WORD_PUZZLE"
    MATCHING_PAIRS = "MATCHING_PAIRS"
    STREAK_CHALLENGE = "STREAK_CHALLENGE"
    PRONUNCIATION = "PRONUNCIATION"


# ─── Request Schemas ──────────────────────────────────────────────────────────


class ReviewRequest(CamelModel):
    """Single review submission."""

    user_id: UUID
    word_id: int
    is_correct: bool
    duration_ms: int = Field(gt=0)
    exercise_type: ExerciseType = ExerciseType.FLASHCARD
    attempts: int = Field(ge=1, default=1)

    @field_validator("exercise_type", mode="before")
    @classmethod
    def normalize_exercise_type(cls, value: str | ExerciseType) -> str | ExerciseType:
        if isinstance(value, ExerciseType):
            return value
        if isinstance(value, str):
            return value.upper().replace("-", "_")
        return value


class ReviewItem(CamelModel):
    """Single item in a bulk review."""

    word_id: int
    is_correct: bool
    duration_ms: int = Field(gt=0)
    exercise_type: ExerciseType = ExerciseType.FLASHCARD
    attempts: int = Field(ge=1, default=1)

    @field_validator("exercise_type", mode="before")
    @classmethod
    def normalize_exercise_type(cls, value: str | ExerciseType) -> str | ExerciseType:
        if isinstance(value, ExerciseType):
            return value
        if isinstance(value, str):
            return value.upper().replace("-", "_")
        return value


class BulkReviewRequest(CamelModel):
    """Batch review submission."""

    user_id: UUID
    items: list[ReviewItem] = Field(min_length=1)


class UserIDRequest(CamelModel):
    """Request that only needs a user_id."""

    user_id: UUID


class RollbackRequest(CamelModel):
    """Rollback to latest accepted previous model or a specific version."""

    user_id: UUID
    target_version: int | None = Field(default=None, ge=1)


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


class InitCardsResponse(CamelModel):
    message: str
    word_ids: list[int]


class OptimizeResponse(CamelModel):
    status: str
    accepted: bool = False
    reason: str | None = None
    new_weights: list[float]
    optimal_retention: float | None = None
    metric_type: str | None = None
    metric_baseline: float | None = None
    metric_candidate: float | None = None
    improvement_pct: float | None = None
    model_version: int | None = None
    sample_size: int | None = None


class RollbackResponse(CamelModel):
    status: str
    message: str
    restored_version: int | None = None


class RescheduleResponse(CamelModel):
    status: str
    cards_rescheduled: int
    cards_capped: int = 0


class FSRSStatsResponse(CamelModel):
    total_cards: int
    due_count: int
    new_count: int
    learning_count: int
    review_count: int
    relearning_count: int
    average_retrievability: float
    total_reviews: int


class WorkloadForecast(CamelModel):
    next_7d_due: int
    due_tomorrow: int


class MasteryDistribution(CamelModel):
    new: int
    learning: int
    review: int
    relearning: int


class TrendMetrics(CamelModel):
    vs_previous_window: float


class InsightsMetrics(CamelModel):
    memory_score: int
    retention_rate: float
    workload_forecast: WorkloadForecast
    mastery_distribution: MasteryDistribution
    trend: TrendMetrics


class NarrativeResponse(CamelModel):
    metrics: dict | InsightsMetrics
    narrative: list[str] = Field(min_length=1, max_length=3)


class DailyReportPoint(CamelModel):
    date: date
    reviews: int
    accuracy: float
    avg_response_ms: float
    due_created: int
    due_completed: int


class DailyReportMetrics(CamelModel):
    days: list[DailyReportPoint]


class DailyReportResponse(CamelModel):
    metrics: DailyReportMetrics
    narrative: list[str] = Field(min_length=1, max_length=3)


class RecommendationsMetrics(CamelModel):
    overdue_gt3d: int
    speed_delta_pct: float
    accuracy_delta_pct: float
    suggested_daily_limit: int


class RecommendationsResponse(CamelModel):
    metrics: RecommendationsMetrics
    narrative: list[str] = Field(min_length=1, max_length=3)


class RiskCardItem(CamelModel):
    word_id: int
    risk_score: float
    retrievability: float
    days_overdue: int


class RiskCardsMetrics(CamelModel):
    items: list[RiskCardItem]


class RiskCardsResponse(CamelModel):
    metrics: RiskCardsMetrics
    narrative: list[str] = Field(min_length=1, max_length=3)

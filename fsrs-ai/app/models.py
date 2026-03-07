import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    UniqueConstraint,
    Index,
    MetaData,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    metadata = MetaData(schema="fsrs")


class CardMemoryState(Base):
    """Trạng thái bộ nhớ FSRS cho mỗi cặp user-word.

    state: 0=New, 1=Learning, 2=Review, 3=Relearning
    """

    __tablename__ = "card_memory_state"

    id = Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column("userId", UUID(as_uuid=True), nullable=False, index=True)
    word_id = Column("wordId", Integer, nullable=False)

    # FSRS core state
    state = Column("state", Integer, nullable=False, default=0)
    difficulty = Column("difficulty", Float, nullable=False, default=0.0)
    stability = Column("stability", Float, nullable=False, default=0.0)
    retrievability = Column("retrievability", Float, nullable=False, default=1.0)

    # Scheduling
    next_review = Column("nextReview", DateTime(timezone=True), nullable=True)
    last_reviewed_at = Column("lastReviewedAt", DateTime(timezone=True), nullable=True)

    # Counters
    reps = Column("reps", Integer, nullable=False, default=0)
    lapses = Column("lapses", Integer, nullable=False, default=0)

    # Card JSON for py-fsrs (stores the full Card object for accurate scheduling)
    card_data = Column("cardData", JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("userId", "wordId", name="uq_user_word"),
        Index("ix_user_next_review", "userId", "nextReview"),
    )


class ReviewLog(Base):
    """Lịch sử ôn tập — training data cho FSRS Optimizer."""

    __tablename__ = "review_log"

    id = Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column("userId", UUID(as_uuid=True), nullable=False)
    word_id = Column("wordId", Integer, nullable=False)

    grade = Column("grade", Integer, nullable=False)  # 1-4
    duration_ms = Column("durationMs", Integer, nullable=False, default=0)

    # State BEFORE this review
    state = Column("state", Integer, nullable=False, default=0)
    difficulty = Column("difficulty", Float, nullable=False, default=0.0)
    stability = Column("stability", Float, nullable=False, default=0.0)

    elapsed_days = Column("elapsedDays", Float, nullable=False, default=0.0)
    scheduled_days = Column("scheduledDays", Float, nullable=False, default=0.0)

    reviewed_at = Column(
        "reviewedAt",
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Store the full ReviewLog JSON from py-fsrs for optimizer
    log_data = Column("logData", JSONB, nullable=True)

    __table_args__ = (
        Index("ix_review_user_word", "userId", "wordId"),
        Index("ix_review_reviewed_at", "reviewedAt"),
    )


class FSRSConfig(Base):
    """Cấu hình & trọng số ML cá nhân hóa per user."""

    __tablename__ = "fsrs_config"

    user_id = Column("userId", UUID(as_uuid=True), primary_key=True)

    # 21 FSRS weights (default = py-fsrs defaults)
    weights = Column("weights", JSONB, nullable=False, default=[])

    request_retention = Column("requestRetention", Float, nullable=False, default=0.9)
    easy_days = Column("easyDays", JSONB, nullable=False, default=[])  # e.g. [0, 6] for Sun/Sat
    max_reviews_per_day = Column("maxReviewsPerDay", Integer, nullable=False, default=100)

    updated_at = Column(
        "updatedAt",
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

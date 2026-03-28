"""Core FSRS scheduling service.

Uses py-fsrs library for spaced repetition calculations.
Auto-grades based on is_correct + duration_ms + exercise_type (MochiMochi-style).
"""

from datetime import datetime, timezone
from uuid import UUID

from fsrs import Card, Rating, ReviewLog as FSRSReviewLog, Scheduler
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CardMemoryState, FSRSConfig, ReviewLog


# ─── Auto-grading thresholds (milliseconds) ──────────────────────────────────
# Adjustable per exercise type
GRADE_THRESHOLDS: dict[str, dict[str, int]] = {
    "FLASHCARD": {"easy_max_ms": 3000, "hard_min_ms": 10000},
    "MULTI_CHOICE": {"easy_max_ms": 3000, "hard_min_ms": 8000},
    "LISTEN_FILL": {"easy_max_ms": 5000, "hard_min_ms": 15000},
    "DICTATION": {"easy_max_ms": 8000, "hard_min_ms": 20000},
}

DEFAULT_THRESHOLD = {"easy_max_ms": 3000, "hard_min_ms": 10000}


def auto_grade(is_correct: bool, duration_ms: int, exercise_type: str) -> Rating:
    """Convert exercise result into FSRS Rating (1-4).

    - Incorrect → Again (1)
    - Correct + slow → Hard (2)
    - Correct + normal → Good (3)
    - Correct + fast → Easy (4)
    """
    if not is_correct:
        return Rating.Again

    thresholds = GRADE_THRESHOLDS.get(exercise_type, DEFAULT_THRESHOLD)

    if duration_ms <= thresholds["easy_max_ms"]:
        return Rating.Easy
    elif duration_ms >= thresholds["hard_min_ms"]:
        return Rating.Hard
    else:
        return Rating.Good


def _build_scheduler(config: FSRSConfig | None) -> Scheduler:
    """Build a Scheduler from user config or use defaults."""
    if config and config.weights:
        return Scheduler(
            parameters=tuple(config.weights),
            desired_retention=config.request_retention or 0.9,
            enable_fuzzing=True,
        )
    return Scheduler(desired_retention=0.9, enable_fuzzing=True)


def _card_from_db(state: CardMemoryState | None) -> Card:
    """Reconstruct a py-fsrs Card from DB state."""
    if state and state.card_data:
        return Card.from_json(state.card_data)
    return Card()


def _extract_card_fields(
    card: Card,
    previous_reps: int = 0,
    previous_lapses: int = 0,
    reviewed: bool = False,
    was_lapse: bool = False,
) -> dict:
    """Extract fields from a py-fsrs Card for DB persistence.

    Newer py-fsrs versions dropped ``reps``/``lapses`` from ``Card``.
    Keep DB counters stable by deriving values when those attrs are absent.
    """
    card_reps = getattr(card, "reps", None)
    if card_reps is None:
        card_reps = previous_reps + (1 if reviewed else 0)

    card_lapses = getattr(card, "lapses", None)
    if card_lapses is None:
        card_lapses = previous_lapses + (1 if was_lapse else 0)

    return {
        "state": card.state.value if hasattr(card.state, "value") else int(card.state),
        "difficulty": card.difficulty,
        "stability": card.stability,
        "next_review": card.due,
        "last_reviewed_at": datetime.now(timezone.utc),
        "reps": card_reps,
        "lapses": card_lapses,
        "card_data": card.to_json(),
    }


# ─── Service Functions ────────────────────────────────────────────────────────


async def get_user_config(db: AsyncSession, user_id: UUID) -> FSRSConfig | None:
    result = await db.execute(
        select(FSRSConfig).where(FSRSConfig.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_due_cards(
    db: AsyncSession, user_id: UUID, limit: int = 20
) -> list[int]:
    """Get word IDs due for review, respecting max_reviews_per_day."""
    config = await get_user_config(db, user_id)
    max_reviews = config.max_reviews_per_day if config else 100
    effective_limit = min(limit, max_reviews)

    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(CardMemoryState.word_id)
        .where(
            CardMemoryState.user_id == user_id,
            (CardMemoryState.next_review <= now) | (CardMemoryState.next_review.is_(None)),
        )
        .order_by(CardMemoryState.next_review.asc().nullsfirst())
        .limit(effective_limit)
    )
    return [row[0] for row in result.all()]


async def review_card(
    db: AsyncSession,
    user_id: UUID,
    word_id: int,
    is_correct: bool,
    duration_ms: int,
    exercise_type: str,
) -> tuple[CardMemoryState, int]:
    """Process a single review and return updated state + grade used."""
    # 1. Load config & build scheduler
    config = await get_user_config(db, user_id)
    scheduler = _build_scheduler(config)

    # 2. Load existing card state
    result = await db.execute(
        select(CardMemoryState).where(
            CardMemoryState.user_id == user_id,
            CardMemoryState.word_id == word_id,
        )
    )
    card_state = result.scalar_one_or_none()

    # 3. Reconstruct py-fsrs Card
    card = _card_from_db(card_state)

    # 4. Auto-grade
    grade = auto_grade(is_correct, duration_ms, exercise_type)

    # 5. Capture state BEFORE review for logging
    old_state = card.state.value if hasattr(card.state, "value") else int(card.state)
    old_difficulty = card.difficulty
    old_stability = card.stability
    old_elapsed_days = card.elapsed_days if hasattr(card, "elapsed_days") else 0
    old_scheduled_days = card.scheduled_days if hasattr(card, "scheduled_days") else 0

    # 6. Run FSRS scheduling
    new_card, review_log = scheduler.review_card(card, grade)

    # 7. Calculate retrievability
    retrievability = scheduler.get_card_retrievability(new_card)

    # 8. Upsert card_memory_state
    previous_reps = card_state.reps if card_state else 0
    previous_lapses = card_state.lapses if card_state else 0
    card_fields = _extract_card_fields(
        new_card,
        previous_reps=previous_reps,
        previous_lapses=previous_lapses,
        reviewed=True,
        was_lapse=(grade == Rating.Again),
    )
    card_fields["retrievability"] = retrievability

    if card_state:
        for key, value in card_fields.items():
            setattr(card_state, key, value)
    else:
        card_state = CardMemoryState(
            user_id=user_id,
            word_id=word_id,
            **card_fields,
        )
        db.add(card_state)

    # 9. Save review log
    log_entry = ReviewLog(
        user_id=user_id,
        word_id=word_id,
        grade=grade.value if hasattr(grade, "value") else int(grade),
        duration_ms=duration_ms,
        state=old_state,
        difficulty=old_difficulty,
        stability=old_stability,
        elapsed_days=old_elapsed_days,
        scheduled_days=old_scheduled_days,
        reviewed_at=datetime.now(timezone.utc),
        log_data=review_log.to_json(),
    )
    db.add(log_entry)

    await db.commit()
    await db.refresh(card_state)

    grade_value = grade.value if hasattr(grade, "value") else int(grade)
    return card_state, grade_value


async def bulk_review(
    db: AsyncSession,
    user_id: UUID,
    items: list[dict],
) -> list[tuple[CardMemoryState, int]]:
    """Process multiple reviews in a single request."""
    results = []
    for item in items:
        card_state, grade = await review_card(
            db=db,
            user_id=user_id,
            word_id=item["word_id"],
            is_correct=item["is_correct"],
            duration_ms=item.get("duration_ms", 0),
            exercise_type=item.get("exercise_type", "FLASHCARD"),
        )
        results.append((card_state, grade))
    return results


async def init_cards(
    db: AsyncSession,
    user_id: UUID,
    word_ids: list[int],
) -> list[CardMemoryState]:
    """Initialize new cards for a list of word IDs (when user unlocks a lesson)."""
    created = []
    for word_id in word_ids:
        # Check if already exists
        result = await db.execute(
            select(CardMemoryState).where(
                CardMemoryState.user_id == user_id,
                CardMemoryState.word_id == word_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            created.append(existing)
            continue

        card = Card()
        card_fields = _extract_card_fields(card)
        card_fields["retrievability"] = 1.0

        new_state = CardMemoryState(
            user_id=user_id,
            word_id=word_id,
            **card_fields,
        )
        db.add(new_state)
        created.append(new_state)

    await db.commit()
    return created


async def get_stats(db: AsyncSession, user_id: UUID) -> dict:
    """Get FSRS statistics for a user."""
    # State counts
    state_counts = await db.execute(
        select(CardMemoryState.state, func.count())
        .where(CardMemoryState.user_id == user_id)
        .group_by(CardMemoryState.state)
    )
    state_map = {row[0]: row[1] for row in state_counts.all()}

    # Total cards
    total = sum(state_map.values())

    # Due count
    now = datetime.now(timezone.utc)
    due_result = await db.execute(
        select(func.count()).where(
            CardMemoryState.user_id == user_id,
            (CardMemoryState.next_review <= now) | (CardMemoryState.next_review.is_(None)),
        )
    )
    due_count = due_result.scalar() or 0

    # Average retrievability
    avg_result = await db.execute(
        select(func.avg(CardMemoryState.retrievability)).where(
            CardMemoryState.user_id == user_id,
        )
    )
    avg_retrievability = avg_result.scalar() or 0.0

    # Total reviews
    review_count_result = await db.execute(
        select(func.count()).select_from(ReviewLog).where(
            ReviewLog.user_id == user_id,
        )
    )
    total_reviews = review_count_result.scalar() or 0

    return {
        "total_cards": total,
        "due_count": due_count,
        "new_count": state_map.get(0, 0),
        "learning_count": state_map.get(1, 0),
        "review_count": state_map.get(2, 0),
        "relearning_count": state_map.get(3, 0),
        "average_retrievability": round(float(avg_retrievability), 4),
        "total_reviews": total_reviews,
    }

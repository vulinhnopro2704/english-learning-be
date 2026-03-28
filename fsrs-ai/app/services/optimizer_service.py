"""FSRS Optimizer service — AI-powered parameter optimization.

Uses fsrs-optimizer to compute personalized weights from review history.
"""

from datetime import datetime, timezone
from uuid import UUID

from fsrs import Card, ReviewLog as FSRSReviewLog, Scheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CardMemoryState, FSRSConfig, ReviewLog


async def optimize_parameters(db: AsyncSession, user_id: UUID) -> dict:
    """Run optimizer to compute optimal FSRS weights for a user.

    Requires fsrs[optimizer] to be installed.
    """
    # 1. Load all review logs for this user
    result = await db.execute(
        select(ReviewLog)
        .where(ReviewLog.user_id == user_id)
        .order_by(ReviewLog.reviewed_at.asc())
    )
    logs = result.scalars().all()

    if len(logs) < 10:
        return {
            "status": "insufficient_data",
            "new_weights": [],
            "optimal_retention": None,
            "message": f"Need at least 10 review logs, currently have {len(logs)}.",
        }

    # 2. Reconstruct py-fsrs ReviewLog objects
    fsrs_logs = []
    for log in logs:
        if log.log_data:
            try:
                fsrs_log = FSRSReviewLog.from_json(log.log_data)
                fsrs_logs.append(fsrs_log)
            except Exception:
                continue

    if len(fsrs_logs) < 10:
        return {
            "status": "insufficient_data",
            "new_weights": [],
            "optimal_retention": None,
            "message": f"Need at least 10 valid logs, found {len(fsrs_logs)}.",
        }

    # 3. Run optimizer
    try:
        from fsrs import Optimizer

        optimizer = Optimizer(fsrs_logs)
        optimal_parameters = optimizer.compute_optimal_parameters()

        # Try to compute optimal retention
        optimal_retention = None
        try:
            optimal_retention = optimizer.compute_optimal_retention(optimal_parameters)
        except Exception:
            pass

        weights_list = list(optimal_parameters)

    except ImportError:
        return {
            "status": "error",
            "new_weights": [],
            "optimal_retention": None,
            "message": "fsrs[optimizer] is not installed. Run: pip install 'fsrs[optimizer]'",
        }

    # 4. Save new weights to FSRSConfig
    config_result = await db.execute(
        select(FSRSConfig).where(FSRSConfig.user_id == user_id)
    )
    config = config_result.scalar_one_or_none()

    if config:
        config.weights = weights_list
        if optimal_retention is not None:
            config.request_retention = optimal_retention
        config.updated_at = datetime.now(timezone.utc)
    else:
        config = FSRSConfig(
            user_id=user_id,
            weights=weights_list,
            request_retention=optimal_retention or 0.9,
        )
        db.add(config)

    await db.commit()

    return {
        "status": "success",
        "new_weights": weights_list,
        "optimal_retention": optimal_retention,
    }


async def reschedule_cards(db: AsyncSession, user_id: UUID) -> int:
    """Reschedule all cards after weights have been optimized.

    Replays review history with new scheduler to update card states.
    """
    # 1. Load config
    config_result = await db.execute(
        select(FSRSConfig).where(FSRSConfig.user_id == user_id)
    )
    config = config_result.scalar_one_or_none()

    if not config or not config.weights:
        return 0

    # 2. Build optimized scheduler
    scheduler = Scheduler(
        parameters=tuple(config.weights),
        desired_retention=config.request_retention or 0.9,
        enable_fuzzing=True,
    )

    # 3. Load all cards and their review logs
    cards_result = await db.execute(
        select(CardMemoryState)
        .where(CardMemoryState.user_id == user_id)
        .order_by(CardMemoryState.word_id)
    )
    cards = cards_result.scalars().all()

    rescheduled_count = 0

    for card_state in cards:
        # Load review logs for this card
        logs_result = await db.execute(
            select(ReviewLog)
            .where(
                ReviewLog.user_id == user_id,
                ReviewLog.word_id == card_state.word_id,
            )
            .order_by(ReviewLog.reviewed_at.asc())
        )
        logs = logs_result.scalars().all()

        # Reconstruct FSRS ReviewLog objects
        fsrs_logs = []
        for log in logs:
            if log.log_data:
                try:
                    fsrs_log = FSRSReviewLog.from_json(log.log_data)
                    fsrs_logs.append(fsrs_log)
                except Exception:
                    continue

        if not fsrs_logs:
            continue

        # Reschedule using new scheduler
        try:
            card = Card()
            rescheduled_card = scheduler.reschedule_card(card, fsrs_logs)
            # py-fsrs may not expose reps/lapses on Card in newer versions.
            derived_reps = len(logs)
            derived_lapses = sum(1 for log in logs if log.grade == 1)

            # Update DB
            card_state.state = (
                rescheduled_card.state.value
                if hasattr(rescheduled_card.state, "value")
                else int(rescheduled_card.state)
            )
            card_state.difficulty = rescheduled_card.difficulty
            card_state.stability = rescheduled_card.stability
            card_state.next_review = rescheduled_card.due
            card_state.reps = getattr(rescheduled_card, "reps", derived_reps)
            card_state.lapses = getattr(rescheduled_card, "lapses", derived_lapses)
            card_state.card_data = rescheduled_card.to_json()
            card_state.retrievability = scheduler.get_card_retrievability(
                rescheduled_card
            )
            rescheduled_count += 1
        except Exception:
            continue

    await db.commit()
    return rescheduled_count

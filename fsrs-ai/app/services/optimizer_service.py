"""FSRS Optimizer service — AI-powered parameter optimization.

Implements:
- training policy gate
- metric-based acceptance
- model versioning + rollback
- safe reschedule with capped due-date shift
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
import math
from uuid import UUID

from fsrs import Card, Rating, ReviewLog as FSRSReviewLog, Scheduler
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import CardMemoryState, FSRSConfig, FSRSModelVersion, ReviewLog


def _clamp_probability(value: float) -> float:
    return max(1e-6, min(1 - 1e-6, float(value)))


def _build_scheduler(weights: list[float] | None, request_retention: float | None) -> Scheduler:
    if weights:
        return Scheduler(
            parameters=tuple(weights),
            desired_retention=request_retention or 0.9,
            enable_fuzzing=True,
        )
    return Scheduler(desired_retention=request_retention or 0.9, enable_fuzzing=True)


async def _get_or_create_config(db: AsyncSession, user_id: UUID) -> FSRSConfig:
    result = await db.execute(select(FSRSConfig).where(FSRSConfig.user_id == user_id))
    config = result.scalar_one_or_none()
    if config:
        return config

    config = FSRSConfig(user_id=user_id, weights=[], request_retention=0.9)
    db.add(config)
    await db.flush()
    return config


async def _next_model_version(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(func.max(FSRSModelVersion.version)).where(FSRSModelVersion.user_id == user_id)
    )
    max_version = result.scalar() or 0
    return int(max_version) + 1


def _to_fsrs_logs(logs: list[ReviewLog]) -> list[FSRSReviewLog]:
    fsrs_logs: list[FSRSReviewLog] = []
    for log in logs:
        if log.grade not in (1, 2, 3, 4):
            continue
        if not log.reviewed_at:
            continue
        if log.duration_ms is None or log.duration_ms <= 0:
            continue

        fsrs_logs.append(
            FSRSReviewLog(
                card_id=log.word_id,
                rating=Rating(log.grade),
                review_datetime=log.reviewed_at,
                review_duration=log.duration_ms,
            )
        )
    return fsrs_logs


def _compute_log_loss(logs: list[ReviewLog], scheduler: Scheduler) -> float:
    grouped: dict[int, list[ReviewLog]] = defaultdict(list)
    for log in logs:
        if log.grade in (1, 2, 3, 4) and log.reviewed_at and (log.duration_ms or 0) > 0:
            grouped[log.word_id].append(log)

    total = 0
    loss = 0.0

    for card_logs in grouped.values():
        card_logs.sort(key=lambda x: x.reviewed_at)
        card = Card()

        for log in card_logs:
            p = _clamp_probability(
                scheduler.get_card_retrievability(card, current_datetime=log.reviewed_at)
            )
            y = 1.0 if log.grade >= 2 else 0.0
            loss += -(y * math.log(p) + (1 - y) * math.log(1 - p))
            total += 1

            rating = Rating(log.grade)
            card, _ = scheduler.review_card(
                card,
                rating,
                review_datetime=log.reviewed_at,
                review_duration=log.duration_ms,
            )

    if total == 0:
        return float("inf")

    return loss / total


async def optimize_parameters(db: AsyncSession, user_id: UUID) -> dict:
    """Run optimizer with policy checks and metric acceptance gate."""
    config = await _get_or_create_config(db, user_id)

    result = await db.execute(
        select(ReviewLog)
        .where(ReviewLog.user_id == user_id)
        .order_by(ReviewLog.reviewed_at.asc())
    )
    logs = result.scalars().all()
    fsrs_logs = _to_fsrs_logs(logs)
    valid_logs = len(fsrs_logs)

    min_logs = settings.FSRS_TRAIN_MIN_VALID_LOGS
    if valid_logs < min_logs:
        return {
            "status": "skipped",
            "accepted": False,
            "reason": f"insufficient_logs:{valid_logs}<{min_logs}",
            "new_weights": [],
            "optimal_retention": None,
            "metric_type": settings.FSRS_TRAIN_METRIC,
            "metric_baseline": None,
            "metric_candidate": None,
            "improvement_pct": None,
            "model_version": None,
            "sample_size": valid_logs,
        }

    min_days = settings.FSRS_TRAIN_MIN_DAYS_SINCE_LAST
    if config.last_trained_at:
        now = datetime.now(timezone.utc)
        days_since_last = (now - config.last_trained_at).total_seconds() / 86400
        if days_since_last < min_days:
            return {
                "status": "skipped",
                "accepted": False,
                "reason": f"cooldown:{days_since_last:.2f}d<{min_days}d",
                "new_weights": [],
                "optimal_retention": None,
                "metric_type": settings.FSRS_TRAIN_METRIC,
                "metric_baseline": None,
                "metric_candidate": None,
                "improvement_pct": None,
                "model_version": None,
                "sample_size": valid_logs,
            }

    try:
        from fsrs import Optimizer

        optimizer = Optimizer(fsrs_logs)
        optimal_parameters = optimizer.compute_optimal_parameters()

        optimal_retention: float | None = None
        try:
            retention_raw = optimizer.compute_optimal_retention(optimal_parameters)
            if isinstance(retention_raw, (list, tuple)):
                if retention_raw:
                    optimal_retention = float(retention_raw[0])
            else:
                optimal_retention = float(retention_raw)
        except Exception:
            optimal_retention = None

        candidate_weights = list(optimal_parameters)
    except ImportError:
        return {
            "status": "error",
            "accepted": False,
            "reason": "missing_optimizer_dependency",
            "new_weights": [],
            "optimal_retention": None,
            "metric_type": settings.FSRS_TRAIN_METRIC,
            "metric_baseline": None,
            "metric_candidate": None,
            "improvement_pct": None,
            "model_version": None,
            "sample_size": valid_logs,
        }

    baseline_scheduler = _build_scheduler(config.weights, config.request_retention)
    candidate_scheduler = _build_scheduler(
        candidate_weights,
        optimal_retention if optimal_retention is not None else config.request_retention,
    )
    metric_baseline = _compute_log_loss(logs, baseline_scheduler)
    metric_candidate = _compute_log_loss(logs, candidate_scheduler)

    if not math.isfinite(metric_baseline):
        improvement_pct = 0.0
        accepted = True
    else:
        improvement_pct = (metric_baseline - metric_candidate) / max(metric_baseline, 1e-9)
        accepted = improvement_pct >= settings.FSRS_TRAIN_MIN_IMPROVEMENT_PCT

    next_version = await _next_model_version(db, user_id)
    version_row = FSRSModelVersion(
        user_id=user_id,
        version=next_version,
        weights=candidate_weights,
        request_retention=(optimal_retention or config.request_retention or 0.9),
        sample_size=valid_logs,
        metric_type=settings.FSRS_TRAIN_METRIC,
        metric_baseline=metric_baseline if math.isfinite(metric_baseline) else None,
        metric_candidate=metric_candidate if math.isfinite(metric_candidate) else None,
        improvement_pct=improvement_pct,
        status="accepted" if accepted else "rejected",
        trained_at=datetime.now(timezone.utc),
    )
    db.add(version_row)

    if accepted:
        config.weights = candidate_weights
        if optimal_retention is not None:
            config.request_retention = optimal_retention
        config.last_trained_at = datetime.now(timezone.utc)
        config.current_model_version = next_version
        config.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "status": "success" if accepted else "rejected",
        "accepted": accepted,
        "reason": None if accepted else "metric_not_improved_enough",
        "new_weights": candidate_weights if accepted else [],
        "optimal_retention": optimal_retention,
        "metric_type": settings.FSRS_TRAIN_METRIC,
        "metric_baseline": metric_baseline if math.isfinite(metric_baseline) else None,
        "metric_candidate": metric_candidate if math.isfinite(metric_candidate) else None,
        "improvement_pct": improvement_pct,
        "model_version": next_version if accepted else None,
        "sample_size": valid_logs,
    }


async def rollback_model(db: AsyncSession, user_id: UUID, target_version: int | None = None) -> dict:
    """Rollback current model to a previous accepted version."""
    config = await _get_or_create_config(db, user_id)

    query = select(FSRSModelVersion).where(
        FSRSModelVersion.user_id == user_id,
        FSRSModelVersion.status == "accepted",
    )

    if target_version is not None:
        query = query.where(FSRSModelVersion.version == target_version)
    else:
        current_version = config.current_model_version
        query = query.where(FSRSModelVersion.version < current_version)

    query = query.order_by(FSRSModelVersion.version.desc())
    result = await db.execute(query)
    target = result.scalars().first()

    if not target:
        return {
            "status": "not_found",
            "message": "No eligible accepted model version found for rollback",
            "restored_version": None,
        }

    config.weights = target.weights
    config.request_retention = target.request_retention or config.request_retention
    config.current_model_version = target.version
    config.updated_at = datetime.now(timezone.utc)

    rollback_row = FSRSModelVersion(
        user_id=user_id,
        version=await _next_model_version(db, user_id),
        weights=target.weights,
        request_retention=target.request_retention,
        sample_size=target.sample_size,
        metric_type=target.metric_type,
        metric_baseline=target.metric_baseline,
        metric_candidate=target.metric_candidate,
        improvement_pct=target.improvement_pct,
        status="rolled_back",
        trained_at=datetime.now(timezone.utc),
    )
    db.add(rollback_row)

    await db.commit()

    return {
        "status": "success",
        "message": "Rollback completed",
        "restored_version": target.version,
    }


async def reschedule_cards(
    db: AsyncSession,
    user_id: UUID,
    max_shift_ratio: float | None = None,
) -> dict:
    """Reschedule all cards after weights have been optimized.

    Replays review history with the current scheduler and caps due-date shift.
    """
    config_result = await db.execute(
        select(FSRSConfig).where(FSRSConfig.user_id == user_id)
    )
    config = config_result.scalar_one_or_none()

    if not config or not config.weights:
        return {"cards_rescheduled": 0, "cards_capped": 0}

    scheduler = Scheduler(
        parameters=tuple(config.weights),
        desired_retention=config.request_retention or 0.9,
        enable_fuzzing=True,
    )

    ratio = settings.FSRS_RESCHEDULE_MAX_SHIFT_RATIO if max_shift_ratio is None else max_shift_ratio
    ratio = max(0.0, min(1.0, ratio))

    cards_result = await db.execute(
        select(CardMemoryState)
        .where(CardMemoryState.user_id == user_id)
        .order_by(CardMemoryState.word_id)
    )
    cards = cards_result.scalars().all()

    now = datetime.now(timezone.utc)
    rescheduled_count = 0
    capped_count = 0

    for card_state in cards:
        logs_result = await db.execute(
            select(ReviewLog)
            .where(
                ReviewLog.user_id == user_id,
                ReviewLog.word_id == card_state.word_id,
            )
            .order_by(ReviewLog.reviewed_at.asc())
        )
        logs = logs_result.scalars().all()
        fsrs_logs = _to_fsrs_logs(logs)

        if not fsrs_logs:
            continue

        try:
            card = Card()
            rescheduled_card = scheduler.reschedule_card(card, fsrs_logs)

            old_due = card_state.next_review
            new_due = rescheduled_card.due

            if old_due and new_due:
                old_interval_sec = max(1.0, (old_due - now).total_seconds())
                new_interval_sec = max(1.0, (new_due - now).total_seconds())

                min_interval = old_interval_sec * (1.0 - ratio)
                max_interval = old_interval_sec * (1.0 + ratio)
                clamped_interval = min(max(new_interval_sec, min_interval), max_interval)

                if abs(clamped_interval - new_interval_sec) > 1.0:
                    capped_count += 1
                    new_due = now + timedelta(seconds=clamped_interval)

            derived_reps = len(logs)
            derived_lapses = sum(1 for log in logs if log.grade == 1)

            card_state.state = (
                rescheduled_card.state.value
                if hasattr(rescheduled_card.state, "value")
                else int(rescheduled_card.state)
            )
            card_state.difficulty = rescheduled_card.difficulty
            card_state.stability = rescheduled_card.stability
            card_state.next_review = new_due
            card_state.reps = getattr(rescheduled_card, "reps", derived_reps)
            card_state.lapses = getattr(rescheduled_card, "lapses", derived_lapses)
            card_state.card_data = rescheduled_card.to_json()
            card_state.retrievability = scheduler.get_card_retrievability(
                rescheduled_card,
                current_datetime=now,
            )
            rescheduled_count += 1
        except Exception:
            continue

    await db.commit()
    return {"cards_rescheduled": rescheduled_count, "cards_capped": capped_count}


async def run_reschedule_for_user(user_id: UUID) -> dict:
    """Background-safe entrypoint that creates its own DB session."""
    async with async_session() as db:
        return await reschedule_cards(db, user_id)

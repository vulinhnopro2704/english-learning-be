"""Reporting service for human-readable FSRS insights."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CardMemoryState, ReviewLog


def _window_to_days(window: str) -> int:
    normalized = (window or "30d").lower()
    mapping = {"7d": 7, "30d": 30, "90d": 90}
    return mapping.get(normalized, 30)


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


async def get_insights(db: AsyncSession, user_id: UUID, window: str) -> dict:
    days = _window_to_days(window)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)

    current_reviews_result = await db.execute(
        select(ReviewLog.grade)
        .where(
            ReviewLog.user_id == user_id,
            ReviewLog.reviewed_at >= start,
            ReviewLog.reviewed_at <= now,
        )
    )
    current_grades = [row[0] for row in current_reviews_result.all()]
    current_total = len(current_grades)
    current_correct = sum(1 for grade in current_grades if grade >= 2)
    retention_rate = round(_safe_ratio(current_correct, current_total), 4)

    prev_reviews_result = await db.execute(
        select(ReviewLog.grade)
        .where(
            ReviewLog.user_id == user_id,
            ReviewLog.reviewed_at >= prev_start,
            ReviewLog.reviewed_at < start,
        )
    )
    prev_grades = [row[0] for row in prev_reviews_result.all()]
    prev_total = len(prev_grades)
    prev_correct = sum(1 for grade in prev_grades if grade >= 2)
    prev_retention = _safe_ratio(prev_correct, prev_total)

    avg_retrievability_result = await db.execute(
        select(func.avg(CardMemoryState.retrievability)).where(CardMemoryState.user_id == user_id)
    )
    avg_retrievability = float(avg_retrievability_result.scalar() or 0.0)

    memory_score = int(
        max(
            0,
            min(
                100,
                round((retention_rate * 100 * 0.6) + (avg_retrievability * 100 * 0.4)),
            ),
        )
    )

    due_7d_result = await db.execute(
        select(func.count())
        .where(
            CardMemoryState.user_id == user_id,
            CardMemoryState.next_review.is_not(None),
            CardMemoryState.next_review <= now + timedelta(days=7),
        )
    )
    next_7d_due = int(due_7d_result.scalar() or 0)

    tomorrow_start = datetime.combine((now + timedelta(days=1)).date(), time.min, tzinfo=timezone.utc)
    tomorrow_end = datetime.combine((now + timedelta(days=1)).date(), time.max, tzinfo=timezone.utc)
    due_tomorrow_result = await db.execute(
        select(func.count())
        .where(
            CardMemoryState.user_id == user_id,
            CardMemoryState.next_review.is_not(None),
            CardMemoryState.next_review >= tomorrow_start,
            CardMemoryState.next_review <= tomorrow_end,
        )
    )
    due_tomorrow = int(due_tomorrow_result.scalar() or 0)

    state_counts_result = await db.execute(
        select(CardMemoryState.state, func.count())
        .where(CardMemoryState.user_id == user_id)
        .group_by(CardMemoryState.state)
    )
    state_map = {row[0]: int(row[1]) for row in state_counts_result.all()}

    trend = round(retention_rate - prev_retention, 4)

    narrative: list[str] = []
    if memory_score >= 80:
        narrative.append("Tri nho cua ban dang rat tot va on dinh.")
    elif memory_score >= 60:
        narrative.append("Kha nang ghi nho cua ban dang on dinh o muc kha.")
    else:
        narrative.append("Kha nang ghi nho dang giam, nen tang tan suat on tap ngan.")

    narrative.append(
        f"Ngay mai co {due_tomorrow} tu den han, nen chia 1-2 phien on de tranh don bai."
    )

    if trend < -0.03:
        narrative.append("Ty le nho lai giam so voi ky truoc, nen giam do kho tam thoi.")
    elif trend > 0.03:
        narrative.append("Ty le nho lai dang cai thien tot so voi ky truoc.")

    return {
        "metrics": {
            "memoryScore": memory_score,
            "retentionRate": retention_rate,
            "workloadForecast": {
                "next7dDue": next_7d_due,
                "dueTomorrow": due_tomorrow,
            },
            "masteryDistribution": {
                "new": state_map.get(0, 0),
                "learning": state_map.get(1, 0),
                "review": state_map.get(2, 0),
                "relearning": state_map.get(3, 0),
            },
            "trend": {
                "vsPreviousWindow": trend,
            },
        },
        "narrative": narrative[:3],
    }


async def get_daily_report(
    db: AsyncSession,
    user_id: UUID,
    from_date: date,
    to_date: date,
) -> dict:
    start_dt = datetime.combine(from_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(to_date, time.max, tzinfo=timezone.utc)

    rows_result = await db.execute(
        select(
            func.date(ReviewLog.reviewed_at).label("day"),
            func.count().label("reviews"),
            func.avg(case((ReviewLog.grade >= 2, 1.0), else_=0.0)).label("accuracy"),
            func.avg(ReviewLog.duration_ms).label("avg_response_ms"),
            func.count().label("due_completed"),
        )
        .where(
            ReviewLog.user_id == user_id,
            ReviewLog.reviewed_at >= start_dt,
            ReviewLog.reviewed_at <= end_dt,
        )
        .group_by(func.date(ReviewLog.reviewed_at))
        .order_by(func.date(ReviewLog.reviewed_at).asc())
    )

    grouped = {row.day: row for row in rows_result.all()}

    due_created_seed_result = await db.execute(
        select(ReviewLog.reviewed_at, ReviewLog.scheduled_days)
        .where(
            ReviewLog.user_id == user_id,
            ReviewLog.reviewed_at >= start_dt - timedelta(days=365),
            ReviewLog.reviewed_at <= end_dt,
            ReviewLog.scheduled_days > 0,
        )
    )
    due_created_map: dict[date, int] = {}
    for reviewed_at, scheduled_days in due_created_seed_result.all():
        if not reviewed_at:
            continue
        due_day = (reviewed_at + timedelta(days=float(scheduled_days or 0))).date()
        due_created_map[due_day] = due_created_map.get(due_day, 0) + 1

    days = []
    d = from_date
    while d <= to_date:
        row = grouped.get(d)
        days.append(
            {
                "date": d,
                "reviews": int(row.reviews) if row else 0,
                "accuracy": round(float(row.accuracy or 0.0), 4) if row else 0.0,
                "avgResponseMs": round(float(row.avg_response_ms or 0.0), 2) if row else 0.0,
                "dueCreated": int(due_created_map.get(d, 0)),
                "dueCompleted": int(row.due_completed) if row else 0,
            }
        )
        d += timedelta(days=1)

    avg_accuracy = _safe_ratio(sum(day["accuracy"] for day in days), len(days)) if days else 0.0
    narrative = [
        f"Trong khoang thoi gian da chon, do chinh xac trung binh dat {round(avg_accuracy * 100, 1)}%.",
        "Tien do on tap dang duoc theo doi theo ngay de can bang khoi luong bai.",
    ]

    return {
        "metrics": {
            "days": days,
        },
        "narrative": narrative,
    }


async def get_recommendations(db: AsyncSession, user_id: UUID) -> dict:
    now = datetime.now(timezone.utc)

    overdue_result = await db.execute(
        select(func.count())
        .where(
            CardMemoryState.user_id == user_id,
            CardMemoryState.next_review.is_not(None),
            CardMemoryState.next_review < now - timedelta(days=3),
        )
    )
    overdue_gt3d = int(overdue_result.scalar() or 0)

    current_start = now - timedelta(days=7)
    previous_start = now - timedelta(days=14)

    current_result = await db.execute(
        select(
            func.avg(ReviewLog.duration_ms).label("avg_ms"),
            func.avg(case((ReviewLog.grade >= 2, 1.0), else_=0.0)).label("acc"),
        )
        .where(
            ReviewLog.user_id == user_id,
            ReviewLog.reviewed_at >= current_start,
            ReviewLog.reviewed_at <= now,
        )
    )
    previous_result = await db.execute(
        select(
            func.avg(ReviewLog.duration_ms).label("avg_ms"),
            func.avg(case((ReviewLog.grade >= 2, 1.0), else_=0.0)).label("acc"),
        )
        .where(
            ReviewLog.user_id == user_id,
            ReviewLog.reviewed_at >= previous_start,
            ReviewLog.reviewed_at < current_start,
        )
    )

    current = current_result.one()
    previous = previous_result.one()

    current_ms = float(current.avg_ms or 0.0)
    previous_ms = float(previous.avg_ms or 0.0)
    current_acc = float(current.acc or 0.0)
    previous_acc = float(previous.acc or 0.0)

    speed_delta_pct = 0.0
    if previous_ms > 0:
        speed_delta_pct = round((previous_ms - current_ms) / previous_ms, 4)

    accuracy_delta_pct = round(current_acc - previous_acc, 4)

    due_7d_result = await db.execute(
        select(func.count())
        .where(
            CardMemoryState.user_id == user_id,
            CardMemoryState.next_review.is_not(None),
            CardMemoryState.next_review <= now + timedelta(days=7),
        )
    )
    next_7d_due = int(due_7d_result.scalar() or 0)
    suggested_daily_limit = max(10, min(200, int((next_7d_due + overdue_gt3d) / 7) + 5))

    narrative = [f"Ban dang co {overdue_gt3d} tu qua han hon 3 ngay."]
    narrative.append(
        f"Toc do hien tai {'tang' if speed_delta_pct > 0 else 'giam'} {abs(round(speed_delta_pct * 100, 1))}% va do chinh xac {'tang' if accuracy_delta_pct >= 0 else 'giam'} {abs(round(accuracy_delta_pct * 100, 1))}%."
    )

    if accuracy_delta_pct < -0.03:
        narrative.append("Nen giam so cau kho trong 2-3 ngay de on dinh do chinh xac.")
    else:
        narrative.append("Co the duy tri nhip hien tai va uu tien xu ly bai qua han truoc.")

    return {
        "metrics": {
            "overdueGt3d": overdue_gt3d,
            "speedDeltaPct": speed_delta_pct,
            "accuracyDeltaPct": accuracy_delta_pct,
            "suggestedDailyLimit": suggested_daily_limit,
        },
        "narrative": narrative[:3],
    }


async def get_risk_cards(db: AsyncSession, user_id: UUID, take: int = 20) -> dict:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(CardMemoryState)
        .where(CardMemoryState.user_id == user_id)
        .order_by(CardMemoryState.retrievability.asc().nullsfirst())
        .limit(max(1, min(100, take * 4)))
    )
    cards = result.scalars().all()

    items = []
    for card in cards:
        retrievability = float(card.retrievability or 0.0)
        days_overdue = 0
        if card.next_review and card.next_review < now:
            days_overdue = max(0, (now - card.next_review).days)

        overdue_factor = min(1.0, days_overdue / 10)
        risk_score = round(min(1.0, (1 - retrievability) * 0.7 + overdue_factor * 0.3), 4)

        items.append(
            {
                "wordId": card.word_id,
                "riskScore": risk_score,
                "retrievability": round(retrievability, 4),
                "stability": round(float(card.stability or 0.0), 2),
                "daysOverdue": days_overdue,
            }
        )

    items.sort(key=lambda item: (item["riskScore"], item["daysOverdue"]), reverse=True)
    top_items = items[: max(1, min(100, take))]

    return {
        "metrics": {"items": top_items},
        "narrative": [
            "Danh sách gồm các thẻ có rủi ro quên cao nhất để ưu tiên ôn tập.",
        ],
    }

"""Normalized PostgreSQL Repository for YouTube listening lessons in schema 'listening'."""

from datetime import datetime, timezone
import uuid
from typing import List, Optional, Tuple
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    ListeningLesson,
    LessonVocabulary,
    LessonQuiz,
    LessonSegment,
    SegmentBlank,
    generate_uuid,
)
from app.schemas import (
    LessonDetail,
    LessonSummary,
    Segment,
    BlankItem,
    VocabularyItem,
    QuizQuestion,
)


class LessonRepository:
    """Async normalized PostgreSQL repository for listening lessons."""

    @staticmethod
    async def list_lessons(
        db: AsyncSession,
        query: Optional[str] = None,
        difficulty: Optional[str] = None,
        is_published: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[int, List[LessonSummary]]:
        """List lessons with optional search and filtering."""
        stmt = select(ListeningLesson)
        count_stmt = select(func.count(ListeningLesson.id))

        filters = []
        if query:
            search_filter = or_(
                ListeningLesson.title.ilike(f"%{query}%"),
                ListeningLesson.description.ilike(f"%{query}%"),
            )
            filters.append(search_filter)

        if difficulty:
            filters.append(ListeningLesson.difficulty == difficulty)

        if is_published is not None:
            filters.append(ListeningLesson.is_published == is_published)

        if filters:
            stmt = stmt.where(*filters)
            count_stmt = count_stmt.where(*filters)

        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        stmt = stmt.order_by(ListeningLesson.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(stmt)
        rows = result.scalars().all()

        summaries = [
            LessonSummary(
                id=lesson.id,
                video_id=lesson.video_id,
                title=lesson.title,
                description=lesson.description or "",
                thumbnail_url=lesson.thumbnail_url,
                duration=lesson.duration,
                difficulty=lesson.difficulty,
                language=lesson.language,
                is_published=lesson.is_published,
                total_segments=len(lesson.segments),
                total_vocab=len(lesson.vocabularies),
                total_quiz=len(lesson.quizzes),
                created_at=lesson.created_at.isoformat() if lesson.created_at else None,
                updated_at=lesson.updated_at.isoformat() if lesson.updated_at else None,
            )
            for lesson in rows
        ]

        return total, summaries

    @staticmethod
    async def get_lesson(db: AsyncSession, lesson_id: str) -> Optional[LessonDetail]:
        """Fetch single lesson detail with all normalized relational children."""
        stmt = select(ListeningLesson).where(ListeningLesson.id == lesson_id)
        result = await db.execute(stmt)
        lesson = result.scalar_one_or_none()
        if not lesson:
            return None

        # Map child relational vocabularies
        vocab_items = [
            VocabularyItem(
                id=idx + 1,
                word=v.word,
                part_of_speech=v.part_of_speech or "n",
                phonetic=v.phonetic or "",
                meaning_vi=v.meaning_vi,
                example=v.example or "",
                example_vi=v.example_vi or "",
                audio_url=v.audio_url,
            )
            for idx, v in enumerate(lesson.vocabularies)
        ]

        # Map child relational quizzes
        quiz_items = [
            QuizQuestion(
                id=idx + 1,
                question=q.question,
                options=list(q.options),
                correct_answer_index=q.correct_answer_index,
                explanation=q.explanation or "",
                segment_timestamp=q.segment_timestamp,
            )
            for idx, q in enumerate(lesson.quizzes)
        ]

        # Map child relational segments and their blanks
        segment_items = [
            Segment(
                id=s.segment_index,
                start=s.start_time,
                end=s.end_time,
                duration=s.duration,
                text=s.text,
                masked_text=s.masked_text,
                blanks=[
                    BlankItem(
                        index=b.blank_index,
                        original_word=b.original_word,
                        hint=b.hint,
                    )
                    for b in s.blanks
                ],
            )
            for s in lesson.segments
        ]

        return LessonDetail(
            id=lesson.id,
            video_id=lesson.video_id,
            title=lesson.title,
            description=lesson.description or "",
            thumbnail_url=lesson.thumbnail_url,
            duration=lesson.duration,
            difficulty=lesson.difficulty,
            language=lesson.language,
            is_published=lesson.is_published,
            total_segments=len(segment_items),
            vocabulary_list=vocab_items,
            quiz_questions=quiz_items,
            segments=segment_items,
            created_at=lesson.created_at.isoformat() if lesson.created_at else None,
            updated_at=lesson.updated_at.isoformat() if lesson.updated_at else None,
        )

    @staticmethod
    async def create_lesson(
        db: AsyncSession,
        video_id: str,
        title: str,
        description: str,
        thumbnail_url: str,
        duration: str,
        difficulty: str,
        language: str,
        is_published: bool,
        vocabulary_list: List[VocabularyItem],
        quiz_questions: List[QuizQuestion],
        segments: List[Segment],
    ) -> LessonDetail:
        """Create and persist normalized lesson across relational tables."""
        lesson_id = generate_uuid("lesson")
        now = datetime.now(timezone.utc)

        lesson = ListeningLesson(
            id=lesson_id,
            video_id=video_id,
            title=title,
            description=description,
            thumbnail_url=thumbnail_url,
            duration=duration,
            difficulty=difficulty,
            language=language,
            is_published=is_published,
            created_at=now,
            updated_at=now,
        )

        # 1. Step 1: Lesson Vocabularies
        for idx, vocab in enumerate(vocabulary_list):
            lesson.vocabularies.append(
                LessonVocabulary(
                    id=generate_uuid("vocab"),
                    lesson_id=lesson_id,
                    order=idx + 1,
                    word=vocab.word,
                    part_of_speech=vocab.part_of_speech,
                    phonetic=vocab.phonetic,
                    meaning_vi=vocab.meaning_vi,
                    example=vocab.example,
                    example_vi=vocab.example_vi,
                    audio_url=vocab.audio_url,
                    created_at=now,
                )
            )

        # 2. Step 2: Lesson Quizzes
        for idx, quiz in enumerate(quiz_questions):
            lesson.quizzes.append(
                LessonQuiz(
                    id=generate_uuid("quiz"),
                    lesson_id=lesson_id,
                    order=idx + 1,
                    question=quiz.question,
                    options=quiz.options,
                    correct_answer_index=quiz.correct_answer_index,
                    explanation=quiz.explanation,
                    segment_timestamp=quiz.segment_timestamp or 0.0,
                    created_at=now,
                )
            )

        # 3. Step 3: Lesson Segments and Blanks
        for idx, seg in enumerate(segments):
            seg_id = generate_uuid("seg")
            db_segment = LessonSegment(
                id=seg_id,
                lesson_id=lesson_id,
                segment_index=idx + 1,
                start_time=seg.start,
                end_time=seg.end,
                duration=seg.duration,
                text=seg.text,
                masked_text=seg.masked_text,
                created_at=now,
            )

            for b in (seg.blanks or []):
                db_segment.blanks.append(
                    SegmentBlank(
                        id=generate_uuid("blank"),
                        segment_id=seg_id,
                        blank_index=b.index,
                        original_word=b.original_word,
                        hint=b.hint,
                        created_at=now,
                    )
                )

            lesson.segments.append(db_segment)

        db.add(lesson)
        await db.commit()

        return await LessonRepository.get_lesson(db, lesson_id)  # type: ignore

    @staticmethod
    async def update_lesson(
        db: AsyncSession,
        lesson_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        difficulty: Optional[str] = None,
        is_published: Optional[bool] = None,
    ) -> Optional[LessonDetail]:
        """Update metadata of an existing lesson."""
        stmt = select(ListeningLesson).where(ListeningLesson.id == lesson_id)
        result = await db.execute(stmt)
        lesson = result.scalar_one_or_none()
        if not lesson:
            return None

        if title is not None:
            lesson.title = title
        if description is not None:
            lesson.description = description
        if difficulty is not None:
            lesson.difficulty = difficulty
        if is_published is not None:
            lesson.is_published = is_published

        lesson.updated_at = datetime.now(timezone.utc)
        await db.commit()

        return await LessonRepository.get_lesson(db, lesson_id)

    @staticmethod
    async def delete_lesson(db: AsyncSession, lesson_id: str) -> bool:
        """Delete a lesson by ID (cascades to all relational children)."""
        stmt = select(ListeningLesson).where(ListeningLesson.id == lesson_id)
        result = await db.execute(stmt)
        lesson = result.scalar_one_or_none()
        if not lesson:
            return False

        await db.delete(lesson)
        await db.commit()
        return True

    @staticmethod
    async def seed_default_lessons(db: AsyncSession) -> None:
        """Seed initial lessons if empty."""
        count_res = await db.execute(select(func.count(ListeningLesson.id)))
        count = count_res.scalar() or 0
        if count > 0:
            return

        now = datetime.now(timezone.utc)
        lesson = ListeningLesson(
            id="lesson-elite-habits",
            video_id="r81p0z-kXU0",
            title="How do elite performers automate their habits? - Những nghệ sĩ ưu tú tự động hóa thói quen của mình như thế nào?",
            description="Discover cognitive psychology insights on how high performers build automatic consistency.",
            thumbnail_url="https://img.youtube.com/vi/r81p0z-kXU0/hqdefault.jpg",
            duration="03:36",
            difficulty="medium",
            language="en",
            is_published=True,
            created_at=now,
            updated_at=now,
        )

        sample_vocabs = [
            ("automatic", "adj", "/ˌɔːtəˈmætɪk/", "Tự động, không cần sự can thiệp của con người", "Breathing is an automatic function of the human body.", "Hít thở là một chức năng tự động của cơ thể con người."),
            ("automate", "v", "/ˈɔːtəmeɪt/", "Tự động hóa", "Elite performers automate routine decisions.", "Những người ưu tú tự động hóa các quyết định thường nhật."),
            ("habit", "n", "/ˈhæbɪt/", "Thói quen, tập quán", "Consistent daily habits compound into massive achievements.", "Những thói quen kiên định hàng ngày tích lũy thành thành tựu lớn."),
            ("discipline", "n", "/ˈdɪsəplɪn/", "Kỷ luật, tính tự giác", "Self-discipline is essential for mastery.", "Kỷ luật tự giác là yếu tố thiết yếu để làm chủ kỹ năng."),
        ]
        for idx, (w, pos, pho, m, ex, ex_vi) in enumerate(sample_vocabs):
            lesson.vocabularies.append(
                LessonVocabulary(
                    id=f"vocab-seed-{idx+1}",
                    lesson_id=lesson.id,
                    order=idx + 1,
                    word=w,
                    part_of_speech=pos,
                    phonetic=pho,
                    meaning_vi=m,
                    example=ex,
                    example_vi=ex_vi,
                    created_at=now,
                )
            )

        sample_quizzes = [
            ("How does the process of automating a skill work?", ["It involves repeating the skill until it becomes automatic.", "It involves learning new techniques and strategies without practice.", "It involves making conscious decisions and using willpower constantly."], 0, "Repetition embeds procedural memory until performance requires zero conscious effort.", 0.0),
            ("What is the key difference between novice and elite performers?", ["Elite performers rely on automated routines rather than willpower.", "Novices practice more hours than elite performers.", "Elite performers never need to repeat foundational drills."], 0, "Automated habits free up mental bandwidth for strategic focus.", 45.0),
        ]
        for idx, (q, opts, ans, exp, ts) in enumerate(sample_quizzes):
            lesson.quizzes.append(
                LessonQuiz(
                    id=f"quiz-seed-{idx+1}",
                    lesson_id=lesson.id,
                    order=idx + 1,
                    question=q,
                    options=opts,
                    correct_answer_index=ans,
                    explanation=exp,
                    segment_timestamp=ts,
                    created_at=now,
                )
            )

        sample_segments = [
            (1, 0.0, 6.5, 6.5, "There are some people who differentiate between habits and skills.", "There are some people who differentiate between _____ and skills.", [("habits", "h_____ (6 letters)")]),
            (2, 7.0, 13.5, 6.5, "With a skill, you typically have ways of improving the performance over time.", "With a skill, you typically have ways of improving the _____ over time.", [("performance", "p__________ (11 letters)")]),
            (3, 14.0, 20.0, 6.0, "You have to be making decisions and exerting effort.", "You have to be making decisions and exerting _____.", [("effort", "e_____ (6 letters)")]),
            (4, 20.5, 28.0, 7.5, "It can take thousands of repetitions before you actually can do it automatically.", "It can take thousands of repetitions before you actually can do it _____.", [("automatically", "a____________ (13 letters)")]),
        ]
        for idx, s_idx, st, et, dur, txt, mtxt, blist in [(i, s[0], s[1], s[2], s[3], s[4], s[5], s[6]) for i, s in enumerate(sample_segments)]:
            seg_id = f"seg-seed-{idx+1}"
            seg = LessonSegment(
                id=seg_id,
                lesson_id=lesson.id,
                segment_index=s_idx,
                start_time=st,
                end_time=et,
                duration=dur,
                text=txt,
                masked_text=mtxt,
                created_at=now,
            )
            for b_idx, (b_word, b_hint) in enumerate(blist):
                seg.blanks.append(
                    SegmentBlank(
                        id=f"blank-seed-{idx+1}-{b_idx+1}",
                        segment_id=seg_id,
                        blank_index=b_idx,
                        original_word=b_word,
                        hint=b_hint,
                        created_at=now,
                    )
                )
            lesson.segments.append(seg)

        db.add(lesson)
        await db.commit()

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
            if isinstance(vocab, dict):
                w = vocab.get("word", "")
                pos = vocab.get("part_of_speech", "n")
                pho = vocab.get("phonetic", "")
                m = vocab.get("meaning_vi", "")
                ex = vocab.get("example", "")
                ex_vi = vocab.get("example_vi", "")
                audio = vocab.get("audio_url")
            else:
                w = getattr(vocab, "word", "")
                pos = getattr(vocab, "part_of_speech", "n")
                pho = getattr(vocab, "phonetic", "")
                m = getattr(vocab, "meaning_vi", "")
                ex = getattr(vocab, "example", "")
                ex_vi = getattr(vocab, "example_vi", "")
                audio = getattr(vocab, "audio_url", None)

            lesson.vocabularies.append(
                LessonVocabulary(
                    id=generate_uuid("vocab"),
                    lesson_id=lesson_id,
                    order=idx + 1,
                    word=w,
                    part_of_speech=pos,
                    phonetic=pho,
                    meaning_vi=m,
                    example=ex,
                    example_vi=ex_vi,
                    audio_url=audio,
                    created_at=now,
                )
            )

        # 2. Step 2: Lesson Quizzes
        for idx, quiz in enumerate(quiz_questions):
            if isinstance(quiz, dict):
                q_text = quiz.get("question", "")
                opts = quiz.get("options") or []
                ans = quiz.get("correct_answer_index", 0)
                exp = quiz.get("explanation", "")
                ts = float(quiz.get("segment_timestamp", 0.0) or 0.0)
            else:
                q_text = getattr(quiz, "question", "")
                opts = getattr(quiz, "options", [])
                ans = getattr(quiz, "correct_answer_index", 0)
                exp = getattr(quiz, "explanation", "")
                ts = float(getattr(quiz, "segment_timestamp", 0.0) or 0.0)

            lesson.quizzes.append(
                LessonQuiz(
                    id=generate_uuid("quiz"),
                    lesson_id=lesson_id,
                    order=idx + 1,
                    question=q_text,
                    options=list(opts),
                    correct_answer_index=ans,
                    explanation=exp,
                    segment_timestamp=ts,
                    created_at=now,
                )
            )

        # 3. Step 3: Lesson Segments and Blanks
        for idx, seg in enumerate(segments):
            if isinstance(seg, dict):
                s_idx = seg.get("segment_index", seg.get("id", idx + 1))
                st = float(seg.get("start", seg.get("start_time", 0.0)))
                et = float(seg.get("end", seg.get("end_time", 0.0)))
                dur = float(seg.get("duration", round(et - st, 2) if et else 0.0))
                txt = seg.get("text", "")
                mtxt = seg.get("masked_text", txt)
                raw_blanks = seg.get("blanks") or []
            else:
                s_idx = getattr(seg, "segment_index", getattr(seg, "id", idx + 1))
                st = float(getattr(seg, "start", getattr(seg, "start_time", 0.0)))
                et = float(getattr(seg, "end", getattr(seg, "end_time", 0.0)))
                dur = float(getattr(seg, "duration", round(et - st, 2) if et else 0.0))
                txt = getattr(seg, "text", "")
                mtxt = getattr(seg, "masked_text", txt)
                raw_blanks = getattr(seg, "blanks", []) or []

            seg_id = generate_uuid("seg")
            db_segment = LessonSegment(
                id=seg_id,
                lesson_id=lesson_id,
                segment_index=s_idx,
                start_time=st,
                end_time=et,
                duration=dur,
                text=txt,
                masked_text=mtxt,
                created_at=now,
            )

            for b in raw_blanks:
                if isinstance(b, dict):
                    b_idx = b.get("index", b.get("blank_index", 0))
                    b_word = b.get("original_word", "")
                    b_hint = b.get("hint", "")
                else:
                    b_idx = getattr(b, "index", getattr(b, "blank_index", 0))
                    b_word = getattr(b, "original_word", "")
                    b_hint = getattr(b, "hint", "")

                db_segment.blanks.append(
                    SegmentBlank(
                        id=generate_uuid("blank"),
                        segment_id=seg_id,
                        blank_index=b_idx,
                        original_word=b_word,
                        hint=b_hint,
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

"""SQLite persistent repository for YouTube listening lessons."""

import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional, Tuple
from app.schemas import (
    LessonDetail,
    LessonSummary,
    Segment,
    VocabularyItem,
    QuizQuestion,
)


class LessonRepository:
    """Persistent SQLite database store for YouTube listening lessons."""

    def __init__(self, db_path: str = "data/listening.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()
        self._seed_default_lessons()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Create table if not exists."""
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS listening_lessons (
                    id TEXT PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    thumbnail_url TEXT NOT NULL,
                    duration TEXT NOT NULL,
                    difficulty TEXT NOT NULL,
                    language TEXT NOT NULL,
                    is_published INTEGER NOT NULL DEFAULT 1,
                    total_segments INTEGER NOT NULL DEFAULT 0,
                    vocabulary_json TEXT NOT NULL,
                    quiz_json TEXT NOT NULL,
                    segments_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _seed_default_lessons(self) -> None:
        """Seed initial lessons matching Mochi listening UI reference."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM listening_lessons")
            count = cursor.fetchone()[0]
            if count > 0:
                return

            sample_1 = {
                "id": "lesson-elite-habits",
                "video_id": "r81p0z-kXU0",
                "title": "How do elite performers automate their habits? - Những nghệ sĩ ưu tú tự động hóa thói quen của mình như thế nào?",
                "description": "Discover cognitive psychology insights on how high performers build automatic consistency.",
                "thumbnail_url": "https://img.youtube.com/vi/r81p0z-kXU0/hqdefault.jpg",
                "duration": "03:36",
                "difficulty": "medium",
                "language": "en",
                "is_published": 1,
                "total_segments": 4,
                "vocabulary_json": json.dumps([
                    {
                        "id": 1,
                        "word": "automatic",
                        "part_of_speech": "adj",
                        "phonetic": "/ˌɔːtəˈmætɪk/",
                        "meaning_vi": "Tự động, không cần sự can thiệp của con người",
                        "example": "Breathing is an automatic function of the human body.",
                        "example_vi": "Hít thở là một chức năng tự động của cơ thể con người.",
                        "audio_url": None
                    },
                    {
                        "id": 2,
                        "word": "automate",
                        "part_of_speech": "v",
                        "phonetic": "/ˈɔːtəmeɪt/",
                        "meaning_vi": "Tự động hóa",
                        "example": "Elite performers automate routine decisions.",
                        "example_vi": "Những người ưu tú tự động hóa các quyết định thường nhật.",
                        "audio_url": None
                    },
                    {
                        "id": 3,
                        "word": "habit",
                        "part_of_speech": "n",
                        "phonetic": "/ˈhæbɪt/",
                        "meaning_vi": "Thói quen, tập quán",
                        "example": "Consistent daily habits compound into massive achievements.",
                        "example_vi": "Những thói quen kiên định hàng ngày tích lũy thành thành tựu lớn.",
                        "audio_url": None
                    },
                    {
                        "id": 4,
                        "word": "discipline",
                        "part_of_speech": "n",
                        "phonetic": "/ˈdɪsəplɪn/",
                        "meaning_vi": "Kỷ luật, tính tự giác",
                        "example": "Self-discipline is essential for mastery.",
                        "example_vi": "Kỷ luật tự giác là yếu tố thiết yếu để làm chủ kỹ năng.",
                        "audio_url": None
                    }
                ]),
                "quiz_json": json.dumps([
                    {
                        "id": 1,
                        "question": "How does the process of automating a skill work?",
                        "options": [
                            "It involves repeating the skill until it becomes automatic.",
                            "It involves learning new techniques and strategies without practice.",
                            "It involves making conscious decisions and using willpower constantly."
                        ],
                        "correct_answer_index": 0,
                        "explanation": "Repetition embeds procedural memory until performance requires zero conscious effort.",
                        "segment_timestamp": 0.0
                    },
                    {
                        "id": 2,
                        "question": "What is the key difference between novice and elite performers?",
                        "options": [
                            "Elite performers rely on automated routines rather than willpower.",
                            "Novices practice more hours than elite performers.",
                            "Elite performers never need to repeat foundational drills."
                        ],
                        "correct_answer_index": 0,
                        "explanation": "Automated habits free up mental bandwidth for strategic focus.",
                        "segment_timestamp": 45.0
                    }
                ]),
                "segments_json": json.dumps([
                    {
                        "id": 1,
                        "start": 0.0,
                        "end": 6.5,
                        "duration": 6.5,
                        "text": "There are some people who differentiate between habits and skills.",
                        "masked_text": "There are some people who differentiate between _____ and skills.",
                        "blanks": [{"index": 0, "original_word": "habits", "hint": "h_____ (6 letters)"}]
                    },
                    {
                        "id": 2,
                        "start": 7.0,
                        "end": 13.5,
                        "duration": 6.5,
                        "text": "With a skill, you typically have ways of improving the performance over time.",
                        "masked_text": "With a skill, you typically have ways of improving the _____ over time.",
                        "blanks": [{"index": 0, "original_word": "performance", "hint": "p__________ (11 letters)"}]
                    },
                    {
                        "id": 3,
                        "start": 14.0,
                        "end": 20.0,
                        "duration": 6.0,
                        "text": "You have to be making decisions and exerting effort.",
                        "masked_text": "You have to be making decisions and exerting _____.",
                        "blanks": [{"index": 0, "original_word": "effort", "hint": "e_____ (6 letters)"}]
                    },
                    {
                        "id": 4,
                        "start": 20.5,
                        "end": 28.0,
                        "duration": 7.5,
                        "text": "It can take thousands of repetitions before you actually can do it automatically.",
                        "masked_text": "It can take thousands of repetitions before you actually can do it _____.",
                        "blanks": [{"index": 0, "original_word": "automatically", "hint": "a____________ (13 letters)"}]
                    }
                ]),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }

            cursor.execute(
                """
                INSERT INTO listening_lessons (
                    id, video_id, title, description, thumbnail_url, duration,
                    difficulty, language, is_published, total_segments,
                    vocabulary_json, quiz_json, segments_json, created_at, updated_at
                ) VALUES (
                    :id, :video_id, :title, :description, :thumbnail_url, :duration,
                    :difficulty, :language, :is_published, :total_segments,
                    :vocabulary_json, :quiz_json, :segments_json, :created_at, :updated_at
                )
                """,
                sample_1
            )
            conn.commit()

    def list_lessons(
        self,
        query: Optional[str] = None,
        difficulty: Optional[str] = None,
        is_published: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[int, List[LessonSummary]]:
        """List lessons with optional search and filtering."""
        with self._get_connection() as conn:
            where_clauses = []
            params = []

            if query:
                where_clauses.append("(title LIKE ? OR description LIKE ?)")
                params.extend([f"%{query}%", f"%{query}%"])

            if difficulty:
                where_clauses.append("difficulty = ?")
                params.append(difficulty)

            if is_published is not None:
                where_clauses.append("is_published = ?")
                params.append(1 if is_published else 0)

            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            # Count total
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM listening_lessons {where_str}", params)
            total = cursor.fetchone()[0]

            # Fetch rows
            cursor.execute(
                f"""
                SELECT id, video_id, title, description, thumbnail_url, duration,
                       difficulty, language, is_published, total_segments,
                       vocabulary_json, quiz_json, created_at, updated_at
                FROM listening_lessons
                {where_str}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                params + [limit, offset],
            )
            rows = cursor.fetchall()

            summaries = []
            for row in rows:
                vocab_data = json.loads(row["vocabulary_json"]) if row["vocabulary_json"] else []
                quiz_data = json.loads(row["quiz_json"]) if row["quiz_json"] else []
                summaries.append(
                    LessonSummary(
                        id=row["id"],
                        video_id=row["video_id"],
                        title=row["title"],
                        description=row["description"] or "",
                        thumbnail_url=row["thumbnail_url"],
                        duration=row["duration"] or "03:30",
                        difficulty=row["difficulty"] or "medium",
                        language=row["language"] or "en",
                        is_published=bool(row["is_published"]),
                        total_segments=row["total_segments"] or 0,
                        total_vocab=len(vocab_data),
                        total_quiz=len(quiz_data),
                        created_at=row["created_at"],
                        updated_at=row["updated_at"],
                    )
                )

            return total, summaries

    def get_lesson(self, lesson_id: str) -> Optional[LessonDetail]:
        """Fetch complete single lesson by ID."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, video_id, title, description, thumbnail_url, duration,
                       difficulty, language, is_published, total_segments,
                       vocabulary_json, quiz_json, segments_json, created_at, updated_at
                FROM listening_lessons
                WHERE id = ?
                """,
                (lesson_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            vocab_data = json.loads(row["vocabulary_json"]) if row["vocabulary_json"] else []
            quiz_data = json.loads(row["quiz_json"]) if row["quiz_json"] else []
            segments_data = json.loads(row["segments_json"]) if row["segments_json"] else []

            return LessonDetail(
                id=row["id"],
                video_id=row["video_id"],
                title=row["title"],
                description=row["description"] or "",
                thumbnail_url=row["thumbnail_url"],
                duration=row["duration"] or "03:30",
                difficulty=row["difficulty"] or "medium",
                language=row["language"] or "en",
                is_published=bool(row["is_published"]),
                total_segments=row["total_segments"],
                vocabulary_list=[VocabularyItem(**item) for item in vocab_data],
                quiz_questions=[QuizQuestion(**item) for item in quiz_data],
                segments=[Segment(**item) for item in segments_data],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    def create_lesson(
        self,
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
        """Create and persist a new listening lesson."""
        lesson_id = f"lesson-{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat()

        vocab_json = json.dumps([item.model_dump() for item in vocabulary_list])
        quiz_json = json.dumps([item.model_dump() for item in quiz_questions])
        segments_json = json.dumps([item.model_dump() for item in segments])

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO listening_lessons (
                    id, video_id, title, description, thumbnail_url, duration,
                    difficulty, language, is_published, total_segments,
                    vocabulary_json, quiz_json, segments_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    lesson_id,
                    video_id,
                    title,
                    description,
                    thumbnail_url,
                    duration,
                    difficulty,
                    language,
                    1 if is_published else 0,
                    len(segments),
                    vocab_json,
                    quiz_json,
                    segments_json,
                    now,
                    now,
                ),
            )
            conn.commit()

        return self.get_lesson(lesson_id)  # type: ignore

    def update_lesson(
        self,
        lesson_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        difficulty: Optional[str] = None,
        is_published: Optional[bool] = None,
    ) -> Optional[LessonDetail]:
        """Update metadata of an existing lesson."""
        with self._get_connection() as conn:
            updates = []
            params = []
            if title is not None:
                updates.append("title = ?")
                params.append(title)
            if description is not None:
                updates.append("description = ?")
                params.append(description)
            if difficulty is not None:
                updates.append("difficulty = ?")
                params.append(difficulty)
            if is_published is not None:
                updates.append("is_published = ?")
                params.append(1 if is_published else 0)

            if not updates:
                return self.get_lesson(lesson_id)

            updates.append("updated_at = ?")
            params.append(datetime.utcnow().isoformat())
            params.append(lesson_id)

            conn.execute(
                f"UPDATE listening_lessons SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            conn.commit()

        return self.get_lesson(lesson_id)

    def delete_lesson(self, lesson_id: str) -> bool:
        """Delete a lesson by ID."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM listening_lessons WHERE id = ?", (lesson_id,))
            conn.commit()
            return cursor.rowcount > 0


# Global singleton instance
lesson_repository = LessonRepository()

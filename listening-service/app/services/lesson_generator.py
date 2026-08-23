"""Dynamic Lesson content generator connecting to Generative AI service for 3-step listening practice."""

import logging
from typing import List, Tuple, Optional
import requests
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import Segment, VocabularyItem, QuizQuestion, BlankItem
from app.services.blank_generator import BlankGeneratorService

logger = logging.getLogger("listening_service.lesson_generator")


class LessonGeneratorService:
    """Service to automatically generate 3-step structured listening content via LLM pipeline."""

    @classmethod
    def generate_lesson_content(
        cls,
        raw_segments: List[dict],
        difficulty: str = "medium",
        title: Optional[str] = None,
        target_vocab_count: int = 12,
        target_quiz_count: int = 4,
    ) -> Tuple[List[VocabularyItem], List[QuizQuestion], List[Segment]]:
        """Generate Step 1 (Vocab), Step 2 (Quiz), and Step 3 (Cloze segments) via AI microservice."""
        if not raw_segments:
            return [], [], []

        # Call Generative AI service to produce Step 1 (Vocab) and Step 2 (Quiz)
        ai_vocab, ai_quizzes = cls._call_generative_pipeline(
            raw_segments=raw_segments,
            difficulty=difficulty,
            title=title,
            target_vocab_count=target_vocab_count,
            target_quiz_count=target_quiz_count,
        )

        # Extract target vocabulary words to prioritize in Step 3 cloze blanks
        target_words = [v.word for v in ai_vocab]

        # Step 3: Generate Cloze segments with priority masking on Step 1 words
        enriched_segments = BlankGeneratorService.generate_blanks(
            raw_segments, difficulty=difficulty, target_vocabulary=target_words
        )

        cloze_segments = [
            Segment(
                id=s.get("id", idx + 1),
                start=float(s.get("start", 0.0)),
                end=float(s.get("end", 0.0)),
                duration=float(s.get("duration", 0.0)),
                text=s.get("text", ""),
                masked_text=s.get("masked_text"),
                blanks=[
                    BlankItem(
                        index=b.get("index", b_idx),
                        original_word=b.get("original_word", ""),
                        hint=b.get("hint", ""),
                    )
                    for b_idx, b in enumerate(s.get("blanks", []))
                ],
            )
            for idx, s in enumerate(enriched_segments)
        ]

        return ai_vocab, ai_quizzes, cloze_segments

    @classmethod
    def generate_vocabulary_only(
        cls,
        raw_segments: List[dict],
        difficulty: str = "medium",
        target_vocab_count: int = 12,
    ) -> List[VocabularyItem]:
        """Generate only Step 1 vocabulary items via AI pipeline."""
        url = f"{settings.GENERATIVE_SERVICE_URL.rstrip('/')}/listening/extract-vocab"
        payload = {
            "segments": [
                {
                    "id": s.get("id", idx + 1),
                    "start": float(s.get("start", 0.0)),
                    "end": float(s.get("end", 0.0)),
                    "duration": float(s.get("duration", 0.0)),
                    "text": s.get("text", ""),
                }
                for idx, s in enumerate(raw_segments)
            ],
            "difficulty": difficulty,
            "targetVocabCount": target_vocab_count,
        }

        try:
            res = requests.post(url, json=payload, timeout=60)
            if not res.ok:
                logger.error(
                    f"[LessonGenerator] Generative service error ({res.status_code}): {res.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Generative AI service failed to extract vocabulary: {res.text[:200]}",
                )

            data = res.json()
            return [
                VocabularyItem(
                    id=item.get("id", idx + 1),
                    word=item.get("word", ""),
                    part_of_speech=item.get("partOfSpeech", "n"),
                    phonetic=item.get("phonetic", ""),
                    meaning_vi=item.get("meaningVi", ""),
                    example=item.get("example", ""),
                    example_vi=item.get("exampleVi", ""),
                    audio_url=item.get("audioUrl"),
                )
                for idx, item in enumerate(data)
            ]
        except requests.RequestException as e:
            logger.error(f"[LessonGenerator] Generative service connection error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to Generative AI service: {str(e)}",
            )

    @classmethod
    def generate_quizzes_only(
        cls,
        raw_segments: List[dict],
        difficulty: str = "medium",
        target_quiz_count: int = 4,
    ) -> List[QuizQuestion]:
        """Generate only Step 2 quiz questions via AI pipeline."""
        url = f"{settings.GENERATIVE_SERVICE_URL.rstrip('/')}/listening/generate-quizzes"
        payload = {
            "segments": [
                {
                    "id": s.get("id", idx + 1),
                    "start": float(s.get("start", 0.0)),
                    "end": float(s.get("end", 0.0)),
                    "duration": float(s.get("duration", 0.0)),
                    "text": s.get("text", ""),
                }
                for idx, s in enumerate(raw_segments)
            ],
            "difficulty": difficulty,
            "targetQuizCount": target_quiz_count,
        }

        try:
            res = requests.post(url, json=payload, timeout=60)
            if not res.ok:
                logger.error(
                    f"[LessonGenerator] Generative service error ({res.status_code}): {res.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Generative AI service failed to generate quizzes: {res.text[:200]}",
                )

            data = res.json()
            return [
                QuizQuestion(
                    id=item.get("id", idx + 1),
                    question=item.get("question", ""),
                    options=item.get("options", []),
                    correct_answer_index=item.get("correctAnswerIndex", 0),
                    explanation=item.get("explanation", ""),
                    segment_timestamp=float(item.get("segmentTimestamp", item.get("startTime", 0.0)) or 0.0),
                    start_time=float(item.get("startTime", item.get("segmentTimestamp", 0.0)) or 0.0),
                    end_time=float(item.get("endTime", (item.get("startTime", 0.0) or 0.0) + 15.0) or 0.0),
                )
                for idx, item in enumerate(data)
            ]
        except requests.RequestException as e:
            logger.error(f"[LessonGenerator] Generative service connection error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to Generative AI service: {str(e)}",
            )

    @classmethod
    def _call_generative_pipeline(
        cls,
        raw_segments: List[dict],
        difficulty: str,
        title: Optional[str],
        target_vocab_count: int,
        target_quiz_count: int,
    ) -> Tuple[List[VocabularyItem], List[QuizQuestion]]:
        """Execute full content generation request to generative-service."""
        url = f"{settings.GENERATIVE_SERVICE_URL.rstrip('/')}/listening/generate-lesson-content"
        payload = {
            "segments": [
                {
                    "id": s.get("id", idx + 1),
                    "start": float(s.get("start", 0.0)),
                    "end": float(s.get("end", 0.0)),
                    "duration": float(s.get("duration", 0.0)),
                    "text": s.get("text", ""),
                }
                for idx, s in enumerate(raw_segments)
            ],
            "difficulty": difficulty,
            "title": title or "Listening Lesson",
            "targetVocabCount": target_vocab_count,
            "targetQuizCount": target_quiz_count,
        }

        try:
            logger.info(
                f"[LessonGenerator] Calling Generative AI service at {url} (segments={len(raw_segments)})"
            )
            res = requests.post(url, json=payload, timeout=90)

            if not res.ok:
                logger.error(
                    f"[LessonGenerator] Generative service returned status {res.status_code}: {res.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Generative AI service error: {res.text[:250]}",
                )

            body = res.json()
            raw_vocab = body.get("vocabularyList", [])
            raw_quizzes = body.get("quizQuestions", [])

            vocab_items = [
                VocabularyItem(
                    id=item.get("id", idx + 1),
                    word=item.get("word", ""),
                    part_of_speech=item.get("partOfSpeech", "n"),
                    phonetic=item.get("phonetic", ""),
                    meaning_vi=item.get("meaningVi", ""),
                    example=item.get("example", ""),
                    example_vi=item.get("exampleVi", ""),
                    audio_url=item.get("audioUrl"),
                )
                for idx, item in enumerate(raw_vocab)
            ]

            quiz_items = [
                QuizQuestion(
                    id=item.get("id", idx + 1),
                    question=item.get("question", ""),
                    options=item.get("options", []),
                    correct_answer_index=item.get("correctAnswerIndex", 0),
                    explanation=item.get("explanation", ""),
                    segment_timestamp=float(item.get("segmentTimestamp", item.get("startTime", 0.0)) or 0.0),
                    start_time=float(item.get("startTime", item.get("segmentTimestamp", 0.0)) or 0.0),
                    end_time=float(item.get("endTime", (item.get("startTime", 0.0) or 0.0) + 15.0) or 0.0),
                )
                for idx, item in enumerate(raw_quizzes)
            ]

            return vocab_items, quiz_items

        except requests.RequestException as e:
            logger.error(
                f"[LessonGenerator] Failed to connect to Generative service at {url}: {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Generative AI service is unavailable: {str(e)}",
            )

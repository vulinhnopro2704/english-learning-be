"""Normalized Relational PostgreSQL models in schema 'listening'."""

from datetime import datetime, timezone
import uuid
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    MetaData,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    metadata = MetaData(schema="listening")


def generate_uuid(prefix: str = "") -> str:
    """Generate clean prefixed UUID."""
    clean_id = uuid.uuid4().hex[:12]
    return f"{prefix}-{clean_id}" if prefix else clean_id


class ListeningLesson(Base):
    """Main lesson metadata table."""

    __tablename__ = "lessons"

    id = Column("id", String(64), primary_key=True, default=lambda: generate_uuid("lesson"))
    video_id = Column("videoId", String(32), nullable=False, index=True)
    title = Column("title", String(500), nullable=False)
    description = Column("description", Text, nullable=True)
    thumbnail_url = Column("thumbnailUrl", String(500), nullable=False)
    duration = Column("duration", String(32), nullable=False, default="03:30")
    difficulty = Column("difficulty", String(32), nullable=False, default="medium")
    language = Column("language", String(16), nullable=False, default="en")
    is_published = Column("isPublished", Boolean, nullable=False, default=True)
    order = Column("order", Integer, nullable=False, default=0)
    created_at = Column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relational Child Entities
    vocabularies: List["LessonVocabulary"] = relationship(
        "LessonVocabulary",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonVocabulary.order",
        lazy="selectin",
    )
    quizzes: List["LessonQuiz"] = relationship(
        "LessonQuiz",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonQuiz.order",
        lazy="selectin",
    )
    segments: List["LessonSegment"] = relationship(
        "LessonSegment",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonSegment.segment_index",
        lazy="selectin",
    )


class LessonVocabulary(Base):
    """Step 1: Vocabulary table for Nghe bat am."""

    __tablename__ = "lesson_vocabularies"

    id = Column("id", String(64), primary_key=True, default=lambda: generate_uuid("vocab"))
    lesson_id = Column(
        "lessonId",
        String(64),
        ForeignKey("listening.lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order = Column("order", Integer, nullable=False, default=0)
    word = Column("word", String(255), nullable=False)
    part_of_speech = Column("partOfSpeech", String(64), nullable=True)
    phonetic = Column("phonetic", String(255), nullable=True)
    meaning_vi = Column("meaningVi", Text, nullable=False)
    example = Column("example", Text, nullable=True)
    example_vi = Column("exampleVi", Text, nullable=True)
    audio_url = Column("audioUrl", String(500), nullable=True)
    created_at = Column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lesson: Optional[ListeningLesson] = relationship("ListeningLesson", back_populates="vocabularies")


class LessonQuiz(Base):
    """Step 2: Multiple choice comprehension questions for Nghe van dung."""

    __tablename__ = "lesson_quizzes"

    id = Column("id", String(64), primary_key=True, default=lambda: generate_uuid("quiz"))
    lesson_id = Column(
        "lessonId",
        String(64),
        ForeignKey("listening.lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order = Column("order", Integer, nullable=False, default=0)
    question = Column("question", Text, nullable=False)
    options = Column("options", ARRAY(String), nullable=False)
    correct_answer_index = Column("correctAnswerIndex", Integer, nullable=False, default=0)
    explanation = Column("explanation", Text, nullable=True)
    segment_timestamp = Column("segmentTimestamp", Float, nullable=False, default=0.0)
    created_at = Column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lesson: Optional[ListeningLesson] = relationship("ListeningLesson", back_populates="quizzes")


class LessonSegment(Base):
    """Step 3: Sentence-by-sentence timestamped segments for Cloze, Shadowing & Dictation."""

    __tablename__ = "lesson_segments"

    id = Column("id", String(64), primary_key=True, default=lambda: generate_uuid("seg"))
    lesson_id = Column(
        "lessonId",
        String(64),
        ForeignKey("listening.lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_index = Column("segmentIndex", Integer, nullable=False, default=0)
    start_time = Column("startTime", Float, nullable=False)
    end_time = Column("endTime", Float, nullable=False)
    duration = Column("duration", Float, nullable=False)
    text = Column("text", Text, nullable=False)
    masked_text = Column("maskedText", Text, nullable=True)
    created_at = Column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lesson: Optional[ListeningLesson] = relationship("ListeningLesson", back_populates="segments")
    blanks: List["SegmentBlank"] = relationship(
        "SegmentBlank",
        back_populates="segment",
        cascade="all, delete-orphan",
        order_by="SegmentBlank.blank_index",
        lazy="selectin",
    )


class SegmentBlank(Base):
    """Masked word blanks within a sentence segment."""

    __tablename__ = "segment_blanks"

    id = Column("id", String(64), primary_key=True, default=lambda: generate_uuid("blank"))
    segment_id = Column(
        "segmentId",
        String(64),
        ForeignKey("listening.lesson_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blank_index = Column("blankIndex", Integer, nullable=False, default=0)
    original_word = Column("originalWord", String(255), nullable=False)
    hint = Column("hint", String(255), nullable=False)
    created_at = Column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    segment: Optional[LessonSegment] = relationship("LessonSegment", back_populates="blanks")

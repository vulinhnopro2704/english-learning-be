"""FastAPI router for YouTube listening, transcript, and full CRUD lesson endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.schemas import (
    ExtractTranscriptRequest,
    ExtractTranscriptResponse,
    ProcessVideoRequest,
    UpdateLessonRequest,
    LessonDetail,
    LessonListResponse,
)
from app.services.youtube_service import YouTubeService
from app.services.lesson_generator import LessonGeneratorService
from app.repositories.lesson_repo import lesson_repository
from app.dependencies import get_current_user, UserAuth

router = APIRouter(prefix="", tags=["Listening"])


@router.get("/lessons", response_model=LessonListResponse)
async def list_lessons(
    query: Optional[str] = Query(default=None, description="Search keyword in title or description"),
    difficulty: Optional[str] = Query(default=None, description="Filter by difficulty ('easy', 'medium', 'hard')"),
    is_published: Optional[bool] = Query(default=None, description="Filter by published status"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Page offset"),
    user: UserAuth = Depends(get_current_user),
):
    """List all processed YouTube listening lessons with optional search and filtering."""
    total, items = lesson_repository.list_lessons(
        query=query,
        difficulty=difficulty,
        is_published=is_published,
        limit=limit,
        offset=offset,
    )
    return LessonListResponse(total=total, items=items)


@router.get("/lessons/{lesson_id}", response_model=LessonDetail)
async def get_lesson(
    lesson_id: str,
    user: UserAuth = Depends(get_current_user),
):
    """Retrieve full 3-step structured listening lesson by ID."""
    lesson = lesson_repository.get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )
    return lesson


@router.post("/process-video", response_model=LessonDetail, status_code=status.HTTP_201_CREATED)
async def process_video(
    payload: ProcessVideoRequest,
    user: UserAuth = Depends(get_current_user),
):
    """Process a YouTube video into a complete 3-step interactive listening lesson and persist to database."""
    video_id, language, is_generated, raw_segments = YouTubeService.get_transcript(
        payload.youtube_url
    )

    # Automatically generate Step 1 (Vocab), Step 2 (Quiz), and Step 3 (Cloze)
    vocab_list, quiz_list, cloze_segments = LessonGeneratorService.generate_lesson_content(
        raw_segments, difficulty=payload.difficulty or "medium"
    )

    # Compute duration
    total_seconds = int(raw_segments[-1]["end"]) if raw_segments else 180
    mins = total_seconds // 60
    secs = total_seconds % 60
    duration_str = f"{mins:02d}:{secs:02d}"

    title = payload.title or f"YouTube Listening Lesson ({video_id})"
    description = payload.description or f"Interactive listening lesson created from YouTube video {video_id}."
    thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    created_lesson = lesson_repository.create_lesson(
        video_id=video_id,
        title=title,
        description=description,
        thumbnail_url=thumbnail_url,
        duration=duration_str,
        difficulty=payload.difficulty or "medium",
        language=language,
        is_published=payload.is_published if payload.is_published is not None else True,
        vocabulary_list=vocab_list,
        quiz_questions=quiz_list,
        segments=cloze_segments,
    )

    return created_lesson


@router.put("/lessons/{lesson_id}", response_model=LessonDetail)
async def update_lesson(
    lesson_id: str,
    payload: UpdateLessonRequest,
    user: UserAuth = Depends(get_current_user),
):
    """Update metadata of an existing listening lesson."""
    updated = lesson_repository.update_lesson(
        lesson_id=lesson_id,
        title=payload.title,
        description=payload.description,
        difficulty=payload.difficulty,
        is_published=payload.is_published,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )
    return updated


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_200_OK)
async def delete_lesson(
    lesson_id: str,
    user: UserAuth = Depends(get_current_user),
):
    """Delete a listening lesson by ID."""
    success = lesson_repository.delete_lesson(lesson_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )
    return {"message": "Lesson deleted successfully", "id": lesson_id}


@router.post("/extract", response_model=ExtractTranscriptResponse)
async def extract_transcript(
    payload: ExtractTranscriptRequest,
    user: UserAuth = Depends(get_current_user),
):
    """Extract raw timestamped transcript segments from a YouTube video URL or ID."""
    video_id, language, is_generated, segments = YouTubeService.get_transcript(
        payload.youtube_url, payload.language or "en"
    )

    return ExtractTranscriptResponse(
        video_id=video_id,
        language=language,
        is_generated=is_generated,
        total_segments=len(segments),
        segments=segments,
    )

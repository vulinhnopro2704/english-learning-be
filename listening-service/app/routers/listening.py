import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import (
    ExtractTranscriptRequest,
    ExtractTranscriptResponse,
    ProcessVideoRequest,
    ProcessVideoResponse,
    UpdateLessonRequest,
    LessonDetail,
    LessonListResponse,
    LessonVocabResponse,
    LessonQuizResponse,
    LessonSegmentResponse,
    RegenerateVocabRequest,
    RegenerateQuizRequest,
)
from app.services.youtube_service import YouTubeService
from app.services.lesson_generator import LessonGeneratorService
from app.repositories.lesson_repo import LessonRepository
from app.database import get_db, async_session
from app.dependencies import get_current_user, UserAuth

logger = logging.getLogger("listening-service")

router = APIRouter(prefix="", tags=["Listening"])


async def _process_video_job(
    lesson_id: str,
    youtube_url: str,
    video_id: str,
    custom_title: Optional[str],
    difficulty: str,
):
    """Background task to extract transcript, run AI generation, and save lesson data."""
    logger.info(
        f"[BackgroundJob] Starting async AI lesson generation for lesson {lesson_id} (video={video_id})"
    )
    async with async_session() as db:
        try:
            _, language, _, raw_segments = YouTubeService.get_transcript(youtube_url)
            if not raw_segments:
                raise ValueError("Could not extract transcript segments from YouTube video")

            title = custom_title or f"YouTube Listening Lesson ({video_id})"

            # Run 3-step AI generation
            vocab_list, quiz_list, cloze_segments = (
                LessonGeneratorService.generate_lesson_content(
                    raw_segments=raw_segments,
                    difficulty=difficulty,
                    title=title,
                    target_vocab_count=12,
                    target_quiz_count=4,
                )
            )

            total_seconds = int(raw_segments[-1]["end"]) if raw_segments else 180
            mins = total_seconds // 60
            secs = total_seconds % 60
            duration_str = f"{mins:02d}:{secs:02d}"

            await LessonRepository.populate_lesson_content(
                db=db,
                lesson_id=lesson_id,
                title=title,
                duration=duration_str,
                language=language,
                vocabulary_list=vocab_list,
                quiz_questions=quiz_list,
                segments=cloze_segments,
            )
            logger.info(
                f"[BackgroundJob] Successfully completed AI generation for lesson {lesson_id}"
            )
        except Exception as e:
            logger.error(
                f"[BackgroundJob] Failed AI generation for lesson {lesson_id}: {e}",
                exc_info=True,
            )
            await LessonRepository.mark_lesson_failed(
                db=db,
                lesson_id=lesson_id,
                error_message=str(e),
            )


@router.get("/lessons", response_model=LessonListResponse)
async def list_lessons(
    query: Optional[str] = Query(default=None, description="Search keyword in title or description"),
    difficulty: Optional[str] = Query(default=None, description="Filter by difficulty ('easy', 'medium', 'hard')"),
    is_published: Optional[bool] = Query(default=None, description="Filter by published status"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Page offset"),
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """List all processed YouTube listening lessons with optional search and filtering."""
    total, items = await LessonRepository.list_lessons(
        db=db,
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
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Retrieve full 3-step structured listening lesson by ID."""
    lesson = await LessonRepository.get_lesson(db=db, lesson_id=lesson_id)
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )
    return lesson


@router.get("/lessons/{lesson_id}/vocabularies", response_model=LessonVocabResponse)
async def get_lesson_vocabularies(
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Step 1 (Nghe bat am): Retrieve key vocabulary flashcards for a lesson."""
    vocab_items = await LessonRepository.get_lesson_vocabularies(db=db, lesson_id=lesson_id)
    if vocab_items is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )
    return LessonVocabResponse(
        lesson_id=lesson_id,
        total_vocab=len(vocab_items),
        vocabulary_list=vocab_items,
    )


@router.get("/lessons/{lesson_id}/quizzes", response_model=LessonQuizResponse)
async def get_lesson_quizzes(
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Step 2 (Nghe van dung): Retrieve comprehension quiz questions for a lesson."""
    quizzes = await LessonRepository.get_lesson_quizzes(db=db, lesson_id=lesson_id)
    if quizzes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )
    return LessonQuizResponse(
        lesson_id=lesson_id,
        total_quiz=len(quizzes),
        quiz_questions=quizzes,
    )


@router.get("/lessons/{lesson_id}/segments", response_model=LessonSegmentResponse)
async def get_lesson_segments(
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Step 3 (Nghe chi tiet & Shadowing): Retrieve timestamped segments and cloze exercises."""
    segments = await LessonRepository.get_lesson_segments(db=db, lesson_id=lesson_id)
    if segments is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )
    return LessonSegmentResponse(
        lesson_id=lesson_id,
        total_segments=len(segments),
        segments=segments,
    )


@router.post("/process-video", response_model=ProcessVideoResponse, status_code=status.HTTP_202_ACCEPTED)
async def process_video(
    payload: ProcessVideoRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Process a YouTube video asynchronously in the background and return 202 Accepted immediately."""
    video_id = YouTubeService.extract_video_id(payload.youtube_url)
    title = payload.title or f"YouTube Video ({video_id})"
    description = payload.description or f"Interactive listening lesson created from YouTube video {video_id}."
    thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    lesson_id = await LessonRepository.create_placeholder_lesson(
        db=db,
        video_id=video_id,
        title=title,
        description=description,
        thumbnail_url=thumbnail_url,
        difficulty=payload.difficulty or "medium",
        language="en",
        is_published=payload.is_published if payload.is_published is not None else True,
    )

    background_tasks.add_task(
        _process_video_job,
        lesson_id=lesson_id,
        youtube_url=payload.youtube_url,
        video_id=video_id,
        custom_title=payload.title,
        difficulty=payload.difficulty or "medium",
    )

    return ProcessVideoResponse(
        id=lesson_id,
        video_id=video_id,
        title=title,
        status="PROCESSING",
        message="Video đã được tiếp nhận và đang được AI xử lý trong nền (1-2 phút).",
    )


@router.post("/lessons/{lesson_id}/regenerate-vocab", response_model=LessonVocabResponse)
async def regenerate_vocab(
    lesson_id: str,
    payload: RegenerateVocabRequest = RegenerateVocabRequest(),
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Regenerate Step 1 vocabulary items using AI pipeline and update lesson."""
    lesson = await LessonRepository.get_lesson(db=db, lesson_id=lesson_id)
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )

    raw_segments = [
        {
            "id": s.id,
            "start": s.start,
            "end": s.end,
            "duration": s.duration,
            "text": s.text,
        }
        for s in lesson.segments
    ]

    target_diff = payload.difficulty or lesson.difficulty
    target_count = payload.target_vocab_count or 12

    new_vocab_list = LessonGeneratorService.generate_vocabulary_only(
        raw_segments=raw_segments,
        difficulty=target_diff,
        target_vocab_count=target_count,
    )

    updated_vocab = await LessonRepository.replace_lesson_vocabularies(
        db=db, lesson_id=lesson_id, new_vocab_list=new_vocab_list
    )

    return LessonVocabResponse(
        lesson_id=lesson_id,
        total_vocab=len(updated_vocab or []),
        vocabulary_list=updated_vocab or [],
    )


@router.post("/lessons/{lesson_id}/regenerate-quizzes", response_model=LessonQuizResponse)
async def regenerate_quizzes(
    lesson_id: str,
    payload: RegenerateQuizRequest = RegenerateQuizRequest(),
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Regenerate Step 2 quiz questions using AI pipeline and update lesson."""
    lesson = await LessonRepository.get_lesson(db=db, lesson_id=lesson_id)
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found",
        )

    raw_segments = [
        {
            "id": s.id,
            "start": s.start,
            "end": s.end,
            "duration": s.duration,
            "text": s.text,
        }
        for s in lesson.segments
    ]

    target_diff = payload.difficulty or lesson.difficulty
    target_count = payload.target_quiz_count or 4

    new_quiz_list = LessonGeneratorService.generate_quizzes_only(
        raw_segments=raw_segments,
        difficulty=target_diff,
        target_quiz_count=target_count,
    )

    updated_quizzes = await LessonRepository.replace_lesson_quizzes(
        db=db, lesson_id=lesson_id, new_quiz_list=new_quiz_list
    )

    return LessonQuizResponse(
        lesson_id=lesson_id,
        total_quiz=len(updated_quizzes or []),
        quiz_questions=updated_quizzes or [],
    )


@router.put("/lessons/{lesson_id}", response_model=LessonDetail)
async def update_lesson(
    lesson_id: str,
    payload: UpdateLessonRequest,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Update metadata of an existing listening lesson."""
    updated = await LessonRepository.update_lesson(
        db=db,
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
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Delete a listening lesson by ID."""
    success = await LessonRepository.delete_lesson(db=db, lesson_id=lesson_id)
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

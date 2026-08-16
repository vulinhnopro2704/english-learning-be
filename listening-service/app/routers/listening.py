"""FastAPI router for YouTube listening and transcript endpoints."""

from fastapi import APIRouter, Depends
from app.schemas import (
    ExtractTranscriptRequest,
    ExtractTranscriptResponse,
    ProcessVideoRequest,
    ProcessVideoResponse,
)
from app.services.youtube_service import YouTubeService
from app.services.blank_generator import BlankGeneratorService
from app.dependencies import get_current_user, require_admin_role, UserAuth

router = APIRouter(prefix="", tags=["Listening"])


@router.post("/extract", response_model=ExtractTranscriptResponse)
async def extract_transcript(
    payload: ExtractTranscriptRequest,
    user: UserAuth = Depends(get_current_user),
):
    """Extract timestamped transcript segments from a YouTube video URL or ID."""
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


@router.post("/process-video", response_model=ProcessVideoResponse)
async def process_video(
    payload: ProcessVideoRequest,
    user: UserAuth = Depends(get_current_user),
):
    """Process a YouTube video into a complete interactive listening lesson."""
    video_id, language, is_generated, raw_segments = YouTubeService.get_transcript(
        payload.youtube_url
    )

    enriched_segments = BlankGeneratorService.generate_blanks(
        raw_segments, difficulty=payload.difficulty or "medium"
    )

    title = payload.title or f"YouTube Lesson ({video_id})"

    return ProcessVideoResponse(
        video_id=video_id,
        title=title,
        language=language,
        is_published=payload.is_published if payload.is_published is not None else True,
        total_segments=len(enriched_segments),
        segments=enriched_segments,
    )

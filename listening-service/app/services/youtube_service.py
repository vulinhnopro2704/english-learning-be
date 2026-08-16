"""YouTube transcript extraction service using yt-dlp with youtube-transcript-api fallback."""

import re
from typing import List, Tuple, Dict, Any
from fastapi import HTTPException
import requests
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled


class YouTubeService:
    """Service to parse YouTube URLs and fetch timestamped transcripts."""

    @staticmethod
    def extract_video_id(url_or_id: str) -> str:
        """Extract 11-character YouTube video ID from various URL formats."""
        clean_input = url_or_id.strip()

        if re.fullmatch(r"[A-Za-z0-9_-]{11}", clean_input):
            return clean_input

        patterns = [
            r"(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?\/]|$)",
            r"youtu\.be\/([0-9A-Za-z_-]{11})",
            r"youtube\.com\/embed\/([0-9A-Za-z_-]{11})",
            r"youtube\.com\/shorts\/([0-9A-Za-z_-]{11})",
        ]

        for pattern in patterns:
            match = re.search(pattern, clean_input)
            if match:
                return match.group(1)

        raise HTTPException(
            status_code=400,
            detail=f"Invalid YouTube URL or Video ID: '{url_or_id}'",
        )

    @classmethod
    def _get_transcript_via_ytdlp(
        cls, video_id: str, preferred_lang: str = "en"
    ) -> Tuple[str, str, bool, List[Dict[str, Any]]]:
        """Fetch transcript via yt-dlp json3 subtitle parser."""
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "extractor_args": {"youtube": {"player_client": ["android", "web"]}},
            "nocheckcertificate": True,
            "quiet": True,
            "no_warnings": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("Could not fetch video info")

            video_title = info.get("title", f"YouTube Video ({video_id})")
            subtitles = info.get("subtitles") or info.get("automatic_captions")

            if not subtitles:
                raise ValueError("No subtitles or captions found for this video")

            # Match preferred language or fallback to en
            lang_key = preferred_lang if preferred_lang in subtitles else ("en" if "en" in subtitles else list(subtitles.keys())[0])
            sub_list = subtitles[lang_key]

            # Pick json3 format if available, else first format
            json3_sub = next((s for s in sub_list if s.get("ext") == "json3"), sub_list[0])
            sub_url = json3_sub["url"]

            resp = requests.get(sub_url, timeout=10, verify=False)
            if not resp.ok:
                raise ValueError("Failed to download subtitle content")

            sub_data = resp.json()
            events = sub_data.get("events", [])

            segments = []
            segment_id = 1
            for ev in events:
                start_ms = ev.get("tStartMs", 0)
                dur_ms = ev.get("dDurationMs", 0)
                segs = ev.get("segs", [])

                raw_text = "".join([s.get("utf8", "") for s in segs]).replace("\n", " ").strip()
                # Clean music notes and extra whitespace
                clean_text = re.sub(r"^[♪\s]+|[♪\s]+$", "", raw_text).strip()

                if not clean_text or clean_text == "[♪♪♪]":
                    continue

                start = round(start_ms / 1000.0, 2)
                duration = round(dur_ms / 1000.0, 2)
                end = round(start + duration, 2)

                segments.append({
                    "id": segment_id,
                    "start": start,
                    "end": end,
                    "duration": duration,
                    "text": clean_text,
                })
                segment_id += 1

            is_generated = info.get("subtitles") is None or preferred_lang not in (info.get("subtitles") or {})

            return video_title, lang_key, is_generated, segments

    @classmethod
    def get_transcript(
        cls, youtube_url: str, preferred_lang: str = "en"
    ) -> Tuple[str, str, bool, List[Dict[str, Any]]]:
        """Fetch transcript segments with start and end timestamps.

        Tries yt-dlp first for robust caption extraction, falling back to youtube-transcript-api.
        """
        video_id = cls.extract_video_id(youtube_url)

        # Primary Method: yt-dlp
        try:
            video_title, lang, is_generated, segments = cls._get_transcript_via_ytdlp(video_id, preferred_lang)
            if segments:
                return video_id, lang, is_generated, segments
        except Exception as err:
            print(f"[YouTubeService] yt-dlp extraction failed: {err}")
            pass

        # Fallback Method: youtube-transcript-api
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            try:
                transcript = transcript_list.find_transcript([preferred_lang, "en", "en-US"])
            except Exception:
                all_transcripts = list(transcript_list)
                if not all_transcripts:
                    raise HTTPException(status_code=404, detail="No subtitles found for this video.")
                transcript = all_transcripts[0]

            raw_data = transcript.fetch()
            segments = []
            for index, item in enumerate(raw_data, start=1):
                text = item.get("text", "").replace("\n", " ").strip()
                if not text:
                    continue
                start = round(float(item.get("start", 0.0)), 2)
                duration = round(float(item.get("duration", 0.0)), 2)
                segments.append({
                    "id": index,
                    "start": start,
                    "end": round(start + duration, 2),
                    "duration": duration,
                    "text": text,
                })
            return video_id, transcript.language_code, transcript.is_generated, segments

        except TranscriptsDisabled:
            raise HTTPException(status_code=400, detail="Subtitles are disabled for this YouTube video.")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Failed to fetch transcript: {str(e)}")

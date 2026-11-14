import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { Innertube } from 'youtubei.js';
import { ApiException } from '../../../common/exceptions/api.exception';

export interface RawSegment {
  id: number;
  start: number;
  end: number;
  duration: number;
  text: string;
}

export interface VideoTranscriptResult {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  language: string;
  isGenerated: boolean;
  segments: RawSegment[];
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);
  private innertubeClient: Innertube | null = null;

  /**
   * Extracts the 11-character YouTube video ID from various URL formats.
   */
  extractVideoId(urlOrId: string): string {
    const clean = urlOrId.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(clean)) {
      return clean;
    }

    const patterns = [
      /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?\/]|$)/,
      /youtu\.be\/([0-9A-Za-z_-]{11})/,
      /youtube\.com\/embed\/([0-9A-Za-z_-]{11})/,
      /youtube\.com\/shorts\/([0-9A-Za-z_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new ApiException({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'INVALID_YOUTUBE_URL',
      message: `Invalid YouTube URL or Video ID: '${urlOrId}'`,
    });
  }

  private async getInnertube(): Promise<Innertube> {
    if (!this.innertubeClient) {
      this.innertubeClient = await Innertube.create();
    }
    return this.innertubeClient;
  }

  /**
   * Fetches transcript and video metadata from YouTube using InnerTube API.
   */
  async getTranscript(urlOrId: string, preferredLang = 'en'): Promise<VideoTranscriptResult> {
    const videoId = this.extractVideoId(urlOrId);
    const yt = await this.getInnertube();

    try {
      const info = await yt.getInfo(videoId);
      const title = info.basic_info.title || `YouTube Video (${videoId})`;
      const thumbnailUrl =
        info.basic_info.thumbnail?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const durationSeconds = info.basic_info.duration || 180;
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      const duration = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      let rawSegments: RawSegment[] = [];
      let language = preferredLang;
      let isGenerated = true;

      try {
        const transcriptData = await info.getTranscript();
        const initialSegments = transcriptData?.transcript?.content?.body?.initial_segments;

        if (initialSegments && Array.isArray(initialSegments)) {
          rawSegments = initialSegments.map((item: any, idx: number) => {
            const startMs = Number(item.start_ms ?? 0);
            const endMs = Number(item.end_ms ?? startMs + 3000);
            const startSec = Number((startMs / 1000).toFixed(2));
            const endSec = Number((endMs / 1000).toFixed(2));
            const durationSec = Number((endSec - startSec).toFixed(2));
            const text = (item.snippet?.text ?? '').replace(/\n/g, ' ').trim();

            return {
              id: idx + 1,
              start: startSec,
              end: endSec,
              duration: durationSec,
              text,
            };
          }).filter((s) => s.text.length > 0);
        }
      } catch (transcriptError) {
        this.logger.warn(
          `Direct InnerTube transcript extraction failed for video ${videoId}, checking fallback: ${transcriptError instanceof Error ? transcriptError.message : String(transcriptError)}`,
        );
      }

      if (rawSegments.length === 0) {
        throw new ApiException({
          statusCode: HttpStatus.NOT_FOUND,
          errorCode: 'TRANSCRIPT_NOT_FOUND',
          message: `No available English subtitles or transcript found for video '${videoId}'`,
        });
      }

      return {
        videoId,
        title,
        thumbnailUrl,
        duration,
        language,
        isGenerated,
        segments: rawSegments,
      };
    } catch (error) {
      if (error instanceof ApiException) throw error;
      this.logger.error(
        `Failed to fetch YouTube video info for ${videoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'YOUTUBE_FETCH_ERROR',
        message: `Failed to fetch YouTube video transcript for '${videoId}'`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}

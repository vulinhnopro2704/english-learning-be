import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';

export interface TranscribeInput {
  audioBase64?: string;
  audioUrl?: string;
  mimeType?: string;
  languageCode?: string;
}

export interface TranscribeResult {
  text: string;
  confidence: number | null;
}

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);

  constructor(private readonly configService: ConfigService) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      this.logger.error('[ElevenLabs:STT] Missing ELEVENLABS_API_KEY');
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'STT_PROVIDER_ERROR',
        message: 'ElevenLabs API key is not configured',
      });
    }

    const modelId =
      this.configService.get<string>('ELEVENLABS_STT_MODEL_ID') ?? 'scribe_v2';

    const startTime = Date.now();
    const blob = await this.resolveAudioBlob(input);
    const source = input.audioBase64 ? 'audioBase64' : 'audioUrl';

    this.logger.log(
      `[ElevenLabs:STT] Sending request modelId=${modelId} source=${source} mimeType=${blob.type || 'unknown'} audioBytes=${blob.size} languageCode=${input.languageCode ?? 'auto'}`,
    );

    const formData = new FormData();
    formData.append('file', blob, 'voice-input.webm');
    formData.append('model_id', modelId);
    if (input.languageCode) {
      formData.append('language_code', input.languageCode);
    }

    let response: Response;
    try {
      response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: formData,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(
        `[ElevenLabs:STT] Network error modelId=${modelId} durationMs=${durationMs} error=${this.stringifyError(error)}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'STT_PROVIDER_ERROR',
        message: 'ElevenLabs STT request failed before receiving response',
      });
    }

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = this.truncate(await response.text(), 1000);
      this.logger.error(
        `[ElevenLabs:STT] Request failed modelId=${modelId} status=${response.status} durationMs=${durationMs} body=${errorBody}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'STT_PROVIDER_ERROR',
        message: `ElevenLabs STT request failed with status ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      text?: string;
      language_probability?: number;
    };

    this.logger.log(
      `[ElevenLabs:STT] Response received modelId=${modelId} status=${response.status} durationMs=${durationMs} transcriptLength=${payload.text?.length ?? 0}`,
    );

    const text = payload.text?.trim();
    if (!text) {
      this.logger.error(
        `[ElevenLabs:STT] Empty transcript modelId=${modelId} payloadPreview=${this.truncate(JSON.stringify(payload), 500)}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'STT_PROVIDER_ERROR',
        message: 'ElevenLabs STT returned empty transcript',
      });
    }

    return {
      text,
      confidence:
        typeof payload.language_probability === 'number'
          ? payload.language_probability
          : null,
    };
  }

  private async resolveAudioBlob(input: TranscribeInput): Promise<Blob> {
    if (input.audioBase64) {
      const buffer = Buffer.from(input.audioBase64, 'base64');
      return new Blob([buffer], {
        type: input.mimeType ?? 'audio/webm',
      });
    }

    if (input.audioUrl) {
      const response = await fetch(input.audioUrl);
      if (!response.ok) {
        this.logger.error(
          `[ElevenLabs:STT] Failed to download audioUrl status=${response.status} audioUrl=${input.audioUrl}`,
        );
        throw new ApiException({
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode: 'BAD_REQUEST',
          message: 'Could not download audio from audioUrl',
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Blob([arrayBuffer], {
        type:
          input.mimeType ??
          response.headers.get('content-type') ??
          'audio/webm',
      });
    }

    throw new ApiException({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'BAD_REQUEST',
      message: 'Either audioBase64 or audioUrl is required',
    });
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}...(truncated)`;
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}

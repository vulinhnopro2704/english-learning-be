import { HttpStatus, Injectable } from '@nestjs/common';
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
  constructor(private readonly configService: ConfigService) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'STT_PROVIDER_ERROR',
        message: 'ElevenLabs API key is not configured',
      });
    }

    const modelId =
      this.configService.get<string>('ELEVENLABS_STT_MODEL_ID') ?? 'scribe_v2';

    const blob = await this.resolveAudioBlob(input);

    const formData = new FormData();
    formData.append('file', blob, 'voice-input.webm');
    formData.append('model_id', modelId);
    if (input.languageCode) {
      formData.append('language_code', input.languageCode);
    }

    const response = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: formData,
      },
    );

    if (!response.ok) {
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

    const text = payload.text?.trim();
    if (!text) {
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
}

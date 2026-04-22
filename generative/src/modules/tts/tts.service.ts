import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';

export interface TtsResult {
  url: string | null;
  mimeType: string;
  provider: string;
  status: 'completed' | 'skipped' | 'failed';
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(private readonly configService: ConfigService) {}

  async synthesize(text: string, voiceId?: string): Promise<TtsResult> {
    const apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      this.logger.warn('[ElevenLabs:TTS] Missing ELEVENLABS_API_KEY, skipping');
      return {
        url: null,
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
        status: 'skipped',
      };
    }

    const effectiveVoiceId =
      voiceId ??
      this.configService.get<string>('ELEVENLABS_VOICE_ID') ??
      'EXAVITQu4vr4xnSDxMaL';
    const modelId =
      this.configService.get<string>('ELEVENLABS_MODEL_ID') ??
      'eleven_flash_v2_5';
    const startTime = Date.now();

    this.logger.log(
      `[ElevenLabs:TTS] Sending request voiceId=${effectiveVoiceId} modelId=${modelId} textLength=${text.length}`,
    );

    let response: Response;
    try {
      response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            output_format: 'mp3_44100_128',
          }),
        },
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(
        `[ElevenLabs:TTS] Network error voiceId=${effectiveVoiceId} modelId=${modelId} durationMs=${durationMs} error=${this.stringifyError(error)}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'TTS_PROVIDER_ERROR',
        message: 'ElevenLabs TTS request failed before receiving response',
      });
    }

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = this.truncate(await response.text(), 1000);
      this.logger.error(
        `[ElevenLabs:TTS] Request failed voiceId=${effectiveVoiceId} modelId=${modelId} status=${response.status} durationMs=${durationMs} body=${errorBody}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'TTS_PROVIDER_ERROR',
        message: `ElevenLabs request failed with status ${response.status}`,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    this.logger.log(
      `[ElevenLabs:TTS] Request succeeded voiceId=${effectiveVoiceId} modelId=${modelId} status=${response.status} durationMs=${durationMs} audioBytes=${arrayBuffer.byteLength}`,
    );

    return {
      url: `data:audio/mpeg;base64,${base64}`,
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      status: 'completed',
    };
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

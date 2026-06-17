import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';

export interface TtsResult {
  url: string | null;
  mimeType: string;
  provider: string;
  status: 'completed' | 'skipped' | 'failed';
  source: string;
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
        source: 'Voice by elevenlabs.io',
      };
    }

    const effectiveVoiceId =
      voiceId ??
      this.configService.get<string>('ELEVENLABS_VOICE_ID') ??
      'EXAVITQu4vr4xnSDxMaL';
    const modelId =
      this.configService.get<string>('ELEVENLABS_MODEL_ID') ??
      'eleven_flash_v2_5';
    const outputFormat =
      this.configService.get<string>('ELEVENLABS_OUTPUT_FORMAT') ??
      'mp3_22050_32';
    const startTime = Date.now();

    this.logger.log(
      `[ElevenLabs:TTS] Sending request voiceId=${effectiveVoiceId} modelId=${modelId} format=${outputFormat} textLength=${text.length}`,
    );

    let response: Response;
    try {
      response = await this.fetchWithRetry(
        `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}?output_format=${outputFormat}`,
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
            output_format: outputFormat,
          }),
        },
      );
    } catch (error) {
      throw error; // Propagate the classified ApiException thrown by fetchWithRetry
    }

    const durationMs = Date.now() - startTime;
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    this.logger.log(
      `[ElevenLabs:TTS] Request succeeded voiceId=${effectiveVoiceId} modelId=${modelId} format=${outputFormat} durationMs=${durationMs} audioBytes=${arrayBuffer.byteLength}`,
    );

    return {
      url: `data:audio/mpeg;base64,${base64}`,
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      status: 'completed',
      source: 'Voice by elevenlabs.io',
    };
  }

  /**
   * Synthesize text to speech as a readable binary stream.
   * Directly pipes the ElevenLabs response stream.
   */
  async synthesizeStream(text: string, voiceId?: string): Promise<Response> {
    const apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      this.logger.warn('[ElevenLabs:TTS] Missing ELEVENLABS_API_KEY, cannot stream');
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'TTS_CONFIG_ERROR',
        message: 'Missing ELEVENLABS_API_KEY configuration',
      });
    }

    const effectiveVoiceId =
      voiceId ??
      this.configService.get<string>('ELEVENLABS_VOICE_ID') ??
      'EXAVITQu4vr4xnSDxMaL';
    const modelId =
      this.configService.get<string>('ELEVENLABS_MODEL_ID') ??
      'eleven_flash_v2_5';
    const outputFormat =
      this.configService.get<string>('ELEVENLABS_OUTPUT_FORMAT') ??
      'mp3_22050_32';

    this.logger.log(
      `[ElevenLabs:TTS] Streaming request voiceId=${effectiveVoiceId} modelId=${modelId} format=${outputFormat} textLength=${text.length}`,
    );

    return this.fetchWithRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}/stream?output_format=${outputFormat}`,
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
          output_format: outputFormat,
        }),
      },
    );
  }

  /**
   * Helper function to call fetch and retry on network or rate limit / server errors
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    delayMs = 1000,
    backoffFactor = 2,
  ): Promise<Response> {
    let attempt = 0;
    while (attempt < retries) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }

        const isRetryable = response.status === 429 || response.status >= 500;
        const errorBody = await response.text().catch(() => '');
        const errorMsg = `ElevenLabs request failed status=${response.status} body=${this.truncate(errorBody, 500)}`;

        attempt++;
        const isLastAttempt = attempt >= retries;
        if (isLastAttempt || !isRetryable) {
          this.logger.error(
            `[ElevenLabs:TTS] Request permanently failed — attempt=${attempt}/${retries} status=${response.status} body=${errorBody}`,
          );
          throw new ApiException({
            statusCode: HttpStatus.BAD_GATEWAY,
            errorCode: 'TTS_PROVIDER_ERROR',
            message: `ElevenLabs request failed with status ${response.status}`,
          });
        }

        const waitTime = delayMs * Math.pow(backoffFactor, attempt - 1);
        this.logger.warn(
          `[ElevenLabs:TTS] Request failed, retrying in ${waitTime}ms — attempt=${attempt}/${retries} error=${errorMsg}`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } catch (error) {
        if (error instanceof ApiException) {
          throw error;
        }

        attempt++;
        const isLastAttempt = attempt >= retries;
        if (isLastAttempt) {
          this.logger.error(
            `[ElevenLabs:TTS] Network error permanently failed — attempt=${attempt}/${retries} error=${this.stringifyError(error)}`,
          );
          throw new ApiException({
            statusCode: HttpStatus.BAD_GATEWAY,
            errorCode: 'TTS_PROVIDER_ERROR',
            message: 'ElevenLabs TTS request failed before receiving response',
          });
        }

        const waitTime = delayMs * Math.pow(backoffFactor, attempt - 1);
        this.logger.warn(
          `[ElevenLabs:TTS] Network error, retrying in ${waitTime}ms — attempt=${attempt}/${retries} error=${this.stringifyError(error)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
    throw new Error('Unexpected retry loop termination');
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

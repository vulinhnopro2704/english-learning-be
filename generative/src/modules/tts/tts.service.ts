import { HttpStatus, Injectable } from '@nestjs/common';
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
  constructor(private readonly configService: ConfigService) {}

  async synthesize(text: string, voiceId?: string): Promise<TtsResult> {
    const apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
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

    const response = await fetch(
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

    if (!response.ok) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'TTS_PROVIDER_ERROR',
        message: `ElevenLabs request failed with status ${response.status}`,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      url: `data:audio/mpeg;base64,${base64}`,
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      status: 'completed',
    };
  }
}

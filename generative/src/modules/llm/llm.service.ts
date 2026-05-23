import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';
import type { GenerateTutorResponseInput, TutorLlmResponse } from './llm.types';
import { OllamaService } from '../ollama/ollama.service';

const EMOTION_STATES = [
  'NEUTRAL',
  'SMILE',
  'THINKING',
  'ENCOURAGING',
  'CELEBRATE',
  'CORRECTIVE_SOFT',
] as const;

const ANIMATION_STATES = [
  'IDLE',
  'LISTENING',
  'THINKING',
  'TALKING',
  'GESTURE_EXPLAIN',
  'GESTURE_PRAISE',
] as const;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ollamaService: OllamaService,
  ) {}

  async generateTutorResponse(
    input: GenerateTutorResponseInput,
  ): Promise<TutorLlmResponse> {
    const prompt = this.buildPrompt(input);
    const startTime = Date.now();

    this.logger.log(
      `[LLM] Generating tutor response — profile=essay userInputLength=${input.userInput.length} recentTurns=${input.recentTurns.length} promptLength=${prompt.length}`,
    );

    const result = await this.ollamaService.chat({
      modelProfile: 'essay',
      messages: [{ role: 'user', content: prompt }],
      json: true,
    });

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[LLM] Tutor response received — durationMs=${durationMs} model=${result.model} contentLength=${result.content.length}`,
    );

    const rawText = result.content.trim();

    if (!rawText) {
      this.logger.error(
        `[LLM] Empty response text from Ollama — model=${result.model}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PROVIDER_ERROR',
        message: 'Ollama returned an empty response',
      });
    }

    const parsed = this.parseJsonLike(rawText);
    return this.normalizeOutput(parsed, input.userInput);
  }

  private buildPrompt(input: GenerateTutorResponseInput): string {
    const recentTurns = input.recentTurns
      .map(
        (turn, index) =>
          `Turn ${index + 1}: User="${turn.userInput}" | Tutor="${turn.tutorText}"`,
      )
      .join('\n');

    return [
      'You are an encouraging English tutor.',
      'Reply with valid JSON only. No markdown and no explanation outside JSON.',
      'Keep response concise and pedagogical for speaking practice.',
      'Output schema:',
      '{',
      '  "tutor_text": string,',
      `  "emotion_state": one of ${EMOTION_STATES.join(', ')},`,
      `  "animation_state": one of ${ANIMATION_STATES.join(', ')},`,
      '  "correction": {',
      '    "has_error": boolean,',
      '    "corrected_version": string,',
      '    "short_reason": string',
      '  }',
      '}',
      `Learner CEFR level: ${input.cefrLevel}`,
      `Focus topics: ${input.focusTopics.join(', ') || 'general conversation'}`,
      `User input: ${input.userInput}`,
      `Recent turns:\n${recentTurns || 'none'}`,
    ].join('\n');
  }

  private parseJsonLike(input: string): Record<string, unknown> {
    const sanitized = input
      .replace(/^```json\s*/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      return JSON.parse(sanitized) as Record<string, unknown>;
    } catch {
      this.logger.error(
        `[LLM] Invalid JSON payload — rawPreview=${this.truncate(sanitized, 500)}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PROVIDER_ERROR',
        message: 'Ollama did not return valid JSON',
      });
    }
  }

  private normalizeOutput(
    payload: Record<string, unknown>,
    userInput: string,
  ): TutorLlmResponse {
    const tutorText =
      typeof payload.tutor_text === 'string' && payload.tutor_text.trim()
        ? payload.tutor_text.trim()
        : 'Great effort. Let us continue practicing with a clearer sentence.';

    const emotionState =
      typeof payload.emotion_state === 'string' &&
      EMOTION_STATES.includes(
        payload.emotion_state as (typeof EMOTION_STATES)[number],
      )
        ? payload.emotion_state
        : 'ENCOURAGING';

    const animationState =
      typeof payload.animation_state === 'string' &&
      ANIMATION_STATES.includes(
        payload.animation_state as (typeof ANIMATION_STATES)[number],
      )
        ? payload.animation_state
        : 'GESTURE_EXPLAIN';

    const correctionPayload =
      typeof payload.correction === 'object' && payload.correction
        ? (payload.correction as Record<string, unknown>)
        : null;

    const correctedVersion =
      typeof correctionPayload?.corrected_version === 'string'
        ? correctionPayload.corrected_version
        : userInput;

    const shortReason =
      typeof correctionPayload?.short_reason === 'string'
        ? correctionPayload.short_reason
        : 'Keep speaking and refining your sentence structure.';

    return {
      tutorText,
      emotionState,
      animationState,
      correction: {
        hasError: Boolean(correctionPayload?.has_error),
        correctedVersion,
        shortReason,
      },
    };
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}...(truncated)`;
  }
}

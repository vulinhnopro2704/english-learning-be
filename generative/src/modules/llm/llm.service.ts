import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';
import type { GenerateTutorResponseInput, TutorLlmResponse } from './llm.types';

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
  constructor(private readonly configService: ConfigService) {}

  async generateTutorResponse(
    input: GenerateTutorResponseInput,
  ): Promise<TutorLlmResponse> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'LLM_PROVIDER_ERROR',
        message: 'Gemini API key is not configured',
      });
    }

    const model =
      this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: this.buildPrompt(input) }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.5,
        },
      }),
    });

    if (!response.ok) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PROVIDER_ERROR',
        message: `Gemini request failed with status ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawText =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() ?? '';

    if (!rawText) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PROVIDER_ERROR',
        message: 'Gemini returned an empty response',
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
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PROVIDER_ERROR',
        message: 'Gemini did not return valid JSON',
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
}

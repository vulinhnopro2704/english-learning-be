import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { createHash, randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import {
  buildTutorIdempotencyKey,
  buildTutorSessionKey,
  buildTutorSttCacheKey,
  TUTOR_IDEMPOTENCY_TTL_SECONDS,
  TUTOR_SESSION_TTL_SECONDS,
  TUTOR_STT_CACHE_TTL_SECONDS,
  TUTOR_TURNS_LIMIT,
} from './constants';
import { CreateTutorSessionDto } from './dtos/create-tutor-session.dto';
import { InteractTutorSessionDto } from './dtos/interact-tutor-session.dto';
import { InteractVoiceTutorSessionDto } from './dtos/interact-voice-tutor-session.dto';
import {
  EndTutorSessionResponseDto,
  InterruptTutorSessionResponseDto,
  TutorInteractionResponseDto,
  TutorSessionResponseDto,
} from './dtos/tutor-session-response.dto';
import { LlmService } from '../llm/llm.service';
import { TtsService } from '../tts/tts.service';
import type { TutorLlmResponse } from '../llm/llm.types';
import { SttService } from '../stt/stt.service';
import { AvatarBehaviorService } from './avatar-behavior.service';

interface TutorTurnState {
  turnId: string;
  userInput: string;
  tutorText: string;
  createdAt: string;
  emotionState: string;
  animationState: string;
}

interface TutorSessionState {
  sessionId: string;
  state: 'ACTIVE' | 'LISTENING' | 'COMPLETED';
  tutorProfile: {
    cefrLevel: string;
    focusTopics: string[];
    voiceId?: string;
  };
  createdAt: string;
  endedAt?: string;
  turns: TutorTurnState[];
}

@Injectable()
export class TutorSessionsService {
  private readonly logger = new Logger(TutorSessionsService.name);
  constructor(
    private readonly redisService: RedisService,
    private readonly llmService: LlmService,
    private readonly ttsService: TtsService,
    private readonly sttService: SttService,
    private readonly avatarBehaviorService: AvatarBehaviorService,
  ) {}

  async createSession(
    dto: CreateTutorSessionDto,
  ): Promise<TutorSessionResponseDto> {
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const sessionState: TutorSessionState = {
      sessionId,
      state: 'ACTIVE',
      tutorProfile: {
        cefrLevel: dto.cefrLevel,
        focusTopics: dto.focusTopics ?? [],
        ...(dto.voiceId ? { voiceId: dto.voiceId } : {}),
      },
      createdAt: now,
      turns: [],
    };

    await this.redisService.setJson(
      buildTutorSessionKey(sessionId),
      sessionState,
      TUTOR_SESSION_TTL_SECONDS,
    );

    return this.toSessionResponse(sessionState);
  }

  async getSession(sessionId: string): Promise<TutorSessionResponseDto> {
    const session = await this.requireSession(sessionId);
    return this.toSessionResponse(session);
  }

  async interact(
    sessionId: string,
    dto: InteractTutorSessionDto,
  ): Promise<TutorInteractionResponseDto> {
    const session = await this.requireSession(sessionId);

    if (session.state === 'COMPLETED') {
      throw new ApiException({
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'SESSION_EXPIRED',
        message: 'This tutor session has already ended',
      });
    }

    if (dto.clientTurnId) {
      const idempotencyKey = buildTutorIdempotencyKey(
        sessionId,
        dto.clientTurnId,
      );
      const cachedResponse =
        await this.redisService.getJson<TutorInteractionResponseDto>(
          idempotencyKey,
        );
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const turnId = randomUUID();
    const now = new Date().toISOString();

    const llmResponse = await this.buildTutorResponse(session, dto.userInput);
    const audio = await this.buildAudioResponse(
      llmResponse.tutorText,
      session.tutorProfile.voiceId,
    );
    const audioWithAttribution = {
      ...audio,
      source: 'Voice by elevenlabs.io',
    };

    const avatarBehavior = this.avatarBehaviorService.createAvatarBehavior({
      emotionState: llmResponse.emotionState,
      animationState: llmResponse.animationState,
    });

    const interaction: TutorInteractionResponseDto = {
      turnId,
      sessionId,
      tutorText: llmResponse.tutorText,
      emotionState: llmResponse.emotionState,
      animationState: llmResponse.animationState,
      facialExpression: avatarBehavior.facialExpression,
      animation: avatarBehavior.animation,
      correction: llmResponse.correction,
      audio: audioWithAttribution,
      createdAt: now,
    };

    session.turns.push({
      turnId,
      userInput: dto.userInput,
      tutorText: llmResponse.tutorText,
      createdAt: now,
      emotionState: interaction.emotionState,
      animationState: interaction.animationState,
    });

    if (session.turns.length > TUTOR_TURNS_LIMIT) {
      session.turns = session.turns.slice(-TUTOR_TURNS_LIMIT);
    }

    session.state = 'ACTIVE';

    await this.redisService.setJson(
      buildTutorSessionKey(sessionId),
      session,
      TUTOR_SESSION_TTL_SECONDS,
    );

    if (dto.clientTurnId) {
      const idempotencyKey = buildTutorIdempotencyKey(
        sessionId,
        dto.clientTurnId,
      );
      await this.redisService.setJson(
        idempotencyKey,
        interaction,
        TUTOR_IDEMPOTENCY_TTL_SECONDS,
      );
    }

    return interaction;
  }

  async interactVoice(
    sessionId: string,
    dto: InteractVoiceTutorSessionDto,
  ): Promise<TutorInteractionResponseDto> {
    const transcript = await this.getOrCreateTranscript(dto);

    const interaction = await this.interact(sessionId, {
      userInput: transcript.text,
      inputMode: 'text',
      clientTurnId: dto.clientTurnId,
    });

    return {
      ...interaction,
      transcript: {
        text: transcript.text,
        confidence: transcript.confidence,
        provider: 'elevenlabs',
      },
    };
  }

  async interrupt(
    sessionId: string,
  ): Promise<InterruptTutorSessionResponseDto> {
    const session = await this.requireSession(sessionId);

    if (session.state === 'COMPLETED') {
      throw new ApiException({
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'INTERRUPT_CONFLICT',
        message: 'Cannot interrupt a completed session',
      });
    }

    session.state = 'LISTENING';

    await this.redisService.setJson(
      buildTutorSessionKey(sessionId),
      session,
      TUTOR_SESSION_TTL_SECONDS,
    );

    const lastTurn = session.turns.at(-1);
    return {
      sessionId,
      interruptedTurnId: lastTurn?.turnId,
      state: session.state,
    };
  }

  async endSession(sessionId: string): Promise<EndTutorSessionResponseDto> {
    const session = await this.requireSession(sessionId);
    const endedAt = new Date().toISOString();

    session.state = 'COMPLETED';
    session.endedAt = endedAt;

    await this.redisService.setJson(
      buildTutorSessionKey(sessionId),
      session,
      TUTOR_SESSION_TTL_SECONDS,
    );

    return {
      sessionId,
      state: session.state,
      endedAt,
      summary:
        'Session ended successfully. Next step: continue speaking practice with one new verb pattern.',
    };
  }

  private async requireSession(sessionId: string): Promise<TutorSessionState> {
    const session = await this.redisService.getJson<TutorSessionState>(
      buildTutorSessionKey(sessionId),
    );

    if (!session) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'INVALID_SESSION',
        message: 'Tutor session was not found or already expired',
      });
    }

    return session;
  }

  private toSessionResponse(
    session: TutorSessionState,
  ): TutorSessionResponseDto {
    return {
      sessionId: session.sessionId,
      state: session.state,
      tutorProfile: session.tutorProfile,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      turnsCount: session.turns.length,
    };
  }

  private async buildTutorResponse(
    session: TutorSessionState,
    userInput: string,
  ): Promise<TutorLlmResponse> {
    return this.llmService.generateTutorResponse({
      userInput,
      cefrLevel: session.tutorProfile.cefrLevel,
      focusTopics: session.tutorProfile.focusTopics,
      recentTurns: session.turns.slice(-4).map((turn) => ({
        userInput: turn.userInput,
        tutorText: turn.tutorText,
      })),
    });
  }

  private async buildAudioResponse(tutorText: string, voiceId?: string) {
    return this.ttsService.synthesize(tutorText, voiceId);
  }

  private async getOrCreateTranscript(dto: InteractVoiceTutorSessionDto) {
    const fingerprintSource: string = dto.audioBase64 ?? dto.audioUrl ?? '';
    if (!fingerprintSource) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'BAD_REQUEST',
        message:
          'Either audioBase64 or audioUrl is required for interact-voice',
      });
    }

    const fingerprint = createHash('sha256')
      .update(fingerprintSource)
      .digest('hex');
    const cacheKey: string = buildTutorSttCacheKey(fingerprint);

    const cached = await this.redisService.getJson<{
      text: string;
      confidence: number | null;
    }>(cacheKey);
    if (cached?.text) {
      return cached;
    }

    const transcript = await this.sttService.transcribe({
      audioBase64: dto.audioBase64,
      audioUrl: dto.audioUrl,
      mimeType: dto.mimeType,
      languageCode: dto.languageCode,
    });

    const ttlSeconds = Number(TUTOR_STT_CACHE_TTL_SECONDS);
    await this.redisService.setJson(cacheKey, transcript, ttlSeconds);
    return transcript;
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedEntityResponse,
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { CreateTutorSessionDto } from './dtos/create-tutor-session.dto';
import { InteractTutorSessionDto } from './dtos/interact-tutor-session.dto';
import { InteractVoiceTutorSessionDto } from './dtos/interact-voice-tutor-session.dto';
import {
  EndTutorSessionResponseDto,
  InterruptTutorSessionResponseDto,
  TutorInteractionResponseDto,
  TutorSessionResponseDto,
} from './dtos/tutor-session-response.dto';
import { TutorSessionsService } from './tutor-sessions.service';

const badRequestExample = {
  statusCode: 400,
  errorCode: 'BAD_REQUEST',
  message: 'Either audioBase64 or audioUrl is required for interact-voice',
};

const notFoundExample = {
  statusCode: 404,
  errorCode: 'INVALID_SESSION',
  message: 'Tutor session was not found or already expired',
};

const conflictExample = {
  statusCode: 409,
  errorCode: 'SESSION_EXPIRED',
  message: 'This tutor session has already ended',
};

const providerBadGatewayExample = {
  statusCode: 502,
  errorCode: 'TTS_PROVIDER_ERROR',
  message: 'ElevenLabs request failed with status 503',
};

const serviceUnavailableExample = {
  statusCode: 503,
  errorCode: 'LLM_PROVIDER_ERROR',
  message: 'Gemini API key is not configured',
};

const rateLimitedExample = {
  statusCode: 429,
  errorCode: 'RATE_LIMITED',
  message: 'Too many requests, please retry later',
};

const sessionCreatedExample = {
  sessionId: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
  state: 'ACTIVE',
  tutorProfile: {
    cefrLevel: 'A2',
    focusTopics: ['daily_conversation', 'pronunciation'],
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
  },
  createdAt: '2026-04-12T10:32:10.012Z',
  turnsCount: 0,
};

const textInteractionExample = {
  turnId: '9a3d0f93-01bc-4e7b-ac0f-0179b9f40ca6',
  sessionId: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
  tutorText: 'Great effort. A better sentence is: I went to school yesterday.',
  emotionState: 'CORRECTIVE_SOFT',
  animationState: 'GESTURE_EXPLAIN',
  facialExpression: 'concerned',
  animation: 'Talking_1',
  lipSync: {
    mouthCues: [
      { start: 0, end: 0.16, value: 'A' },
      { start: 0.16, end: 0.32, value: 'E' },
    ],
  },
  correction: {
    hasError: true,
    correctedVersion: 'I went to school yesterday.',
    shortReason: 'Use past tense of go as went.',
  },
  audio: {
    url: 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAAD...',
    mimeType: 'audio/mpeg',
    provider: 'elevenlabs',
    status: 'completed',
  },
  createdAt: '2026-04-12T10:35:58.202Z',
};

const voiceInteractionExample = {
  ...textInteractionExample,
  transcript: {
    text: 'I goed to school yesterday',
    confidence: 0.98,
    provider: 'elevenlabs',
  },
};

const interruptExample = {
  sessionId: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
  interruptedTurnId: '9a3d0f93-01bc-4e7b-ac0f-0179b9f40ca6',
  state: 'LISTENING',
};

const endSessionExample = {
  sessionId: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
  state: 'COMPLETED',
  endedAt: '2026-04-12T11:10:55.501Z',
  summary:
    'You practiced past tense well. Next session, focus on pronunciation of irregular verbs.',
};

@ApiTags('tutor-sessions')
@ApiBearerAuth()
@Controller('tutor/sessions')
export class TutorSessionsController {
  constructor(private readonly tutorSessionsService: TutorSessionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new 3D AI tutor session',
    description:
      'Initializes a tutor session with learner CEFR profile, optional focus topics, and optional ElevenLabs voice id. Returns session metadata used by subsequent interaction endpoints.',
  })
  @ApiBody({
    type: CreateTutorSessionDto,
    description: 'Session bootstrap payload.',
    examples: {
      basic: {
        summary: 'Basic session',
        value: {
          cefrLevel: 'A2',
          focusTopics: ['daily_conversation', 'pronunciation'],
        },
      },
      customVoice: {
        summary: 'Session with custom ElevenLabs voice',
        value: {
          cefrLevel: 'B1',
          focusTopics: ['job_interview', 'grammar_drills'],
          voiceId: 'EXAVITQu4vr4xnSDxMaL',
        },
      },
    },
  })
  @ApiCreatedEntityResponse({
    type: TutorSessionResponseDto,
    description: 'Tutor session created successfully.',
  })
  @ApiResponse({
    status: 201,
    description: 'Successful create-session response example.',
    content: {
      'application/json': {
        example: sessionCreatedExample,
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [400, 422, 500] })
  @ApiUnprocessableEntityResponse({
    description: 'Validation failure for request payload.',
  })
  createSession(@Body() dto: CreateTutorSessionDto) {
    return this.tutorSessionsService.createSession(dto);
  }

  @Get(':sessionId')
  @ApiOperation({
    summary: 'Get tutor session metadata and state',
    description:
      'Returns lifecycle state, tutor profile, and interaction count for an existing tutor session.',
  })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: TutorSessionResponseDto,
    description: 'Tutor session details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful get-session response example.',
    content: {
      'application/json': {
        example: {
          ...sessionCreatedExample,
          turnsCount: 3,
        },
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [404, 422, 500] })
  @ApiNotFoundResponse({
    description: 'Session does not exist or has expired.',
    example: notFoundExample,
  })
  getSession(@Param('sessionId') sessionId: string) {
    return this.tutorSessionsService.getSession(sessionId);
  }

  @Post(':sessionId/interact')
  @ApiOperation({
    summary: 'Process a text interaction turn for the tutor session',
    description:
      'Consumes one learner text turn, generates tutor pedagogical reply with correction signal, avatar behavior, and synthesized speech output.',
  })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiBody({
    type: InteractTutorSessionDto,
    description: 'Text turn payload for tutor interaction.',
    examples: {
      grammarCorrection: {
        summary: 'Grammar correction turn',
        value: {
          userInput: 'I goed to school yesterday, is it correct?',
          inputMode: 'text',
          clientTurnId: 'turn-client-20260412-001',
        },
      },
      casualConversation: {
        summary: 'Normal practice turn',
        value: {
          userInput: 'I usually study English before going to bed.',
          inputMode: 'text',
        },
      },
    },
  })
  @ApiOkEntityResponse({
    type: TutorInteractionResponseDto,
    description: 'Tutor interaction response for text input.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful text interaction response example.',
    content: {
      'application/json': {
        example: textInteractionExample,
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [404, 409, 422, 429, 500] })
  @ApiNotFoundResponse({
    description: 'Session does not exist or has expired.',
    example: notFoundExample,
  })
  @ApiConflictResponse({
    description: 'Session already completed.',
    example: conflictExample,
  })
  @ApiTooManyRequestsResponse({
    description: 'Endpoint-level or global rate limit exceeded.',
    example: rateLimitedExample,
  })
  @ApiBadGatewayResponse({
    description: 'Upstream LLM/TTS/STT provider failed.',
    example: providerBadGatewayExample,
  })
  @ApiServiceUnavailableResponse({
    description: 'Provider credentials/configuration unavailable.',
    example: serviceUnavailableExample,
  })
  interact(
    @Param('sessionId') sessionId: string,
    @Body() dto: InteractTutorSessionDto,
  ) {
    return this.tutorSessionsService.interact(sessionId, dto);
  }

  @Post(':sessionId/interact-voice')
  @ApiOperation({
    summary: 'Process a voice interaction turn for the tutor session',
    description:
      'Accepts learner voice input from base64 payload or public audio URL, performs STT, then routes transcript through tutor generation and TTS response pipeline.',
  })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiBody({
    type: InteractVoiceTutorSessionDto,
    description: 'Voice turn payload. Provide audioBase64 or audioUrl.',
    examples: {
      base64Audio: {
        summary: 'Base64 audio payload',
        value: {
          audioBase64: 'GkXfo59ChoEBQveBAULygQRC84EIQo...',
          mimeType: 'audio/webm',
          languageCode: 'eng',
          clientTurnId: 'turn-client-20260412-voice-001',
        },
      },
      remoteAudio: {
        summary: 'Remote audio URL payload',
        value: {
          audioUrl: 'https://cdn.example.com/uploads/voice-turn-001.webm',
          mimeType: 'audio/webm',
          languageCode: 'eng',
        },
      },
    },
  })
  @ApiOkEntityResponse({
    type: TutorInteractionResponseDto,
    description:
      'Tutor interaction response derived from voice input, including transcript metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful voice interaction response example.',
    content: {
      'application/json': {
        example: voiceInteractionExample,
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [400, 404, 409, 422, 429, 500] })
  @ApiBadRequestResponse({
    description: 'Voice input payload is missing or invalid.',
    example: badRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Session does not exist or has expired.',
    example: notFoundExample,
  })
  @ApiConflictResponse({
    description: 'Session already completed.',
    example: conflictExample,
  })
  @ApiTooManyRequestsResponse({
    description: 'Endpoint-level or global rate limit exceeded.',
    example: rateLimitedExample,
  })
  @ApiBadGatewayResponse({
    description: 'Upstream STT/LLM/TTS provider failed.',
    example: providerBadGatewayExample,
  })
  @ApiServiceUnavailableResponse({
    description: 'Provider credentials/configuration unavailable.',
    example: serviceUnavailableExample,
  })
  interactVoice(
    @Param('sessionId') sessionId: string,
    @Body() dto: InteractVoiceTutorSessionDto,
  ) {
    return this.tutorSessionsService.interactVoice(sessionId, dto);
  }

  @Post(':sessionId/interrupt')
  @ApiOperation({
    summary: 'Interrupt current tutor speaking turn',
    description:
      'Marks session as LISTENING and returns the interrupted turn id when available. Useful for push-to-talk or barge-in behavior.',
  })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: InterruptTutorSessionResponseDto,
    description: 'Tutor session interruption state.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful interrupt response example.',
    content: {
      'application/json': {
        example: interruptExample,
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [404, 409, 500] })
  @ApiNotFoundResponse({
    description: 'Session does not exist or has expired.',
    example: notFoundExample,
  })
  @ApiConflictResponse({
    description: 'Interrupt is not allowed for completed session.',
    example: {
      statusCode: 409,
      errorCode: 'INTERRUPT_CONFLICT',
      message: 'Cannot interrupt a completed session',
    },
  })
  interrupt(@Param('sessionId') sessionId: string) {
    return this.tutorSessionsService.interrupt(sessionId);
  }

  @Post(':sessionId/end')
  @ApiOperation({
    summary: 'End tutor session and return summary',
    description:
      'Completes an active session and returns final pedagogical summary for next learning step.',
  })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: EndTutorSessionResponseDto,
    description: 'Tutor session end summary.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful end-session response example.',
    content: {
      'application/json': {
        example: endSessionExample,
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [404, 409, 500] })
  @ApiNotFoundResponse({
    description: 'Session does not exist or has expired.',
    example: notFoundExample,
  })
  @ApiConflictResponse({
    description: 'Session already ended or transition is invalid.',
    example: conflictExample,
  })
  endSession(@Param('sessionId') sessionId: string) {
    return this.tutorSessionsService.endSession(sessionId);
  }
}

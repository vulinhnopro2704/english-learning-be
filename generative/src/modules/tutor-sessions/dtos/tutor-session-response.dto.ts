import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TutorProfileDto {
  @ApiProperty({ example: 'A2' })
  cefrLevel!: string;

  @ApiProperty({
    example: ['daily_conversation', 'pronunciation'],
    type: [String],
  })
  focusTopics!: string[];

  @ApiPropertyOptional({ example: 'EXAVITQu4vr4xnSDxMaL' })
  voiceId?: string;
}

export class TutorSessionResponseDto {
  @ApiProperty({ example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9' })
  sessionId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  state!: string;

  @ApiProperty({ type: TutorProfileDto })
  tutorProfile!: TutorProfileDto;

  @ApiProperty({ example: '2026-04-12T10:32:10.012Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-04-12T11:10:55.501Z' })
  endedAt?: string;

  @ApiProperty({ example: 3 })
  turnsCount!: number;
}

export class TutorAudioResponseDto {
  @ApiPropertyOptional({ example: null, nullable: true })
  url!: string | null;

  @ApiProperty({ example: 'audio/mpeg' })
  mimeType!: string;

  @ApiProperty({ example: 'elevenlabs' })
  provider!: string;

  @ApiProperty({ example: 'pending' })
  status!: string;
}

export class TutorCorrectionResponseDto {
  @ApiProperty({ example: true })
  hasError!: boolean;

  @ApiPropertyOptional({ example: 'I went to school yesterday.' })
  correctedVersion?: string;

  @ApiPropertyOptional({ example: 'Use past tense of go as went.' })
  shortReason?: string;
}

export class TutorLipSyncCueDto {
  @ApiProperty({ example: 0 })
  start!: number;

  @ApiProperty({ example: 0.18 })
  end!: number;

  @ApiProperty({ example: 'A' })
  value!: string;
}

export class TutorLipSyncResponseDto {
  @ApiProperty({ type: [TutorLipSyncCueDto] })
  mouthCues!: TutorLipSyncCueDto[];
}

export class TutorInteractionResponseDto {
  @ApiProperty({ example: '9a3d0f93-01bc-4e7b-ac0f-0179b9f40ca6' })
  turnId!: string;

  @ApiProperty({ example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9' })
  sessionId!: string;

  @ApiProperty({
    example: 'Great effort! A better sentence is: I went to school yesterday.',
  })
  tutorText!: string;

  @ApiProperty({ example: 'ENCOURAGING' })
  emotionState!: string;

  @ApiProperty({ example: 'GESTURE_EXPLAIN' })
  animationState!: string;

  @ApiProperty({ example: 'smile' })
  facialExpression!: string;

  @ApiProperty({ example: 'Talking' })
  animation!: string;

  @ApiProperty({ type: TutorLipSyncResponseDto })
  lipSync!: TutorLipSyncResponseDto;

  @ApiProperty({ type: TutorCorrectionResponseDto })
  correction!: TutorCorrectionResponseDto;

  @ApiProperty({ type: TutorAudioResponseDto })
  audio!: TutorAudioResponseDto;

  @ApiPropertyOptional({
    example: {
      text: 'I went to school yesterday.',
      confidence: 0.98,
      provider: 'elevenlabs',
    },
  })
  transcript?: {
    text: string;
    confidence: number | null;
    provider: string;
  };

  @ApiProperty({ example: '2026-04-12T10:35:58.202Z' })
  createdAt!: string;
}

export class InterruptTutorSessionResponseDto {
  @ApiProperty({ example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9' })
  sessionId!: string;

  @ApiPropertyOptional({ example: '9a3d0f93-01bc-4e7b-ac0f-0179b9f40ca6' })
  interruptedTurnId?: string;

  @ApiProperty({ example: 'LISTENING' })
  state!: string;
}

export class EndTutorSessionResponseDto {
  @ApiProperty({ example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9' })
  sessionId!: string;

  @ApiProperty({ example: 'COMPLETED' })
  state!: string;

  @ApiProperty({ example: '2026-04-12T11:10:55.501Z' })
  endedAt!: string;

  @ApiProperty({
    example:
      'You practiced past tense well. Next session, focus on pronunciation of irregular verbs.',
  })
  summary!: string;
}

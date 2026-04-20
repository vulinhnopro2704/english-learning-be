import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TUTOR_SESSION_STATES = ['ACTIVE', 'LISTENING', 'COMPLETED'] as const;
const AUDIO_STATUSES = ['completed', 'skipped', 'failed'] as const;

export class TutorTranscriptResponseDto {
  @ApiProperty({
    example: 'I went to school yesterday.',
    description: 'Transcribed learner utterance from the voice endpoint.',
  })
  text!: string;

  @ApiPropertyOptional({
    example: 0.98,
    nullable: true,
    description:
      'Provider confidence value when available. Null means confidence is not provided by provider.',
  })
  confidence!: number | null;

  @ApiProperty({
    example: 'elevenlabs',
    description: 'Provider that produced transcript text.',
  })
  provider!: string;
}

export class TutorProfileDto {
  @ApiProperty({
    example: 'A2',
    description: 'Learner CEFR level attached to session profile.',
  })
  cefrLevel!: string;

  @ApiProperty({
    example: ['daily_conversation', 'pronunciation'],
    type: [String],
    description: 'Session topics used to steer tutor responses.',
  })
  focusTopics!: string[];

  @ApiPropertyOptional({
    example: 'EXAVITQu4vr4xnSDxMaL',
    description: 'Optional ElevenLabs voice id selected by client.',
  })
  voiceId?: string;
}

export class TutorSessionResponseDto {
  @ApiProperty({
    example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
    description: 'Server-generated unique tutor session id.',
  })
  sessionId!: string;

  @ApiProperty({
    example: 'ACTIVE',
    enum: TUTOR_SESSION_STATES,
    description: 'Current lifecycle state of tutor session.',
  })
  state!: string;

  @ApiProperty({
    type: TutorProfileDto,
    description: 'Static tutoring profile selected when creating session.',
  })
  tutorProfile!: TutorProfileDto;

  @ApiProperty({
    example: '2026-04-12T10:32:10.012Z',
    description: 'Session creation timestamp in ISO-8601 format.',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    example: '2026-04-12T11:10:55.501Z',
    description: 'Session end timestamp in ISO-8601 format when completed.',
  })
  endedAt?: string;

  @ApiProperty({
    example: 3,
    description: 'Number of interaction turns currently retained in session.',
  })
  turnsCount!: number;
}

export class TutorAudioResponseDto {
  @ApiPropertyOptional({
    example:
      'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMAAAAAAAAAAAAAAA',
    nullable: true,
    description:
      'Inline audio payload as data URL. Null when audio is skipped or generation fails.',
  })
  url!: string | null;

  @ApiProperty({
    example: 'audio/mpeg',
    description: 'MIME type of generated tutor audio.',
  })
  mimeType!: string;

  @ApiProperty({
    example: 'elevenlabs',
    description: 'Audio provider name.',
  })
  provider!: string;

  @ApiProperty({
    example: 'completed',
    enum: AUDIO_STATUSES,
    description:
      'Audio generation status. completed: audio available, skipped: feature disabled/config missing, failed: provider error.',
  })
  status!: string;
}

export class TutorCorrectionResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether learner input contains an identified language issue.',
  })
  hasError!: boolean;

  @ApiPropertyOptional({
    example: 'I went to school yesterday.',
    description: 'Suggested corrected sentence.',
  })
  correctedVersion?: string;

  @ApiPropertyOptional({
    example: 'Use past tense of go as went.',
    description: 'Short pedagogical explanation for the correction.',
  })
  shortReason?: string;
}

export class TutorLipSyncCueDto {
  @ApiProperty({
    example: 0,
    description: 'Cue start time in seconds from audio start.',
  })
  start!: number;

  @ApiProperty({
    example: 0.18,
    description: 'Cue end time in seconds from audio start.',
  })
  end!: number;

  @ApiProperty({
    example: 'A',
    description: 'Simplified viseme label used by avatar lip-sync layer.',
  })
  value!: string;
}

export class TutorLipSyncResponseDto {
  @ApiProperty({
    type: [TutorLipSyncCueDto],
    description: 'Sequence of viseme cues for avatar mouth animation.',
  })
  mouthCues!: TutorLipSyncCueDto[];
}

export class TutorInteractionResponseDto {
  @ApiProperty({
    example: '9a3d0f93-01bc-4e7b-ac0f-0179b9f40ca6',
    description: 'Server-generated unique turn id.',
  })
  turnId!: string;

  @ApiProperty({
    example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
    description: 'Tutor session id that this turn belongs to.',
  })
  sessionId!: string;

  @ApiProperty({
    example: 'Great effort! A better sentence is: I went to school yesterday.',
    description: 'Primary tutor response text.',
  })
  tutorText!: string;

  @ApiProperty({
    example: 'ENCOURAGING',
    description: 'Emotion hint for avatar rendering.',
  })
  emotionState!: string;

  @ApiProperty({
    example: 'GESTURE_EXPLAIN',
    description: 'Animation hint for avatar rendering.',
  })
  animationState!: string;

  @ApiProperty({
    example: 'smile',
    description: 'Resolved facial expression value for client avatar system.',
  })
  facialExpression!: string;

  @ApiProperty({
    example: 'Talking',
    description: 'Resolved body animation value for client avatar system.',
  })
  animation!: string;

  @ApiProperty({
    type: TutorLipSyncResponseDto,
    description: 'Lip-sync instruction payload derived from tutor text.',
  })
  lipSync!: TutorLipSyncResponseDto;

  @ApiProperty({
    type: TutorCorrectionResponseDto,
    description: 'Grammar correction signal and explanation.',
  })
  correction!: TutorCorrectionResponseDto;

  @ApiProperty({
    type: TutorAudioResponseDto,
    description: 'Speech synthesis output metadata and data URL.',
  })
  audio!: TutorAudioResponseDto;

  @ApiPropertyOptional({
    type: TutorTranscriptResponseDto,
    description:
      'Transcript metadata included for voice interactions. Omitted for text interactions.',
  })
  transcript?: TutorTranscriptResponseDto;

  @ApiProperty({
    example: '2026-04-12T10:35:58.202Z',
    description: 'Turn creation timestamp in ISO-8601 format.',
  })
  createdAt!: string;
}

export class InterruptTutorSessionResponseDto {
  @ApiProperty({
    example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
    description: 'Tutor session id.',
  })
  sessionId!: string;

  @ApiPropertyOptional({
    example: '9a3d0f93-01bc-4e7b-ac0f-0179b9f40ca6',
    description: 'Last turn id that got interrupted, if available.',
  })
  interruptedTurnId?: string;

  @ApiProperty({
    example: 'LISTENING',
    enum: TUTOR_SESSION_STATES,
    description: 'Updated session state after interrupt request.',
  })
  state!: string;
}

export class EndTutorSessionResponseDto {
  @ApiProperty({
    example: '8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9',
    description: 'Tutor session id.',
  })
  sessionId!: string;

  @ApiProperty({
    example: 'COMPLETED',
    enum: TUTOR_SESSION_STATES,
    description: 'Final state after ending session.',
  })
  state!: string;

  @ApiProperty({
    example: '2026-04-12T11:10:55.501Z',
    description: 'Session end timestamp in ISO-8601 format.',
  })
  endedAt!: string;

  @ApiProperty({
    example:
      'You practiced past tense well. Next session, focus on pronunciation of irregular verbs.',
    description: 'Short pedagogical summary for the completed session.',
  })
  summary!: string;
}

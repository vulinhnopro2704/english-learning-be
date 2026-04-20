import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export class CreateTutorSessionDto {
  @ApiProperty({
    example: 'A2',
    enum: CEFR_LEVELS,
    description:
      'Learner CEFR level used to adapt tutoring complexity and feedback style.',
  })
  @IsString()
  @IsIn(CEFR_LEVELS)
  cefrLevel!: (typeof CEFR_LEVELS)[number];

  @ApiPropertyOptional({
    example: ['daily_conversation', 'pronunciation'],
    type: [String],
    description:
      'Learning topics to guide tutor responses. Keep concise and practical for speaking sessions.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(48, { each: true })
  focusTopics?: string[];

  @ApiPropertyOptional({
    example: 'EXAVITQu4vr4xnSDxMaL',
    description:
      'Optional ElevenLabs voice id. If omitted, service default voice is used.',
  })
  @IsOptional()
  @IsString()
  @Length(8, 64)
  voiceId?: string;
}

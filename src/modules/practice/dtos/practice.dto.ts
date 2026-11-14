import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── FSRS Review Item ────────────────────────────────────────────────────────

export class FSRSReviewItemDto {
  @ApiProperty({ example: 42, description: 'Word ID' })
  @IsInt()
  wordId!: number;

  @ApiProperty({ example: true, description: 'Did user answer correctly?' })
  @IsBoolean()
  isCorrect!: boolean;

  @ApiProperty({
    example: 5500,
    description: 'Time spent answering (ms), required and must be > 0',
  })
  @IsInt()
  @Min(1)
  durationMs!: number;

  @ApiProperty({
    example: 'FLASHCARD',
    description:
      'Exercise type: FLASHCARD, MULTI_CHOICE, LISTEN_FILL, DICTATION, FLIP, MULTIPLE_CHOICE, FILL_BLANK, MEANING_LOOKUP, SPEED_CHALLENGE, WORD_PUZZLE, MATCHING_PAIRS, STREAK_CHALLENGE, PRONUNCIATION',
  })
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().replace(/-/g, '_') : value,
  )
  @IsIn([
    'FLASHCARD',
    'MULTI_CHOICE',
    'LISTEN_FILL',
    'DICTATION',
    'FLIP',
    'MULTIPLE_CHOICE',
    'FILL_BLANK',
    'MEANING_LOOKUP',
    'SPEED_CHALLENGE',
    'WORD_PUZZLE',
    'MATCHING_PAIRS',
    'STREAK_CHALLENGE',
    'PRONUNCIATION',
  ])
  exerciseType!: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Number of attempts for this word',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  attempts?: number = 1;
}

// ─── Submit FSRS Practice ────────────────────────────────────────────────────

export class SubmitFSRSPracticeDto {
  @ApiProperty({
    type: [FSRSReviewItemDto],
    description: 'Array of vocabulary review results',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FSRSReviewItemDto)
  items!: FSRSReviewItemDto[];
}

// ─── Practice History Filter ─────────────────────────────────────────────────

export class PracticeHistoryFilterDto {
  @ApiPropertyOptional({
    enum: ['FSRS', 'LEARN_LESSON'],
    description: 'Filter by practice type',
  })
  @IsOptional()
  @IsIn(['FSRS', 'LEARN_LESSON'])
  type?: string;

  @ApiPropertyOptional({
    enum: ['startedAt', 'completedAt'],
    default: 'startedAt',
  })
  @IsOptional()
  @IsIn(['startedAt', 'completedAt'])
  sortBy?: string = 'startedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

// ─── FSRS Due Filter ───────────────────────────────────────────────────────

export class FSRSDueFilterDto {
  @ApiPropertyOptional({ example: 200, minimum: 1, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : parseInt(value as string, 10),
  )
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

// ─── FSRS Risk Filter ───────────────────────────────────────────────────────

export class FSRSRiskFilterDto {
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? 20
      : parseInt(value as string, 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

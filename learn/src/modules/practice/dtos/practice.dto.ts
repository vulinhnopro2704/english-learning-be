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

  @ApiPropertyOptional({
    example: 5500,
    description: 'Time spent answering (ms)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number = 0;

  @ApiPropertyOptional({
    example: 'flashcard',
    description:
      'Exercise type: flashcard, multi_choice, listen_fill, dictation',
  })
  @IsOptional()
  @IsString()
  exerciseType?: string = 'flashcard';
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

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExerciseType {
  FLASHCARD = 'FLASHCARD',
  FLIP = 'FLIP',
  MULTI_CHOICE = 'MULTI_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  LISTEN_FILL = 'LISTEN_FILL',
  DICTATION = 'DICTATION',
  FILL_BLANK = 'FILL_BLANK',
  MEANING_LOOKUP = 'MEANING_LOOKUP',
  SPEED_CHALLENGE = 'SPEED_CHALLENGE',
  WORD_PUZZLE = 'WORD_PUZZLE',
  MATCHING_PAIRS = 'MATCHING_PAIRS',
  STREAK_CHALLENGE = 'STREAK_CHALLENGE',
  PRONUNCIATION = 'PRONUNCIATION',
}

export class ReviewRequestDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 42 })
  @IsInt()
  @IsNotEmpty()
  wordId!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  isCorrect!: boolean;

  @ApiProperty({ example: 3450, description: 'Duration of answer in milliseconds' })
  @IsInt()
  @Min(1)
  durationMs!: number;

  @ApiProperty({ enum: ExerciseType, example: ExerciseType.FLASHCARD })
  @IsEnum(ExerciseType)
  exerciseType!: ExerciseType;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  attempts?: number = 1;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  hadWrong?: boolean = false;
}

export class BulkReviewItemDto {
  @ApiProperty({ example: 42 })
  @IsInt()
  @IsNotEmpty()
  wordId!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  isCorrect!: boolean;

  @ApiProperty({ example: 2500 })
  @IsInt()
  @Min(1)
  durationMs!: number;

  @ApiProperty({ enum: ExerciseType, example: ExerciseType.FLASHCARD })
  @IsEnum(ExerciseType)
  exerciseType!: ExerciseType;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  attempts?: number = 1;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  hadWrong?: boolean = false;
}

export class BulkReviewRequestDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ type: [BulkReviewItemDto] })
  @ValidateNested({ each: true })
  @Type(() => BulkReviewItemDto)
  items!: BulkReviewItemDto[];
}

export class InitCardsDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: [101, 102, 103], type: [Number] })
  @IsInt({ each: true })
  @IsNotEmpty()
  wordIds!: number[];
}

export class DueCardsFilterDto {
  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class RollbackModelDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  targetVersion?: number;
}

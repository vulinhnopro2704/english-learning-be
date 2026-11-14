import { IsInt, IsIn, IsOptional, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CourseProgressFilterDto {
  /** Filter by completion status */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isCompleted?: boolean;

  /** Sort field */
  @ApiPropertyOptional({
    enum: ['startedAt', 'lastAccessedAt'],
    default: 'lastAccessedAt',
  })
  @IsOptional()
  @IsIn(['startedAt', 'lastAccessedAt'])
  sortBy?: string = 'lastAccessedAt';

  /** Sort direction */
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  /** Cursor for pagination */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  cursor?: number;

  /** Number of items per page */
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

export class LessonProgressFilterDto {
  /** Filter by parent course */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  courseId?: number;

  /** Filter by status (e.g. 'completed', 'in_progress') */
  @ApiPropertyOptional({ example: 'completed' })
  @IsOptional()
  @IsString()
  status?: string;

  /** Sort field */
  @ApiPropertyOptional({
    enum: ['status', 'completedAt', 'score'],
    default: 'status',
  })
  @IsOptional()
  @IsIn(['status', 'completedAt', 'score'])
  sortBy?: string = 'status';

  /** Sort direction */
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  /** Cursor for pagination */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  cursor?: number;

  /** Number of items per page */
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

export class WordProgressFilterDto {
  /** Filter by status (e.g. 'new', 'learning', 'mastered') */
  @ApiPropertyOptional({ example: 'learning' })
  @IsOptional()
  @IsString()
  status?: string;

  /** Filter by CEFR level (e.g. A1, B2) */
  @ApiPropertyOptional({ example: 'A1' })
  @IsOptional()
  @IsString()
  cefr?: string;

  /** Search by word text */
  @ApiPropertyOptional({ example: 'hello' })
  @IsOptional()
  @IsString()
  search?: string;

  /** Sort field */
  @ApiPropertyOptional({
    enum: ['status', 'nextReview', 'lastReviewedAt', 'proficiency'],
    default: 'nextReview',
  })
  @IsOptional()
  @IsIn(['status', 'nextReview', 'lastReviewedAt', 'proficiency'])
  sortBy?: string = 'nextReview';

  /** Sort direction */
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  /** Cursor for pagination */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  cursor?: number;

  /** Number of items per page */
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

import { IsInt, IsIn, IsOptional, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CourseProgressFilterDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isCompleted?: boolean;

  @IsOptional()
  @IsIn(['startedAt', 'lastAccessedAt'])
  sortBy?: string = 'lastAccessedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  cursor?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

export class LessonProgressFilterDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  courseId?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(['status', 'completedAt', 'score'])
  sortBy?: string = 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  cursor?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

export class WordProgressFilterDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['status', 'nextReview', 'lastReviewedAt', 'proficiency'])
  sortBy?: string = 'nextReview';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  cursor?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

export class ReviewWordDto {
  @IsInt()
  wordId!: number;

  @IsIn(['correct', 'incorrect'])
  result!: 'correct' | 'incorrect';
}

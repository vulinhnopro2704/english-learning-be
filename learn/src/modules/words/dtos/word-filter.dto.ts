import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class WordFilterDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  lessonId?: number;

  @IsOptional()
  @IsString()
  cefr?: string;

  @IsOptional()
  @IsString()
  pos?: string;

  @IsOptional()
  @IsIn(['word', 'createdAt', 'cefr'])
  sortBy?: string = 'word';

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

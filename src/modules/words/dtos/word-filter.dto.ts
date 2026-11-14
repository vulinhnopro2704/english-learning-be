import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class WordFilterDto {
  /** Search by word text */
  @ApiPropertyOptional({ example: 'hello' })
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by parent lesson */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  lessonId?: number;

  /** Filter by CEFR level */
  @ApiPropertyOptional({ example: 'A1' })
  @IsOptional()
  @IsString()
  cefr?: string;

  /** Filter by part of speech */
  @ApiPropertyOptional({ example: 'noun' })
  @IsOptional()
  @IsString()
  pos?: string;

  /** Sort field */
  @ApiPropertyOptional({ enum: ['word', 'createdAt', 'cefr'], default: 'word' })
  @IsOptional()
  @IsIn(['word', 'createdAt', 'cefr'])
  sortBy?: string = 'word';

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

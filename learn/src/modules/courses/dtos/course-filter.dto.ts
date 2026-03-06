import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CourseFilterDto {
  /** Search by course title */
  @ApiPropertyOptional({ example: 'English basics' })
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by published status */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublished?: boolean;

  /** Sort field */
  @ApiPropertyOptional({
    enum: ['order', 'createdAt', 'title'],
    default: 'order',
  })
  @IsOptional()
  @IsIn(['order', 'createdAt', 'title'])
  sortBy?: string = 'order';

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

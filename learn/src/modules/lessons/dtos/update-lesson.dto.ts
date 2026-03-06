import {
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLessonDto {
  /** Lesson title */
  @ApiPropertyOptional({ example: 'Updated Lesson Title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /** Lesson description */
  @ApiPropertyOptional({ example: 'Updated lesson description' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Cover image URL */
  @ApiPropertyOptional({
    example: 'https://example.com/lesson.jpg',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  /** Display order */
  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** Whether the lesson is published */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** Parent course ID */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  courseId?: number;
}

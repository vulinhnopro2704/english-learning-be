import {
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLessonDto {
  /** Lesson title */
  @ApiProperty({ example: 'Greetings & Introductions', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title!: string;

  /** Lesson description */
  @ApiPropertyOptional({ example: 'Learn basic greetings in English' })
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
  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** Whether the lesson is published */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** Parent course ID */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  courseId?: number;
}

import {
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourseDto {
  /** Course title */
  @ApiProperty({ example: 'Tiếng Anh cơ bản', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title!: string;

  /** English title */
  @ApiPropertyOptional({ example: 'Basic English', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  enTitle?: string;

  /** Course description */
  @ApiPropertyOptional({ example: 'A beginner course for English learners' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Cover image URL */
  @ApiPropertyOptional({
    example: 'https://example.com/image.jpg',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  /** Course icon emoji */
  @ApiPropertyOptional({ example: '📚', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  /** Display order */
  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** Whether the course is published */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

import {
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCourseDto {
  /** Course title */
  @ApiPropertyOptional({ example: 'Tiếng Anh nâng cao', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /** English title */
  @ApiPropertyOptional({ example: 'Advanced English', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  enTitle?: string;

  /** Course description */
  @ApiPropertyOptional({ example: 'Updated course description' })
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
  @ApiPropertyOptional({ example: '🎓', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  /** Display order */
  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** Whether the course is published */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

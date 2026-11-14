import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExtractTranscriptDto {
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  @IsString()
  @IsNotEmpty()
  youtubeUrl!: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsString()
  @IsOptional()
  language?: string = 'en';
}

export class ProcessVideoDto {
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  @IsString()
  @IsNotEmpty()
  youtubeUrl!: string;

  @ApiPropertyOptional({ example: 'Learn English with Song' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Listening comprehension practice' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'medium', default: 'medium' })
  @IsString()
  @IsOptional()
  difficulty?: string = 'medium';

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean = true;
}

export class UpdateListeningLessonDto {
  @ApiPropertyOptional({ example: 'Updated Title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'hard' })
  @IsString()
  @IsOptional()
  difficulty?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  order?: number;
}

export class LessonFilterDto {
  @ApiPropertyOptional({ example: 'travel' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ example: 'medium' })
  @IsString()
  @IsOptional()
  difficulty?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

export class BlankItemDto {
  @ApiProperty({ example: 0 })
  index!: number;

  @ApiProperty({ example: 'listening' })
  originalWord!: string;

  @ApiProperty({ example: 'l________ (9 letters)' })
  hint!: string;
}

export class TranscriptSegmentDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 0.0 })
  start!: number;

  @ApiProperty({ example: 4.5 })
  end!: number;

  @ApiProperty({ example: 4.5 })
  duration!: number;

  @ApiProperty({ example: 'Hello and welcome to the English lesson' })
  text!: string;

  @ApiPropertyOptional({ example: 'Hello and _____ to the English lesson' })
  maskedText?: string;

  @ApiPropertyOptional({ type: [BlankItemDto] })
  blanks?: BlankItemDto[];
}

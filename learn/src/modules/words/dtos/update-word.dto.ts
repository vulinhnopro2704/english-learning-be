import { IsString, MaxLength, IsOptional, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWordDto {
  /** The word in English */
  @ApiPropertyOptional({ example: 'goodbye', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  word?: string;

  /** Pronunciation (IPA) */
  @ApiPropertyOptional({ example: '/ɡʊdˈbaɪ/', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pronunciation?: string;

  /** Vietnamese meaning */
  @ApiPropertyOptional({ example: 'Tạm biệt' })
  @IsOptional()
  @IsString()
  meaning?: string;

  /** Example sentence in English */
  @ApiPropertyOptional({ example: 'Goodbye, see you tomorrow!' })
  @IsOptional()
  @IsString()
  example?: string;

  /** Example sentence in Vietnamese */
  @ApiPropertyOptional({ example: 'Tạm biệt, hẹn gặp lại ngày mai!' })
  @IsOptional()
  @IsString()
  exampleVi?: string;

  /** Word image URL */
  @ApiPropertyOptional({
    example: 'https://example.com/goodbye.jpg',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  /** Audio pronunciation URL */
  @ApiPropertyOptional({
    example: 'https://example.com/goodbye.mp3',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  audio?: string;

  /** Part of speech */
  @ApiPropertyOptional({ example: 'interjection', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pos?: string;

  /** CEFR level */
  @ApiPropertyOptional({ example: 'A1', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cefr?: string;

  /** Parent lesson ID */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  lessonId?: number;
}

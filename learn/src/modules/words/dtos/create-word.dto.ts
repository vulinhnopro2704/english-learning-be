import { IsString, MaxLength, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWordDto {
  /** The word in English */
  @ApiProperty({ example: 'hello', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  word!: string;

  /** Pronunciation (IPA) */
  @ApiPropertyOptional({ example: '/həˈloʊ/', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pronunciation?: string;

  /** Vietnamese meaning */
  @ApiProperty({ example: 'Xin chào' })
  @IsString()
  meaning!: string;

  /** Example sentence in English */
  @ApiPropertyOptional({ example: 'Hello, how are you?' })
  @IsOptional()
  @IsString()
  example?: string;

  /** Example sentence in Vietnamese */
  @ApiPropertyOptional({ example: 'Xin chào, bạn khỏe không?' })
  @IsOptional()
  @IsString()
  exampleVi?: string;

  /** Word image URL */
  @ApiPropertyOptional({
    example: 'https://example.com/hello.jpg',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  /** Audio pronunciation URL */
  @ApiPropertyOptional({
    example: 'https://example.com/hello.mp3',
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
  @ApiProperty({ example: 1 })
  @IsInt()
  lessonId!: number;
}

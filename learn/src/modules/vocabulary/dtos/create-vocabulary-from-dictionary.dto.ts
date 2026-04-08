import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVocabularyFromDictionaryDto {
  @ApiProperty({ example: 'hello' })
  @IsString()
  @MaxLength(255)
  word!: string;

  @ApiProperty({ example: 'used as a greeting' })
  @IsString()
  definition!: string;

  @ApiPropertyOptional({ example: 'A1' })
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @ApiPropertyOptional({ example: 'Xin chao' })
  @IsOptional()
  @IsString()
  translation?: string;

  @ApiPropertyOptional({ example: '/həˈloʊ/' })
  @IsOptional()
  @IsString()
  phonetic?: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/us.mp3' })
  @IsOptional()
  @IsString()
  audio?: string;

  @ApiPropertyOptional({ example: 'Hello, how are you?' })
  @IsOptional()
  @IsString()
  example?: string;

  @ApiPropertyOptional({ example: 'Xin chao, ban khoe khong?' })
  @IsOptional()
  @IsString()
  exampleTranslation?: string;

  @ApiPropertyOptional({ example: 'interjection' })
  @IsOptional()
  @IsString()
  partOfSpeech?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({ example: 'Useful in formal greeting' })
  @IsOptional()
  @IsString()
  note?: string;
}

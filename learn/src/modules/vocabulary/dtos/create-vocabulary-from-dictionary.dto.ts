import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DictionaryExampleDto {
  @ApiProperty({ example: 'Hello, how are you?' })
  @IsString()
  example!: string;

  @ApiPropertyOptional({ example: 'Xin chao, ban khoe khong?' })
  @IsOptional()
  @IsString()
  exampleVi?: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/example.mp3' })
  @IsOptional()
  @IsString()
  exampleAudio?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

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

  @ApiPropertyOptional({ example: '/həˈloʊ/' })
  @IsOptional()
  @IsString()
  phoneticUs?: string;

  @ApiPropertyOptional({ example: '/həˈləʊ/' })
  @IsOptional()
  @IsString()
  phoneticUk?: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/us.mp3' })
  @IsOptional()
  @IsString()
  audio?: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/us.mp3' })
  @IsOptional()
  @IsString()
  audioUs?: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/uk.mp3' })
  @IsOptional()
  @IsString()
  audioUk?: string;

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

  @ApiPropertyOptional({ example: 'used as a greeting in daily conversation' })
  @IsOptional()
  @IsString()
  definitionGpt?: string;

  @ApiPropertyOptional({ type: [DictionaryExampleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DictionaryExampleDto)
  examples?: DictionaryExampleDto[];

  @ApiPropertyOptional({ example: 'mochi' })
  @IsOptional()
  @IsString()
  sourceProvider?: string;

  @ApiPropertyOptional({ example: { entryId: 1001 } })
  @IsOptional()
  @IsObject()
  sourceMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({ example: 'Useful in formal greeting' })
  @IsOptional()
  @IsString()
  note?: string;
}

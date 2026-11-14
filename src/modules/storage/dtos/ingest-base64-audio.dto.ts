import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class IngestBase64AudioDto {
  @ApiProperty({ example: 'data:audio/mpeg;base64,...' })
  @IsString()
  @IsNotEmpty()
  audioBase64!: string;

  @ApiProperty({ example: 'audio/mpeg' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 'roleplay/audio' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  folder!: string;

  @ApiPropertyOptional({ example: { sourceProvider: 'elevenlabs' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

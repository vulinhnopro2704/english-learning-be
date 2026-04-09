import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class IngestRemoteAudioDto {
  @ApiProperty({ example: 'https://cdn.example.com/audio/hello-us.mp3' })
  @IsUrl({ require_tld: false })
  sourceUrl!: string;

  @ApiProperty({ example: 'words/audio' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  folder!: string;

  @ApiProperty({ enum: ['us', 'uk'], example: 'us' })
  @IsIn(['us', 'uk'])
  accent!: 'us' | 'uk';

  @ApiPropertyOptional({ example: 'hello' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  word?: string;

  @ApiPropertyOptional({ example: { sourceProvider: 'mochi' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

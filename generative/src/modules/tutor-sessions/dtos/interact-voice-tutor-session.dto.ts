import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

const SUPPORTED_MIME_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
] as const;

export class InteractVoiceTutorSessionDto {
  @ApiPropertyOptional({
    example: 'GkXfo59ChoEBQveBAULygQRC84EIQo...',
    description:
      'Base64 encoded audio payload (without data URI prefix). Provide either audioBase64 or audioUrl.',
    maxLength: 16000000,
  })
  @ValidateIf((dto: InteractVoiceTutorSessionDto) => !dto.audioUrl)
  @IsString()
  @IsBase64()
  @MaxLength(16_000_000)
  audioBase64?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/uploads/voice-turn-001.webm',
    description:
      'Publicly reachable audio URL. Provide either audioBase64 or audioUrl.',
  })
  @ValidateIf((dto: InteractVoiceTutorSessionDto) => !dto.audioBase64)
  @IsString()
  @Length(8, 2048)
  @Matches(/^https?:\/\//i, {
    message: 'audioUrl must start with http:// or https://',
  })
  audioUrl?: string;

  @ApiPropertyOptional({
    example: 'audio/webm',
    enum: SUPPORTED_MIME_TYPES,
    description:
      'MIME type hint for uploaded audio. Improves downstream decoding reliability.',
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_MIME_TYPES)
  mimeType?: string;

  @ApiPropertyOptional({
    example: 'eng',
    description:
      'Optional ISO-639-3 language code hint for STT, e.g. eng, vie, jpn.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{3}$/i, {
    message: 'languageCode must be a 3-letter ISO-639-3 code',
  })
  languageCode?: string;

  @ApiPropertyOptional({
    example: 'turn-client-20260412-voice-001',
    description: 'Client-side idempotency key for the voice turn',
  })
  @IsOptional()
  @IsString()
  @Length(4, 128)
  clientTurnId?: string;
}

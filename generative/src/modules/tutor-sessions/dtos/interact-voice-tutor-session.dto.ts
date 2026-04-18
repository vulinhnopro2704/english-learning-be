import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  ValidateIf,
  IsBase64,
} from 'class-validator';

export class InteractVoiceTutorSessionDto {
  @ApiPropertyOptional({
    example: 'GkXfo59ChoEBQveBAULygQRC84EIQo...',
    description: 'Base64 encoded audio payload (without data URI prefix)',
  })
  @ValidateIf((dto: InteractVoiceTutorSessionDto) => !dto.audioUrl)
  @IsString()
  @IsBase64()
  audioBase64?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/uploads/voice-turn-001.webm',
  })
  @ValidateIf((dto: InteractVoiceTutorSessionDto) => !dto.audioBase64)
  @IsString()
  @Length(8, 2048)
  audioUrl?: string;

  @ApiPropertyOptional({ example: 'audio/webm' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ example: 'eng' })
  @IsOptional()
  @IsString()
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

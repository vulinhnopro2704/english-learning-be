import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartRoleplayDto {
  @ApiProperty({ example: 'scenario-id-123' })
  @IsString()
  @IsNotEmpty()
  scenarioId!: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  skipTts?: boolean;
}

export class ChatRoleplayDto {
  @ApiProperty({ example: 'session-id-123' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ example: 'Hi, I would like to order a cappuccino.' })
  @IsString()
  @IsNotEmpty()
  userMessage!: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  skipTts?: boolean;
}

export class SummarizeRoleplayDto {
  @ApiProperty({ example: 'session-id-123' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}

export class ChatVoiceRoleplayDto {
  @ApiProperty({ example: 'session-id-123' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ example: 'base64-audio-data...' })
  @IsString()
  @IsNotEmpty()
  audioBase64!: string;

  @ApiProperty({ example: 'audio/webm' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  skipTts?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export class CreateTutorSessionDto {
  @ApiProperty({ example: 'A2', enum: CEFR_LEVELS })
  @IsString()
  @IsIn(CEFR_LEVELS)
  cefrLevel!: (typeof CEFR_LEVELS)[number];

  @ApiPropertyOptional({
    example: ['daily_conversation', 'pronunciation'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusTopics?: string[];

  @ApiPropertyOptional({ example: 'EXAVITQu4vr4xnSDxMaL' })
  @IsOptional()
  @IsString()
  @Length(8, 64)
  voiceId?: string;
}

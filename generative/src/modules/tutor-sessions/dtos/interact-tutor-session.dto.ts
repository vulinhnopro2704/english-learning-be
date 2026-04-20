import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

const INPUT_MODES = ['text'] as const;

export class InteractTutorSessionDto {
  @ApiProperty({
    example: 'I goed to school yesterday, is it correct?',
    description:
      'Learner text message for one tutor turn. Supports short questions or full sentences.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @Length(1, 2000)
  userInput!: string;

  @ApiProperty({
    enum: INPUT_MODES,
    example: 'text',
    description:
      'Input mode discriminator. Current endpoint supports text mode only.',
  })
  @IsString()
  @IsIn(INPUT_MODES)
  inputMode!: (typeof INPUT_MODES)[number];

  @ApiPropertyOptional({
    example: 'turn-client-20260412-001',
    description: 'Client-side idempotency key for the turn',
  })
  @IsOptional()
  @IsString()
  @Length(4, 128)
  clientTurnId?: string;
}

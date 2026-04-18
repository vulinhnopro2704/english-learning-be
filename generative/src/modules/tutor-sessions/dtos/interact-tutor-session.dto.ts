import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

const INPUT_MODES = ['text'] as const;

export class InteractTutorSessionDto {
  @ApiProperty({ example: 'I goed to school yesterday, is it correct?' })
  @IsString()
  @Length(1, 2000)
  userInput!: string;

  @ApiProperty({ enum: INPUT_MODES, example: 'text' })
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

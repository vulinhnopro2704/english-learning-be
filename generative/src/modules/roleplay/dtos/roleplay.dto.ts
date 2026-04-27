import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartRoleplayDto {
  @ApiProperty({ example: 'user-id-123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'scenario-id-123' })
  @IsString()
  @IsNotEmpty()
  scenarioId: string;
}

export class ChatRoleplayDto {
  @ApiProperty({ example: 'session-id-123' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ example: 'Hi, I would like to order a cappuccino.' })
  @IsString()
  @IsNotEmpty()
  userMessage: string;
}

export class SummarizeRoleplayDto {
  @ApiProperty({ example: 'session-id-123' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

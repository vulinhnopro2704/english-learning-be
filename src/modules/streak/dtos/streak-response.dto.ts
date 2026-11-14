import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StreakResponseDto {
  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  userId!: string;

  @ApiProperty({ example: 5 })
  currentStreak!: number;

  @ApiProperty({ example: 14 })
  longestStreak!: number;

  @ApiPropertyOptional({ example: '2026-03-27T14:22:31.123Z', nullable: true })
  lastActivity?: string | null;
}

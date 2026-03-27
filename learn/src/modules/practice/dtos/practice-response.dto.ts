import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompleteLessonResponseDto } from '../../progress/dtos/progress-response.dto';

export class PracticeSessionResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  userId!: string;

  @ApiProperty({ example: 'FSRS' })
  type!: string;

  @ApiPropertyOptional({ example: 1, nullable: true })
  lessonId?: number | null;

  @ApiProperty({ example: 10 })
  totalWords!: number;

  @ApiPropertyOptional({ example: 8, nullable: true })
  correctCount?: number | null;

  @ApiPropertyOptional({ example: 32000, nullable: true })
  totalDurationMs?: number | null;

  @ApiPropertyOptional({ example: '2026-03-27T14:22:31.123Z', nullable: true })
  startedAt?: string | null;

  @ApiPropertyOptional({ example: '2026-03-27T14:30:10.123Z', nullable: true })
  completedAt?: string | null;
}

export class PracticeLessonSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Greetings & Introductions' })
  title!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/lesson.jpg',
    nullable: true,
  })
  image?: string | null;
}

export class PracticeHistoryItemDto extends PracticeSessionResponseDto {
  @ApiPropertyOptional({ type: PracticeLessonSummaryDto, nullable: true })
  lesson?: PracticeLessonSummaryDto | null;
}

export class SubmitFsrsPracticeResponseDto {
  @ApiProperty({ type: PracticeSessionResponseDto })
  session!: PracticeSessionResponseDto;

  @ApiProperty({
    description: 'Opaque JSON payload returned by FSRS-AI upstream service',
    additionalProperties: true,
  })
  fsrsResult!: Record<string, unknown>;
}

export class SubmitLessonPracticeResponseDto {
  @ApiProperty({ type: PracticeSessionResponseDto })
  session!: PracticeSessionResponseDto;

  @ApiProperty({ type: CompleteLessonResponseDto })
  progressResult!: CompleteLessonResponseDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LessonCountDto {
  @ApiProperty({ example: 25 })
  words!: number;
}

export class LessonResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Greetings & Introductions' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Learn basic greetings in English',
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/lesson.jpg',
    nullable: true,
  })
  image?: string | null;

  @ApiProperty({ example: 0 })
  order!: number;

  @ApiProperty({ example: false })
  isPublished!: boolean;

  @ApiProperty({ example: false })
  isUserCreated!: boolean;

  @ApiPropertyOptional({
    example: 'c0c58e9b-2ec4-43df-9309-1f0f80d220e1',
    nullable: true,
  })
  createdByUserId?: string | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  courseId?: number | null;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: LessonCountDto })
  _count?: LessonCountDto;
}

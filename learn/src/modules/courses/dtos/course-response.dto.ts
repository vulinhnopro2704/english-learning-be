import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseCountDto {
  @ApiProperty({ example: 12 })
  lessons!: number;
}

export class CourseResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Tiếng Anh cơ bản' })
  title!: string;

  @ApiPropertyOptional({ example: 'Basic English', nullable: true })
  enTitle?: string | null;

  @ApiPropertyOptional({
    example: 'A beginner course for English learners',
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/course.jpg',
    nullable: true,
  })
  image?: string | null;

  @ApiPropertyOptional({ example: '📚', nullable: true })
  icon?: string | null;

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

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: CourseCountDto })
  _count?: CourseCountDto;
}

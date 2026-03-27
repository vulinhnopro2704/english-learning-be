import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProgressCourseSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Basic English' })
  title!: string;

  @ApiPropertyOptional({ example: 'Basic English', nullable: true })
  enTitle?: string | null;

  @ApiPropertyOptional({ example: '📚', nullable: true })
  icon?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/course.jpg',
    nullable: true,
  })
  image?: string | null;
}

export class UserCourseProgressResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  userId!: string;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: false })
  isCompleted!: boolean;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  lastAccessedAt!: string;

  @ApiPropertyOptional({
    type: ProgressCourseSummaryDto,
    nullable: true,
  })
  course?: ProgressCourseSummaryDto;
}

export class ProgressLessonSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Greetings & Introductions' })
  title!: string;

  @ApiProperty({ example: 0 })
  order!: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  courseId?: number | null;

  @ApiPropertyOptional({
    example: 'https://example.com/lesson.jpg',
    nullable: true,
  })
  image?: string | null;
}

export class UserLessonProgressResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  userId!: string;

  @ApiProperty({ example: 1 })
  lessonId!: number;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiPropertyOptional({ example: 85, nullable: true })
  score?: number | null;

  @ApiPropertyOptional({ example: '2026-03-27T14:22:31.123Z', nullable: true })
  completedAt?: string | null;

  @ApiPropertyOptional({ type: ProgressLessonSummaryDto, nullable: true })
  lesson?: ProgressLessonSummaryDto;
}

export class CompleteLessonResponseDto {
  @ApiProperty({ type: UserLessonProgressResponseDto })
  lessonProgress!: UserLessonProgressResponseDto;

  @ApiProperty({ example: 12 })
  wordsUnlocked!: number;
}

export class ProgressWordSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'hello' })
  word!: string;

  @ApiPropertyOptional({ example: '/həˈloʊ/', nullable: true })
  pronunciation?: string | null;

  @ApiProperty({ example: 'Xin chào' })
  meaning!: string;

  @ApiPropertyOptional({
    example: 'Hello, how are you?',
    nullable: true,
  })
  example?: string | null;

  @ApiPropertyOptional({
    example: 'Xin chào, bạn khỏe không?',
    nullable: true,
  })
  exampleVi?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/hello.jpg',
    nullable: true,
  })
  image?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/hello.mp3',
    nullable: true,
  })
  audio?: string | null;

  @ApiPropertyOptional({ example: 'interjection', nullable: true })
  pos?: string | null;

  @ApiPropertyOptional({ example: 'A1', nullable: true })
  cefr?: string | null;
}

export class UserWordProgressResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  userId!: string;

  @ApiProperty({ example: 1 })
  wordId!: number;

  @ApiProperty({ example: 'LEVEL_2' })
  status!: string;

  @ApiProperty({ example: 45 })
  proficiency!: number;

  @ApiProperty({ example: 6 })
  reviewCount!: number;

  @ApiProperty({ example: 4 })
  correctCount!: number;

  @ApiPropertyOptional({ example: '2026-03-28T14:22:31.123Z', nullable: true })
  nextReview?: string | null;

  @ApiPropertyOptional({ example: '2026-03-27T14:22:31.123Z', nullable: true })
  lastReviewedAt?: string | null;

  @ApiPropertyOptional({ type: ProgressWordSummaryDto, nullable: true })
  word?: ProgressWordSummaryDto;
}

export class ReviewWordResponseDto extends UserWordProgressResponseDto {
  @ApiProperty({ example: 'LEVEL_1' })
  previousLevel!: string;

  @ApiProperty({ example: true })
  levelChanged!: boolean;

  @ApiProperty({ example: true })
  isCorrect!: boolean;
}

export class WordsToReviewResponseDto {
  @ApiProperty({ type: [UserWordProgressResponseDto] })
  data!: UserWordProgressResponseDto[];

  @ApiProperty({ example: 20 })
  total!: number;
}

export class ProgressStatsResponseDto {
  @ApiProperty({ example: 120 })
  totalWords!: number;

  @ApiProperty({ example: 25 })
  masteredWords!: number;

  @ApiProperty({ example: 13 })
  dueForReview!: number;

  @ApiProperty({ example: 6 })
  coursesStarted!: number;

  @ApiProperty({ example: 18 })
  lessonsCompleted!: number;

  @ApiProperty({ example: 78 })
  accuracy!: number;

  @ApiProperty({
    example: {
      NEW: 12,
      LEVEL_1: 24,
      LEVEL_2: 30,
      LEVEL_3: 21,
      LEVEL_4: 18,
      LEVEL_5: 15,
    },
  })
  levelDistribution!: Record<string, number>;
}

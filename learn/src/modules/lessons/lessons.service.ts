import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import { CreateLessonDto } from './dtos/create-lesson.dto';
import { UpdateLessonDto } from './dtos/update-lesson.dto';
import { LessonFilterDto } from './dtos/lesson-filter.dto';
import { ProgressService } from '../progress/progress.service';
import { StreakService } from '../streak/streak.service';
import type { Prisma } from '../../generated/prisma/client';

const LESSON_SELECT = {
  id: true,
  title: true,
  description: true,
  image: true,
  order: true,
  isPublished: true,
  courseId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly streakService: StreakService,
    private readonly configService: ConfigService,
  ) {}

  async completeLesson(userId: string, lessonId: number, score: number) {
    const progressResult = await this.progressService.completeLesson(
      userId,
      lessonId,
      score,
    );

    const words = await this.prisma.word.findMany({
      where: { lessonId },
      select: { id: true },
    });

    const fsrsBaseUrl = this.configService.get<string>('FSRS_AI_URL');
    if (fsrsBaseUrl && words.length > 0) {
      try {
        const url = new URL(`${fsrsBaseUrl}/api/v1/fsrs/init-cards`);
        url.searchParams.set('user_id', userId);
        words.forEach((word) => {
          url.searchParams.append('word_ids', String(word.id));
        });

        await fetch(url.toString(), { method: 'POST' });
      } catch (error) {
        this.logger.warn(
          `FSRS card init failed for lesson ${lessonId}: ${(error as Error).message}`,
        );
      }
    }

    const session = await this.prisma.practiceSession.create({
      data: {
        userId,
        type: 'LEARN_LESSON',
        lessonId,
        totalWords: words.length,
        completedAt: new Date(),
      },
    });

    await this.streakService.recordActivity(userId);

    return {
      lessonProgress: progressResult.lessonProgress,
      wordsUnlocked: progressResult.wordsUnlocked,
      session,
    };
  }

  async findAll(filter: LessonFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.LessonWhereInput = {};

    if (filter.search) {
      where.title = { contains: filter.search, mode: 'insensitive' };
    }

    if (filter.courseId !== undefined) {
      where.courseId = filter.courseId;
    }

    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }

    const orderBy: Prisma.LessonOrderByWithRelationInput = {
      [filter.sortBy ?? 'order']: filter.sortOrder ?? 'asc',
    };

    const findManyArgs: Prisma.LessonFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      select: {
        ...LESSON_SELECT,
        _count: { select: { words: true } },
      },
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [lessons, total] = await Promise.all([
      this.prisma.lesson.findMany(findManyArgs),
      this.prisma.lesson.count({ where }),
    ]);

    const hasMore = lessons.length > take;
    const data = hasMore ? lessons.slice(0, take) : lessons;
    const nextCursor =
      hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    };
  }

  async findOne(id: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: {
        ...LESSON_SELECT,
        course: {
          select: { id: true, title: true },
        },
        words: {
          select: {
            id: true,
            word: true,
            pronunciation: true,
            meaning: true,
            pos: true,
            cefr: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!lesson) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'LESSON_NOT_FOUND',
        message: `Lesson with ID ${id} not found`,
      });
    }

    return lesson;
  }

  async create(dto: CreateLessonDto) {
    return this.prisma.lesson.create({
      data: dto,
      select: LESSON_SELECT,
    });
  }

  async update(id: number, dto: UpdateLessonDto) {
    await this.findOne(id);

    return this.prisma.lesson.update({
      where: { id },
      data: dto,
      select: LESSON_SELECT,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.lesson.delete({ where: { id } });

    return { message: `Lesson with ID ${id} deleted successfully` };
  }
}

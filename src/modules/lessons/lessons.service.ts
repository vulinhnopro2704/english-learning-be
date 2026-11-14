import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../database/prisma.service';
import { CreateLessonDto } from './dtos/create-lesson.dto';
import { UpdateLessonDto } from './dtos/update-lesson.dto';
import { LessonFilterDto } from './dtos/lesson-filter.dto';
import { ProgressService } from '../progress/progress.service';
import { StreakService } from '../streak/streak.service';
import { RedisService, CACHE_TTL_SECONDS } from '../../redis/redis.service';
import { FsrsSchedulerService } from '../fsrs/services/fsrs-scheduler.service';
import type { Prisma } from '../../database/generated/prisma/client';
import type { CurrentUser } from '../../common/types/api.types';

const LESSON_SELECT = {
  id: true,
  title: true,
  description: true,
  image: true,
  order: true,
  isPublished: true,
  isUserCreated: true,
  createdByUserId: true,
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
    private readonly redisService: RedisService,
    private readonly fsrsSchedulerService: FsrsSchedulerService,
  ) {}

  private async invalidateRelatedCaches(userId?: string) {
    await this.redisService.delByPatterns([
      this.redisService.buildScopePattern('lessons'),
      this.redisService.buildScopePattern('courses'),
      this.redisService.buildScopePattern('words'),
      this.redisService.buildScopePattern('progress'),
      this.redisService.buildScopePattern('progress', userId),
      this.redisService.buildScopePattern('practice'),
      this.redisService.buildScopePattern('practice', userId),
      this.redisService.buildScopePattern('streak'),
      this.redisService.buildScopePattern('streak', userId),
    ]);
  }

  private isUserRole(user?: CurrentUser): boolean {
    return (user?.role ?? '').toUpperCase() === 'USER';
  }

  private buildLessonVisibilityWhere(
    user?: CurrentUser,
  ): Prisma.LessonWhereInput | undefined {
    if (!this.isUserRole(user)) {
      return undefined;
    }

    return {
      OR: [
        { isUserCreated: false },
        {
          isUserCreated: true,
          createdByUserId: user!.id,
        },
      ],
    };
  }

  private assertLessonWritePermission(
    lesson: { isUserCreated: boolean; createdByUserId: string | null },
    user?: CurrentUser,
  ) {
    if (!this.isUserRole(user)) {
      return;
    }

    if (lesson.isUserCreated && lesson.createdByUserId === user!.id) {
      return;
    }

    throw new ApiException({
      statusCode: HttpStatus.FORBIDDEN,
      errorCode: 'LESSON_FORBIDDEN',
      message: 'You do not have permission to modify this lesson',
    });
  }

  private async assertCourseAttachPermission(
    courseId: number | undefined,
    user?: CurrentUser,
  ) {
    if (courseId == null || !this.isUserRole(user)) {
      return;
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        isUserCreated: true,
        createdByUserId: true,
      },
    });

    if (!course) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'COURSE_NOT_FOUND',
        message: `Course with ID ${courseId} not found`,
      });
    }

    if (!course.isUserCreated || course.createdByUserId !== user!.id) {
      throw new ApiException({
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: 'COURSE_ATTACH_FORBIDDEN',
        message: 'You can only assign lessons to your own created courses',
      });
    }
  }

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

    if (words.length > 0) {
      try {
        await this.fsrsSchedulerService.initCards(
          userId,
          words.map((w) => w.id),
        );
      } catch (error) {
        this.logger.warn(
          `FSRS card init failed for lesson ${lessonId}: ${(error as Error).message}`,
        );
      }
    }

    const now = new Date();
    let session;
    try {
      session = await this.prisma.practiceSession.create({
        data: {
          userId,
          type: 'LEARN_LESSON',
          lessonId,
          totalWords: words.length,
          correctCount: 0,
          totalDurationMs: 0,
          startedAt: now,
          completedAt: now,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed creating LEARN_LESSON practice session for user ${userId}, lesson ${lessonId}`,
        error instanceof Error ? error.message : String(error),
      );
      session = null;
    }

    try {
      await this.streakService.recordActivity(userId);
    } catch (error) {
      this.logger.warn(
        `Failed recording streak for user ${userId} after lesson ${lessonId}`,
        error instanceof Error ? error.message : String(error),
      );
    }

    const response = {
      lessonProgress: progressResult.lessonProgress,
      wordsUnlocked: progressResult.wordsUnlocked,
      session,
    };

    await this.invalidateRelatedCaches(userId);

    return response;
  }

  async findAll(filter: LessonFilterDto, user?: CurrentUser) {
    const cacheKey = this.redisService.buildCacheKey('lessons', {
      userId: user?.id,
      params: {
        endpoint: 'findAll',
        role: user?.role ?? 'anonymous',
        filter,
      },
    });

    const cached = await this.redisService.getJson<{
      data: unknown[];
      pagination: {
        nextCursor: number | null;
        hasMore: boolean;
        total: number;
      };
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const take = filter.take ?? 20;

    const where: Prisma.LessonWhereInput = {};
    const visibilityWhere = this.buildLessonVisibilityWhere(user);

    if (visibilityWhere) {
      where.AND = [visibilityWhere];
    }

    if (filter.search) {
      where.title = { contains: filter.search, mode: 'insensitive' };
    }

    if (filter.courseId !== undefined) {
      where.courseId = filter.courseId;
    }

    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }

    if (filter.createdByMe && user) {
      where.isUserCreated = true;
      where.createdByUserId = user.id;
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
    const lessonIds = data.map((lesson) => lesson.id);

    const progressMap = new Map<
      number,
      { status: string; score: number; completedAt: Date | null }
    >();
    if (user && lessonIds.length > 0) {
      const progressRows = await this.prisma.userLessonProgress.findMany({
        where: {
          userId: user.id,
          lessonId: { in: lessonIds },
        },
        select: {
          lessonId: true,
          status: true,
          score: true,
          completedAt: true,
        },
      });

      for (const row of progressRows) {
        progressMap.set(row.lessonId, {
          status: row.status,
          score: row.score,
          completedAt: row.completedAt,
        });
      }
    }

    const enrichedData = data.map((lesson) => {
      const progress = progressMap.get(lesson.id) ?? null;
      const isLearned = progress?.status === 'COMPLETED';

      return {
        ...lesson,
        isLearned,
        learnedAt: progress?.completedAt ?? null,
        progress: progress
          ? {
              ...progress,
              isLearned,
              learnedAt: progress.completedAt,
            }
          : null,
      };
    });

    const nextCursor =
      hasMore && enrichedData.length > 0
        ? (enrichedData[enrichedData.length - 1]?.id ?? null)
        : null;

    const response = {
      data: enrichedData,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    };

    await this.redisService.setJson(
      cacheKey,
      response,
      CACHE_TTL_SECONDS.MEDIUM,
    );

    return response;
  }

  async findOne(id: number, user?: CurrentUser) {
    const cacheKey = this.redisService.buildCacheKey('lessons', {
      userId: user?.id,
      params: {
        endpoint: 'findOne',
        role: user?.role ?? 'anonymous',
        id,
      },
    });

    const cached =
      await this.redisService.getJson<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    const visibilityWhere = this.buildLessonVisibilityWhere(user);

    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id,
        ...(visibilityWhere ? { AND: [visibilityWhere] } : {}),
      },
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

    if (!user) {
      await this.redisService.setJson(
        cacheKey,
        lesson,
        CACHE_TTL_SECONDS.MEDIUM,
      );
      return lesson;
    }

    const progress = await this.prisma.userLessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: user.id,
          lessonId: id,
        },
      },
      select: {
        status: true,
        score: true,
        completedAt: true,
      },
    });

    const isLearned = progress?.status === 'COMPLETED';

    const response = {
      ...lesson,
      isLearned,
      learnedAt: progress?.completedAt ?? null,
      progress: progress
        ? {
            ...progress,
            isLearned,
            learnedAt: progress.completedAt,
          }
        : null,
    };

    await this.redisService.setJson(
      cacheKey,
      response,
      CACHE_TTL_SECONDS.MEDIUM,
    );

    return response;
  }

  async create(dto: CreateLessonDto, user?: CurrentUser) {
    const isUserCreated = this.isUserRole(user);
    await this.assertCourseAttachPermission(dto.courseId, user);

    const created = await this.prisma.lesson.create({
      data: {
        ...dto,
        isUserCreated,
        createdByUserId: isUserCreated ? user!.id : null,
      },
      select: LESSON_SELECT,
    });

    await this.invalidateRelatedCaches(user?.id);

    return created;
  }

  async update(id: number, dto: UpdateLessonDto, user?: CurrentUser) {
    const lesson = await this.findOne(id, user);
    this.assertLessonWritePermission(
      lesson as { isUserCreated: boolean; createdByUserId: string | null },
      user,
    );
    await this.assertCourseAttachPermission(dto.courseId, user);

    const updated = await this.prisma.lesson.update({
      where: { id },
      data: dto,
      select: LESSON_SELECT,
    });

    await this.invalidateRelatedCaches(user?.id);

    return updated;
  }

  async remove(id: number, user?: CurrentUser) {
    const lesson = await this.findOne(id, user);
    this.assertLessonWritePermission(
      lesson as { isUserCreated: boolean; createdByUserId: string | null },
      user,
    );

    await this.prisma.lesson.delete({ where: { id } });
    await this.invalidateRelatedCaches(user?.id);

    return { message: `Lesson with ID ${id} deleted successfully` };
  }
}

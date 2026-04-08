import { Injectable, HttpStatus } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import {
  CourseProgressFilterDto,
  LessonProgressFilterDto,
  WordProgressFilterDto,
} from './dtos/progress.dto';
import type { Prisma } from '../../generated/prisma/client';

function normalizeCompletionScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  const nonNegative = Math.max(0, score);
  const normalizedPercent = nonNegative <= 1 ? nonNegative * 100 : nonNegative;
  return Math.min(100, Math.round(normalizedPercent));
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══ COURSE PROGRESS ═══════════════════════════════════════════════════════

  async startCourse(userId: string, courseId: number) {
    // Verify course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'COURSE_NOT_FOUND',
        message: `Course with ID ${courseId} not found`,
      });

    // Upsert — idempotent
    return this.prisma.userCourseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: { lastAccessedAt: new Date() },
      include: { course: { select: { id: true, title: true, icon: true } } },
    });
  }

  async getMyCourses(userId: string, filter: CourseProgressFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.UserCourseProgressWhereInput = { userId };

    if (filter.isCompleted !== undefined) {
      where.isCompleted = filter.isCompleted;
    }

    const orderBy: Prisma.UserCourseProgressOrderByWithRelationInput = {
      [filter.sortBy ?? 'lastAccessedAt']: filter.sortOrder ?? 'desc',
    };

    const findManyArgs: Prisma.UserCourseProgressFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            enTitle: true,
            icon: true,
            image: true,
            _count: { select: { lessons: true } },
          },
        },
      },
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [items, total] = await Promise.all([
      this.prisma.userCourseProgress.findMany(findManyArgs),
      this.prisma.userCourseProgress.count({ where }),
    ]);

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;

    const courseIds = data.map((item) => item.courseId);
    const lessonTotalRows =
      courseIds.length > 0
        ? await this.prisma.lesson.groupBy({
            by: ['courseId'],
            where: { courseId: { in: courseIds } },
            _count: { _all: true },
          })
        : [];
    const lessonTotalMap = new Map<number, number>();
    for (const row of lessonTotalRows) {
      if (row.courseId == null) {
        continue;
      }
      lessonTotalMap.set(row.courseId, row._count._all);
    }

    const completedLessons =
      courseIds.length > 0
        ? await this.prisma.userLessonProgress.findMany({
            where: {
              userId,
              status: 'COMPLETED',
              lesson: { courseId: { in: courseIds } },
            },
            select: {
              completedAt: true,
              lesson: { select: { courseId: true } },
            },
          })
        : [];

    const completedCountMap = new Map<number, number>();
    const lastCompletedAtMap = new Map<number, Date>();
    for (const item of completedLessons) {
      const courseId = item.lesson.courseId;
      if (courseId == null) {
        continue;
      }

      completedCountMap.set(
        courseId,
        (completedCountMap.get(courseId) ?? 0) + 1,
      );
      if (item.completedAt) {
        const last = lastCompletedAtMap.get(courseId);
        if (!last || item.completedAt > last) {
          lastCompletedAtMap.set(courseId, item.completedAt);
        }
      }
    }

    const enrichedData = data.map((item) => {
      const totalLessons = lessonTotalMap.get(item.courseId) ?? 0;
      const completedLessons = completedCountMap.get(item.courseId) ?? 0;
      const lastCompletedLessonAt =
        lastCompletedAtMap.get(item.courseId) ?? null;

      return {
        ...item,
        completedLessons,
        totalLessons,
        progress: {
          isStarted: true,
          isCompleted: item.isCompleted,
          startedAt: item.startedAt,
          lastAccessedAt: item.lastAccessedAt,
          completedLessons,
          totalLessons,
          lastCompletedLessonAt,
        },
      };
    });

    const nextCursor =
      hasMore && enrichedData.length > 0
        ? (enrichedData[enrichedData.length - 1]?.id ?? null)
        : null;

    return { data: enrichedData, pagination: { nextCursor, hasMore, total } };
  }

  // ═══ LESSON PROGRESS ═══════════════════════════════════════════════════════

  async completeLesson(userId: string, lessonId: number, score: number) {
    // Verify lesson exists and get its words
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { words: { select: { id: true } } },
    });
    if (!lesson)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'LESSON_NOT_FOUND',
        message: `Lesson with ID ${lessonId} not found`,
      });

    const existingProgress = await this.prisma.userLessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { status: true },
    });

    if (existingProgress?.status === 'COMPLETED') {
      throw new ApiException({
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'LESSON_ALREADY_COMPLETED',
        message: `Lesson with ID ${lessonId} is already completed`,
      });
    }

    const normalizedScore = normalizeCompletionScore(score);

    // Mark lesson as completed
    const lessonProgress = await this.prisma.userLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        status: 'COMPLETED',
        score: normalizedScore,
        completedAt: new Date(),
      },
      update: {
        status: 'COMPLETED',
        score: normalizedScore,
        completedAt: new Date(),
      },
    });

    // Unlock all words in the lesson → create UserWordProgress entries with status = NEW
    if (lesson.words.length > 0) {
      const now = new Date();
      const wordProgressData = lesson.words.map((w) => ({
        userId,
        wordId: w.id,
        status: 'NEW' as const,
        proficiency: 0,
        nextReview: now,
        reviewCount: 0,
        correctCount: 0,
      }));

      // skipDuplicates ensures idempotency
      await this.prisma.userWordProgress.createMany({
        data: wordProgressData,
        skipDuplicates: true,
      });

      await this.prisma.userWordProgress.updateMany({
        where: {
          userId,
          wordId: { in: lesson.words.map((w) => w.id) },
          nextReview: null,
        },
        data: {
          nextReview: now,
        },
      });
    }

    // Auto-start course progress if lesson belongs to a course
    if (lesson.courseId) {
      await this.prisma.userCourseProgress.upsert({
        where: { userId_courseId: { userId, courseId: lesson.courseId } },
        create: { userId, courseId: lesson.courseId },
        update: { lastAccessedAt: new Date() },
      });

      // Check if all lessons in course are completed
      const courseInfo = await this.prisma.lesson.findMany({
        where: { courseId: lesson.courseId },
        select: { id: true },
      });

      const completedCount = await this.prisma.userLessonProgress.count({
        where: {
          userId,
          lessonId: { in: courseInfo.map((l) => l.id) },
          status: 'COMPLETED',
        },
      });

      if (completedCount >= courseInfo.length) {
        await this.prisma.userCourseProgress.update({
          where: { userId_courseId: { userId, courseId: lesson.courseId } },
          data: { isCompleted: true },
        });
      }
    }

    return {
      lessonProgress,
      wordsUnlocked: lesson.words.length,
    };
  }

  async getMyLessons(userId: string, filter: LessonProgressFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.UserLessonProgressWhereInput = { userId };

    if (filter.status) {
      where.status = filter.status as any;
    }

    if (filter.courseId !== undefined) {
      where.lesson = { courseId: filter.courseId };
    }

    const orderBy: Prisma.UserLessonProgressOrderByWithRelationInput = {
      [filter.sortBy ?? 'status']: filter.sortOrder ?? 'asc',
    };

    const findManyArgs: Prisma.UserLessonProgressFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            order: true,
            courseId: true,
            image: true,
          },
        },
      },
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [items, total] = await Promise.all([
      this.prisma.userLessonProgress.findMany(findManyArgs),
      this.prisma.userLessonProgress.count({ where }),
    ]);

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const enrichedData = data.map((item) => {
      const isLearned = item.status === 'COMPLETED';
      return {
        ...item,
        isLearned,
        learnedAt: item.completedAt,
        progress: {
          status: item.status,
          score: item.score,
          completedAt: item.completedAt,
          isLearned,
          learnedAt: item.completedAt,
        },
      };
    });
    const nextCursor =
      hasMore && enrichedData.length > 0
        ? (enrichedData[enrichedData.length - 1]?.id ?? null)
        : null;

    return { data: enrichedData, pagination: { nextCursor, hasMore, total } };
  }

  // ═══ WORD PROGRESS ════════════════════════════════════════════════════════

  async getMyWords(userId: string, filter: WordProgressFilterDto) {
    const take = filter.take ?? 20;

    await this.prisma.userWordProgress.updateMany({
      where: {
        userId,
        status: 'NEW',
        nextReview: null,
      },
      data: {
        nextReview: new Date(),
      },
    });

    const where: Prisma.UserWordProgressWhereInput = { userId };
    const wordWhere: Prisma.WordWhereInput = {};

    if (filter.status) {
      where.status = filter.status as any;
    }

    if (filter.search) {
      wordWhere.OR = [
        { word: { contains: filter.search, mode: 'insensitive' } },
        { meaning: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.cefr) {
      wordWhere.cefr = filter.cefr;
    }

    if (Object.keys(wordWhere).length > 0) {
      where.word = wordWhere;
    }

    const orderBy: Prisma.UserWordProgressOrderByWithRelationInput = {
      [filter.sortBy ?? 'nextReview']: filter.sortOrder ?? 'asc',
    };

    const findManyArgs: Prisma.UserWordProgressFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      include: {
        word: {
          select: {
            id: true,
            word: true,
            pronunciation: true,
            meaning: true,
            example: true,
            exampleVi: true,
            image: true,
            audio: true,
            pos: true,
            cefr: true,
            lesson: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [items, total] = await Promise.all([
      this.prisma.userWordProgress.findMany(findManyArgs),
      this.prisma.userWordProgress.count({ where }),
    ]);

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor =
      hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return { data, pagination: { nextCursor, hasMore, total } };
  }

  async getProgressStats(userId: string) {
    const [
      totalWords,
      masteredWords,
      dueForReview,
      courseProgress,
      lessonProgress,
    ] = await Promise.all([
      this.prisma.userWordProgress.count({ where: { userId } }),
      this.prisma.userWordProgress.count({
        where: { userId, status: 'LEVEL_5' },
      }),
      this.prisma.userWordProgress.count({
        where: {
          userId,
          OR: [
            { nextReview: { lte: new Date() } },
            { nextReview: null, status: 'NEW' },
          ],
        },
      }),
      this.prisma.userCourseProgress.count({ where: { userId } }),
      this.prisma.userLessonProgress.count({
        where: { userId, status: 'COMPLETED' },
      }),
    ]);

    // Level distribution
    const levelDistribution = await this.prisma.userWordProgress.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    return {
      totalWords,
      masteredWords,
      dueForReview,
      coursesStarted: courseProgress,
      lessonsCompleted: lessonProgress,
      accuracy:
        totalWords > 0
          ? Math.round(
              (
                await this.prisma.userWordProgress.aggregate({
                  where: { userId, reviewCount: { gt: 0 } },
                  _avg: { proficiency: true },
                })
              )._avg.proficiency ?? 0,
            )
          : 0,
      levelDistribution: levelDistribution.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}

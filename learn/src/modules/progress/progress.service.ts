import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import {
  CourseProgressFilterDto,
  LessonProgressFilterDto,
  WordProgressFilterDto,
  ReviewWordDto,
} from './dtos/progress.dto';
import type { Prisma } from '../../generated/prisma/client';

// ─── FSRS Interval Map (in days) ────────────────────────────────────────────
const FSRS_INTERVALS: Record<string, number> = {
  NEW: 0,
  LEVEL_1: 1,
  LEVEL_2: 3,
  LEVEL_3: 7,
  LEVEL_4: 14,
  LEVEL_5: 30,
};

const LEVEL_ORDER = [
  'NEW',
  'LEVEL_1',
  'LEVEL_2',
  'LEVEL_3',
  'LEVEL_4',
  'LEVEL_5',
] as const;

type MasteryLevel = (typeof LEVEL_ORDER)[number];

function getNextLevel(current: MasteryLevel): MasteryLevel {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : current;
}

function getPrevLevel(current: MasteryLevel): MasteryLevel {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx > 1 ? LEVEL_ORDER[idx - 1] : LEVEL_ORDER[1]; // min = LEVEL_1 (not NEW)
}

function calculateNextReview(level: MasteryLevel): Date {
  const days = FSRS_INTERVALS[level] ?? 1;
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next;
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
      throw new NotFoundException(`Course with ID ${courseId} not found`);

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
    const nextCursor =
      hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return { data, pagination: { nextCursor, hasMore, total } };
  }

  // ═══ LESSON PROGRESS ═══════════════════════════════════════════════════════

  async completeLesson(userId: string, lessonId: number, score: number) {
    // Verify lesson exists and get its words
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { words: { select: { id: true } } },
    });
    if (!lesson)
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);

    // Mark lesson as completed
    const lessonProgress = await this.prisma.userLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        status: 'COMPLETED',
        score,
        completedAt: new Date(),
      },
      update: {
        status: 'COMPLETED',
        score,
        completedAt: new Date(),
      },
    });

    // Unlock all words in the lesson → create UserWordProgress entries with status = NEW
    if (lesson.words.length > 0) {
      const wordProgressData = lesson.words.map((w) => ({
        userId,
        wordId: w.id,
        status: 'NEW' as const,
        proficiency: 0,
        reviewCount: 0,
        correctCount: 0,
      }));

      // skipDuplicates ensures idempotency
      await this.prisma.userWordProgress.createMany({
        data: wordProgressData,
        skipDuplicates: true,
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
    const nextCursor =
      hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return { data, pagination: { nextCursor, hasMore, total } };
  }

  // ═══ WORD PROGRESS & FSRS ═════════════════════════════════════════════════

  async getWordsToReview(userId: string, take: number = 20) {
    const now = new Date();

    const words = await this.prisma.userWordProgress.findMany({
      where: {
        userId,
        OR: [{ nextReview: { lte: now } }, { nextReview: null, status: 'NEW' }],
      },
      take,
      orderBy: [{ nextReview: 'asc' }],
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
          },
        },
      },
    });

    return {
      data: words,
      total: words.length,
    };
  }

  async reviewWord(userId: string, dto: ReviewWordDto) {
    const progress = await this.prisma.userWordProgress.findUnique({
      where: { userId_wordId: { userId, wordId: dto.wordId } },
    });

    if (!progress) {
      throw new NotFoundException(
        `Word progress not found. Complete the lesson first to unlock this word.`,
      );
    }

    const currentLevel = progress.status as MasteryLevel;
    const isCorrect = dto.result === 'correct';

    let newLevel: MasteryLevel;
    if (isCorrect) {
      newLevel = getNextLevel(currentLevel);
    } else {
      newLevel = currentLevel === 'NEW' ? 'NEW' : getPrevLevel(currentLevel);
    }

    const nextReview = calculateNextReview(newLevel);
    const newProficiency = Math.min(
      100,
      Math.max(0, progress.proficiency + (isCorrect ? 10 : -15)),
    );

    const updated = await this.prisma.userWordProgress.update({
      where: { id: progress.id },
      data: {
        status: newLevel,
        proficiency: newProficiency,
        nextReview,
        lastReviewedAt: new Date(),
        reviewCount: { increment: 1 },
        correctCount: isCorrect ? { increment: 1 } : undefined,
      },
      include: {
        word: { select: { id: true, word: true, meaning: true } },
      },
    });

    return {
      ...updated,
      previousLevel: currentLevel,
      levelChanged: currentLevel !== newLevel,
      isCorrect,
    };
  }

  async getMyWords(userId: string, filter: WordProgressFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.UserWordProgressWhereInput = { userId };

    if (filter.status) {
      where.status = filter.status as any;
    }

    if (filter.search) {
      where.word = {
        OR: [
          { word: { contains: filter.search, mode: 'insensitive' } },
          { meaning: { contains: filter.search, mode: 'insensitive' } },
        ],
      };
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
            pos: true,
            cefr: true,
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

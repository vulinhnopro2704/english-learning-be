import {
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { StreakService } from '../streak/streak.service';
import {
  SubmitFSRSPracticeDto,
  SubmitLessonPracticeDto,
  PracticeHistoryFilterDto,
} from './dtos/practice.dto';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class PracticeService {
  private readonly fsrsBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly streakService: StreakService,
    private readonly configService: ConfigService,
  ) {
    const fsrsUrl = this.configService.get<string>('FSRS_AI_URL');
    if (!fsrsUrl) {
      throw new ApiException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'FSRS_SERVICE_NOT_CONFIGURED',
        message: 'FSRS_AI_URL is not configured',
      });
    }
    this.fsrsBaseUrl = fsrsUrl;
  }

  // ═══ FSRS PRACTICE (Review / Ôn tập) ══════════════════════════════════════

  async submitFSRS(userId: string, dto: SubmitFSRSPracticeDto) {
    const startedAt = new Date();

    // 1. Call FSRS-AI service for bulk review
    const fsrsPayload = {
      userId: userId,
      items: dto.items.map((item) => ({
        wordId: item.wordId,
        isCorrect: item.isCorrect,
        durationMs: item.durationMs ?? 0,
        exerciseType: item.exerciseType ?? 'flashcard',
      })),
    };

    let fsrsResult: any;
    try {
      const response = await fetch(
        `${this.fsrsBaseUrl}/api/v1/fsrs/review/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fsrsPayload),
        },
      );

      if (!response.ok) {
        throw new ApiException({
          statusCode: HttpStatus.BAD_GATEWAY,
          errorCode: 'FSRS_UPSTREAM_ERROR',
          message: 'FSRS-AI service returned an error',
        });
      }

      fsrsResult = await response.json();
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'FSRS_SERVICE_UNAVAILABLE',
        message: 'Failed to connect to FSRS-AI service',
      });
    }

    // 2. Calculate totals
    const totalWords = dto.items.length;
    const correctCount = dto.items.filter((i) => i.isCorrect).length;
    const totalDurationMs = dto.items.reduce(
      (sum, i) => sum + (i.durationMs ?? 0),
      0,
    );

    // 3. Create PracticeSession
    const session = await this.prisma.practiceSession.create({
      data: {
        userId,
        type: 'FSRS',
        totalWords,
        correctCount,
        totalDurationMs,
        startedAt,
        completedAt: new Date(),
      },
    });

    // 4. Record streak activity
    await this.streakService.recordActivity(userId);

    return {
      session,
      fsrsResult,
    };
  }

  // ═══ LESSON PRACTICE (Learn / Học mới) ════════════════════════════════════

  async submitLesson(userId: string, dto: SubmitLessonPracticeDto) {
    // 1. Verify lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      include: { words: { select: { id: true } } },
    });

    if (!lesson) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'LESSON_NOT_FOUND',
        message: `Lesson with ID ${dto.lessonId} not found`,
      });
    }

    // 2. Delegate to existing ProgressService
    const progressResult = await this.progressService.completeLesson(
      userId,
      dto.lessonId,
      dto.score ?? 0,
    );

    // 3. Init FSRS cards for newly unlocked words (call FSRS-AI service)
    if (lesson.words.length > 0) {
      try {
        const wordIds = lesson.words.map((w) => w.id);
        // Build URL with repeated query params
        const url = new URL(`${this.fsrsBaseUrl}/api/v1/fsrs/init-cards`);
        url.searchParams.set('user_id', userId);
        wordIds.forEach((id) =>
          url.searchParams.append('word_ids', String(id)),
        );
        await fetch(url.toString(), { method: 'POST' });
      } catch {
        // Non-critical: FSRS card init can happen later
      }
    }

    // 4. Create PracticeSession
    const session = await this.prisma.practiceSession.create({
      data: {
        userId,
        type: 'LEARN_LESSON',
        lessonId: dto.lessonId,
        totalWords: lesson.words.length,
        completedAt: new Date(),
      },
    });

    // 5. Record streak activity
    await this.streakService.recordActivity(userId);

    return {
      session,
      progressResult,
    };
  }

  // ═══ HISTORY ══════════════════════════════════════════════════════════════

  async getHistory(userId: string, filter: PracticeHistoryFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.PracticeSessionWhereInput = { userId };

    if (filter.type) {
      where.type = filter.type as any;
    }

    const orderBy: Prisma.PracticeSessionOrderByWithRelationInput = {
      [filter.sortBy ?? 'startedAt']: filter.sortOrder ?? 'desc',
    };

    const findManyArgs: Prisma.PracticeSessionFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
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
      this.prisma.practiceSession.findMany(findManyArgs),
      this.prisma.practiceSession.count({ where }),
    ]);

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor =
      hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return { data, pagination: { nextCursor, hasMore, total } };
  }
}

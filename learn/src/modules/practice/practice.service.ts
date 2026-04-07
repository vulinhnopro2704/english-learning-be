import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import { StreakService } from '../streak/streak.service';
import {
  SubmitFSRSPracticeDto,
  PracticeHistoryFilterDto,
  FSRSDueFilterDto,
  FSRSRiskFilterDto,
} from './dtos/practice.dto';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);
  private readonly fsrsBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
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

  async getDueWords(userId: string, filter: FSRSDueFilterDto) {
    const dueUrl = new URL(`${this.fsrsBaseUrl}/api/v1/fsrs/due`);
    dueUrl.searchParams.set('user_id', userId);
    if (typeof filter.take === 'number') {
      dueUrl.searchParams.set('limit', String(filter.take));
    }

    let duePayload: any;
    try {
      const response = await fetch(dueUrl.toString(), { method: 'GET' });

      if (!response.ok) {
        throw new ApiException({
          statusCode: HttpStatus.BAD_GATEWAY,
          errorCode: 'FSRS_UPSTREAM_ERROR',
          message: 'FSRS-AI service returned an error',
        });
      }

      duePayload = await response.json();
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'FSRS_SERVICE_UNAVAILABLE',
        message: 'Failed to connect to FSRS-AI service',
      });
    }

    const upstreamWordIds =
      duePayload?.word_ids ??
      duePayload?.wordIds ??
      duePayload?.data?.word_ids ??
      duePayload?.data?.wordIds;
    const wordIds: number[] = Array.isArray(upstreamWordIds)
      ? upstreamWordIds
          .map((value: unknown) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    if (wordIds.length === 0) {
      return { data: [], total: 0 };
    }

    const progresses = await this.prisma.userWordProgress.findMany({
      where: {
        userId,
        wordId: { in: wordIds },
      },
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

    const byId = new Map(progresses.map((p) => [p.wordId, p]));
    const ordered = wordIds
      .map((id) => byId.get(id))
      .filter((item): item is (typeof progresses)[number] => Boolean(item));

    return { data: ordered, total: duePayload?.total ?? ordered.length };
  }

  async submitFSRS(userId: string, dto: SubmitFSRSPracticeDto) {
    const startedAt = new Date();

    // 1. Call FSRS-AI service for bulk review
    const fsrsPayload = {
      userId: userId,
      items: dto.items.map((item) => ({
        wordId: item.wordId,
        isCorrect: item.isCorrect,
        durationMs: item.durationMs,
        exerciseType: item.exerciseType.toUpperCase(),
        attempts: item.attempts ?? 1,
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
    let session: Awaited<
      ReturnType<typeof this.prisma.practiceSession.create>
    > | null = null;
    try {
      session = await this.prisma.practiceSession.create({
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
    } catch (error) {
      this.logger.warn(
        `Failed creating FSRS practice session for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // 4. Record streak activity
    try {
      await this.streakService.recordActivity(userId);
    } catch (error) {
      this.logger.warn(
        `Failed recording streak for user ${userId} after FSRS session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      session,
      fsrsResult,
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

  // ═══ FSRS RISK CARDS ══════════════════════════════════════════════════════
  
  async getRiskCards(userId: string, filter: FSRSRiskFilterDto) {
    const riskUrl = new URL(`${this.fsrsBaseUrl}/api/v1/fsrs/cards/risk`);
    riskUrl.searchParams.set('user_id', userId);
    if (typeof filter.take === 'number') {
      riskUrl.searchParams.set('take', String(filter.take));
    }

    let riskPayload: any;
    try {
      const response = await fetch(riskUrl.toString(), { method: 'GET' });

      if (!response.ok) {
        throw new ApiException({
          statusCode: HttpStatus.BAD_GATEWAY,
          errorCode: 'FSRS_UPSTREAM_ERROR',
          message: 'FSRS-AI service returned an error',
        });
      }

      riskPayload = await response.json();
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'FSRS_SERVICE_UNAVAILABLE',
        message: 'Failed to connect to FSRS-AI service',
      });
    }

    const items = riskPayload?.metrics?.items ?? [];
    if (!items || items.length === 0) {
      return riskPayload;
    }

    const wordIds: number[] = items
      .map((i: any) => Number(i.wordId))
      .filter((value: number) => Number.isInteger(value) && value > 0);

    let words: Record<string, any>[] = [];
    if (wordIds.length > 0) {
      words = await this.prisma.word.findMany({
        where: { id: { in: wordIds } },
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
      });
    }

    const byId = new Map(words.map((w) => [w.id, w]));

    return {
      ...riskPayload,
      metrics: {
        ...riskPayload.metrics,
        items: items.map((item: any) => ({
          ...item,
          word: byId.get(item.wordId) ?? null,
        })),
      },
    };
  }
}

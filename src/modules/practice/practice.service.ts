import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StreakService } from '../streak/streak.service';
import { RedisService, CACHE_TTL_SECONDS } from '../../redis/redis.service';
import { FsrsSchedulerService } from '../fsrs/services/fsrs-scheduler.service';
import { FsrsReportService } from '../fsrs/services/fsrs-report.service';
import type { ExerciseType } from '../fsrs/dtos';
import {
  SubmitFSRSPracticeDto,
  PracticeHistoryFilterDto,
  FSRSDueFilterDto,
  FSRSRiskFilterDto,
} from './dtos/practice.dto';
import type { Prisma, PracticeType } from '../../database/generated/prisma/client';

@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly streakService: StreakService,
    private readonly redisService: RedisService,
    private readonly fsrsSchedulerService: FsrsSchedulerService,
    private readonly fsrsReportService: FsrsReportService,
  ) {}

  private async invalidateUserCaches(userId: string) {
    await this.redisService.delByPatterns([
      this.redisService.buildScopePattern('practice', userId),
      this.redisService.buildScopePattern('progress', userId),
      this.redisService.buildScopePattern('streak', userId),
      this.redisService.buildScopePattern('courses', userId),
      this.redisService.buildScopePattern('lessons', userId),
      this.redisService.buildScopePattern('words'),
    ]);
  }

  // FSRS PRACTICE (Review)

  async getDueWords(userId: string, filter: FSRSDueFilterDto) {
    const cacheKey = this.redisService.buildCacheKey('practice', {
      userId,
      params: {
        endpoint: 'getDueWords',
        filter: filter as unknown as Record<string, unknown>,
      },
    });

    const cached =
      await this.redisService.getJson<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    const limit = filter.take ?? 20;
    const dueResult = await this.fsrsSchedulerService.getDueCards(userId, limit);
    const wordIds = dueResult.wordIds;

    if (wordIds.length === 0) {
      const emptyResponse = { data: [], total: 0 };
      await this.redisService.setJson(
        cacheKey,
        emptyResponse,
        CACHE_TTL_SECONDS.SHORT,
      );
      return emptyResponse;
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

    const response = {
      data: ordered,
      total: dueResult.total,
    };

    await this.redisService.setJson(
      cacheKey,
      response,
      CACHE_TTL_SECONDS.SHORT,
    );

    return response;
  }

  async submitFSRS(userId: string, dto: SubmitFSRSPracticeDto) {
    const startedAt = new Date();

    // 1. Process reviews via internal FSRS scheduling engine
    const fsrsResult = await this.fsrsSchedulerService.reviewBulk({
      userId,
      items: dto.items.map((item) => ({
        wordId: item.wordId,
        isCorrect: item.isCorrect,
        durationMs: item.durationMs,
        exerciseType: item.exerciseType as ExerciseType,
        attempts: item.attempts ?? 1,
      })),
    });

    // 2. Calculate totals
    const totalWords = dto.items.length;
    const correctCount = dto.items.filter((i) => i.isCorrect).length;
    const totalDurationMs = dto.items.reduce(
      (sum, i) => sum + (i.durationMs ?? 0),
      0,
    );

    // 3. Create PracticeSession record
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

    const response = {
      session,
      fsrsResult,
    };

    await this.invalidateUserCaches(userId);

    return response;
  }

  // Practice History

  async getHistory(userId: string, filter: PracticeHistoryFilterDto) {
    const cacheKey = this.redisService.buildCacheKey('practice', {
      userId,
      params: {
        endpoint: 'getHistory',
        filter: filter as unknown as Record<string, unknown>,
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
    const where: Prisma.PracticeSessionWhereInput = { userId };

    if (filter.type) {
      where.type = filter.type as PracticeType;
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

    const response = { data, pagination: { nextCursor, hasMore, total } };

    await this.redisService.setJson(
      cacheKey,
      response,
      CACHE_TTL_SECONDS.SHORT,
    );

    return response;
  }

  // FSRS Risk Cards

  async getRiskCards(userId: string, filter: FSRSRiskFilterDto) {
    const cacheKey = this.redisService.buildCacheKey('practice', {
      userId,
      params: {
        endpoint: 'getRiskCards',
        filter: filter as unknown as Record<string, unknown>,
      },
    });

    const cached =
      await this.redisService.getJson<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    const take = filter.take ?? 20;
    const riskPayload = await this.fsrsReportService.getRiskCards(userId, take);
    const items = riskPayload.metrics.items;

    if (items.length === 0) {
      await this.redisService.setJson(
        cacheKey,
        riskPayload,
        CACHE_TTL_SECONDS.SHORT,
      );
      return riskPayload;
    }

    const wordIds = items.map((i) => i.wordId);

    const words = await this.prisma.word.findMany({
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

    const byId = new Map(words.map((w) => [w.id, w]));

    const response = {
      ...riskPayload,
      metrics: {
        items: items.map((item) => ({
          ...item,
          word: byId.get(item.wordId) ?? null,
        })),
      },
    };

    await this.redisService.setJson(
      cacheKey,
      response,
      CACHE_TTL_SECONDS.SHORT,
    );

    return response;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService, CACHE_TTL_SECONDS } from '../../redis/redis.service';

@Injectable()
export class StreakService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private async invalidateUserCaches(userId: string) {
    await this.redisService.delByPatterns([
      this.redisService.buildScopePattern('streak', userId),
      this.redisService.buildScopePattern('progress', userId),
      this.redisService.buildScopePattern('practice', userId),
    ]);
  }

  async getStreak(userId: string) {
    const cacheKey = this.redisService.buildCacheKey('streak', {
      userId,
      params: { endpoint: 'getStreak' },
    });

    const cached = await this.redisService.getJson<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    const streak = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      const response = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
      };

      await this.redisService.setJson(cacheKey, response, CACHE_TTL_SECONDS.SHORT);
      return response;
    }

    await this.redisService.setJson(cacheKey, streak, CACHE_TTL_SECONDS.SHORT);
    return streak;
  }

  async recordActivity(userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const existing = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    if (!existing) {
      const created = await this.prisma.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActivity: now,
        },
      });

      await this.invalidateUserCaches(userId);
      return created;
    }

    const lastActivityDate = new Date(existing.lastActivity);
    const lastActivityDay = new Date(
      lastActivityDate.getFullYear(),
      lastActivityDate.getMonth(),
      lastActivityDate.getDate(),
    );

    if (lastActivityDay.getTime() === todayStart.getTime()) {
      return existing;
    }

    let newStreak: number;
    if (lastActivityDay.getTime() === yesterdayStart.getTime()) {
      newStreak = existing.currentStreak + 1;
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(existing.longestStreak, newStreak);

    const updated = await this.prisma.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivity: now,
      },
    });

    await this.invalidateUserCaches(userId);
    return updated;
  }
}

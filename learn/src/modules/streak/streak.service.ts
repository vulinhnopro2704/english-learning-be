import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class StreakService {
  constructor(private readonly prisma: PrismaService) {}

  async getStreak(userId: string) {
    const streak = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
      };
    }

    return streak;
  }

  async recordActivity(userId: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const existing = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    if (!existing) {
      // First activity ever
      return this.prisma.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActivity: now,
        },
      });
    }

    const lastActivityDate = new Date(existing.lastActivity);
    const lastActivityDay = new Date(
      lastActivityDate.getFullYear(),
      lastActivityDate.getMonth(),
      lastActivityDate.getDate(),
    );

    // Already recorded today
    if (lastActivityDay.getTime() === todayStart.getTime()) {
      return existing;
    }

    let newStreak: number;

    if (lastActivityDay.getTime() === yesterdayStart.getTime()) {
      // Consecutive day → increment streak
      newStreak = existing.currentStreak + 1;
    } else {
      // Streak broken → reset to 1
      newStreak = 1;
    }

    const newLongest = Math.max(existing.longestStreak, newStreak);

    return this.prisma.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivity: now,
      },
    });
  }
}

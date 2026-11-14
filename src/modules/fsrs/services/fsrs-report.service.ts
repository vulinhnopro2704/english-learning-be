import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface RiskCardItem {
  wordId: number;
  riskScore: number;
  retrievability: number;
  stability: number;
  daysOverdue: number;
}

export interface RiskCardsResponse {
  metrics: {
    items: RiskCardItem[];
  };
}

@Injectable()
export class FsrsReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates memory and retention insights over a time window (7d, 30d, 90d).
   */
  async getInsights(userId: string, window = '30d') {
    const days = window === '7d' ? 7 : window === '90d' ? 90 : 30;
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400 * 1000);

    const [currentLogs, cardStates] = await Promise.all([
      this.prisma.reviewLog.findMany({
        where: {
          userId,
          reviewedAt: { gte: start, lte: now },
        },
        select: { grade: true },
      }),
      this.prisma.cardMemoryState.findMany({
        where: { userId },
        select: { state: true, retrievability: true, nextReview: true },
      }),
    ]);

    const totalReviews = currentLogs.length;
    const correctReviews = currentLogs.filter((l) => l.grade >= 2).length;
    const retentionRate = totalReviews > 0 ? Number((correctReviews / totalReviews).toFixed(4)) : 0.0;

    const avgRetrievability =
      cardStates.length > 0
        ? cardStates.reduce((acc, c) => acc + c.retrievability, 0) / cardStates.length
        : 1.0;

    const memoryScore = Math.min(
      100,
      Math.max(0, Math.round(retentionRate * 100 * 0.6 + avgRetrievability * 100 * 0.4)),
    );

    const in7Days = new Date(now.getTime() + 7 * 86400 * 1000);
    const next7dDue = cardStates.filter((c) => c.nextReview && c.nextReview <= in7Days).length;

    const tomorrow = new Date(now.getTime() + 86400 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dueTomorrow = cardStates.filter((c) => {
      if (!c.nextReview) return false;
      return c.nextReview.toISOString().split('T')[0] === tomorrowStr;
    }).length;

    const stateDistribution = {
      new: cardStates.filter((c) => c.state === 0).length,
      learning: cardStates.filter((c) => c.state === 1).length,
      review: cardStates.filter((c) => c.state === 2).length,
      relearning: cardStates.filter((c) => c.state === 3).length,
    };

    return {
      window,
      retentionRate,
      avgRetrievability: Number(avgRetrievability.toFixed(4)),
      memoryScore,
      totalCards: cardStates.length,
      totalReviews,
      dueTomorrow,
      next7dDue,
      stateDistribution,
    };
  }

  /**
   * Forecasts due cards for each of the upcoming 14 days.
   */
  async getDailyReport(userId: string) {
    const cardStates = await this.prisma.cardMemoryState.findMany({
      where: {
        userId,
        nextReview: { not: null },
      },
      select: { nextReview: true },
    });

    const now = new Date();
    const forecast: Array<{ date: string; dueCount: number }> = [];

    for (let i = 0; i < 14; i++) {
      const day = new Date(now.getTime() + i * 86400 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      const count = cardStates.filter((c) => c.nextReview?.toISOString().split('T')[0] === dayStr).length;
      forecast.push({ date: dayStr, dueCount: count });
    }

    return { forecast };
  }

  /**
   * Retrieves high-risk cards based on retrievability and overdue status.
   */
  async getRiskCards(userId: string, take = 20): Promise<RiskCardsResponse> {
    const now = new Date();
    const limit = Math.max(1, Math.min(100, take * 4));

    const cards = await this.prisma.cardMemoryState.findMany({
      where: { userId },
      orderBy: { retrievability: 'asc' },
      take: limit,
    });

    const items: RiskCardItem[] = cards.map((card) => {
      const retrievability = card.retrievability ?? 0;
      let daysOverdue = 0;
      if (card.nextReview && card.nextReview.getTime() < now.getTime()) {
        daysOverdue = Math.max(
          0,
          Math.floor((now.getTime() - card.nextReview.getTime()) / (86400 * 1000)),
        );
      }

      const overdueFactor = Math.min(1.0, daysOverdue / 10);
      const riskScore = Number(
        Math.min(1.0, (1 - retrievability) * 0.7 + overdueFactor * 0.3).toFixed(4),
      );

      return {
        wordId: card.wordId,
        riskScore,
        retrievability: Number(retrievability.toFixed(4)),
        stability: Number((card.stability ?? 0).toFixed(2)),
        daysOverdue,
      };
    });

    items.sort((a, b) => {
      if (b.riskScore !== a.riskScore) {
        return b.riskScore - a.riskScore;
      }
      return b.daysOverdue - a.daysOverdue;
    });

    const topItems = items.slice(0, Math.max(1, Math.min(100, take)));

    return {
      metrics: { items: topItems },
    };
  }
}

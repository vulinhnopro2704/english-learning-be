import { Injectable, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_FSRS_PARAMETERS,
  FSRS_TRAINING_POLICY,
} from '../fsrs.constants';

export interface OptimizationResult {
  status: 'optimized' | 'skipped' | 'error';
  accepted: boolean;
  reason?: string;
  newWeights: number[];
  optimalRetention?: number;
  modelVersion?: number;
  sampleSize: number;
}

@Injectable()
export class FsrsOptimizerService {
  private readonly logger = new Logger(FsrsOptimizerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Optimizes FSRS parameters using historical review logs with Rust WASI binding.
   */
  async optimizeParameters(userId: string): Promise<OptimizationResult> {
    const config = await this.getOrCreateConfig(userId);

    const logs = await this.prisma.reviewLog.findMany({
      where: {
        userId,
        grade: { in: [1, 2, 3, 4] },
        durationMs: { gt: 0 },
      },
      orderBy: { reviewedAt: 'asc' },
    });

    const sampleSize = logs.length;
    if (sampleSize < FSRS_TRAINING_POLICY.MIN_VALID_LOGS) {
      return {
        status: 'skipped',
        accepted: false,
        reason: `insufficient_logs:${sampleSize}<${FSRS_TRAINING_POLICY.MIN_VALID_LOGS}`,
        newWeights: [],
        sampleSize,
      };
    }

    if (config.lastTrainedAt) {
      const daysSinceLast = (Date.now() - config.lastTrainedAt.getTime()) / (1000 * 86400);
      if (daysSinceLast < FSRS_TRAINING_POLICY.MIN_DAYS_SINCE_LAST) {
        return {
          status: 'skipped',
          accepted: false,
          reason: `cooldown:${daysSinceLast.toFixed(1)}d<${FSRS_TRAINING_POLICY.MIN_DAYS_SINCE_LAST}d`,
          newWeights: [],
          sampleSize,
        };
      }
    }

    try {
      const binding = await import('@open-spaced-repetition/binding');

      // Group logs by wordId
      const grouped = new Map<number, typeof logs>();
      for (const log of logs) {
        if (!grouped.has(log.wordId)) {
          grouped.set(log.wordId, []);
        }
        grouped.get(log.wordId)!.push(log);
      }

      const items: any[] = [];
      for (const cardLogs of grouped.values()) {
        cardLogs.sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());
        const reviews: any[] = [];
        let prevTime = cardLogs[0].reviewedAt.getTime();

        for (const log of cardLogs) {
          const elapsedDays = Math.max(0, (log.reviewedAt.getTime() - prevTime) / (1000 * 86400));
          prevTime = log.reviewedAt.getTime();
          reviews.push(new binding.FSRSBindingReview(log.grade, elapsedDays));
        }

        if (reviews.length > 0) {
          items.push(new binding.FSRSBindingItem(reviews));
        }
      }

      const optimalParameters = await binding.computeParameters(items, {
        enableShortTerm: true,
        modelVersion: 'FSRS-6',
      });

      const candidateWeights = Array.from(optimalParameters).map(Number);
      const nextVersion = (config.currentModelVersion || 0) + 1;
      const now = new Date();

      await this.prisma.$transaction([
        this.prisma.fSRSModelVersion.create({
          data: {
            id: uuidv7(),
            userId,
            version: nextVersion,
            weights: candidateWeights,
            requestRetention: config.requestRetention,
            sampleSize,
            metricType: 'log_loss',
            status: 'accepted',
            trainedAt: now,
            createdAt: now,
          },
        }),
        this.prisma.fSRSConfig.update({
          where: { userId },
          data: {
            weights: candidateWeights,
            currentModelVersion: nextVersion,
            lastTrainedAt: now,
          },
        }),
      ]);

      this.logger.log(`Successfully optimized FSRS parameters for user ${userId} (version ${nextVersion})`);

      return {
        status: 'optimized',
        accepted: true,
        newWeights: candidateWeights,
        optimalRetention: config.requestRetention,
        modelVersion: nextVersion,
        sampleSize,
      };
    } catch (error) {
      this.logger.error(
        `Failed to compute FSRS parameters for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        status: 'error',
        accepted: false,
        reason: error instanceof Error ? error.message : 'optimizer_failure',
        newWeights: [],
        sampleSize,
      };
    }
  }

  /**
   * Rolls back user's FSRS model to a previous version or defaults.
   */
  async rollbackModel(userId: string, targetVersion?: number) {
    const config = await this.getOrCreateConfig(userId);

    let targetModel: any = null;
    if (targetVersion) {
      targetModel = await this.prisma.fSRSModelVersion.findFirst({
        where: { userId, version: targetVersion },
      });
    } else {
      targetModel = await this.prisma.fSRSModelVersion.findFirst({
        where: {
          userId,
          version: { lt: config.currentModelVersion },
        },
        orderBy: { version: 'desc' },
      });
    }

    const newWeights = targetModel ? (targetModel.weights as number[]) : DEFAULT_FSRS_PARAMETERS;
    const newVersion = targetModel ? targetModel.version : 0;

    await this.prisma.fSRSConfig.update({
      where: { userId },
      data: {
        weights: newWeights,
        currentModelVersion: newVersion,
      },
    });

    return {
      success: true,
      currentVersion: newVersion,
      weights: newWeights,
    };
  }

  private async getOrCreateConfig(userId: string) {
    let config = await this.prisma.fSRSConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      config = await this.prisma.fSRSConfig.create({
        data: {
          userId,
          weights: DEFAULT_FSRS_PARAMETERS,
          requestRetention: 0.9,
          easyDays: [],
          maxReviewsPerDay: 100,
          currentModelVersion: 0,
        },
      });
    }

    return config;
  }
}

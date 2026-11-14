import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import {
  fsrs,
  generatorParameters,
  Rating,
  createEmptyCard,
  type Card,
  type RecordLogItem,
} from 'ts-fsrs';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../../../database/prisma.service';
import { ApiException } from '../../../common/exceptions/api.exception';
import {
  GRADE_THRESHOLDS,
  DEFAULT_THRESHOLD,
  DEFAULT_FSRS_PARAMETERS,
} from '../fsrs.constants';
import {
  ReviewRequestDto,
  BulkReviewRequestDto,
  ExerciseType,
} from '../dtos';

export interface CardStateResult {
  wordId: number;
  state: number;
  difficulty: number;
  stability: number;
  retrievability: number;
  nextReview: Date | null;
  reps: number;
  lapses: number;
  grade: number;
}

/**
 * FSRS Spaced Repetition Scheduling Service.
 * Implements Free Spaced Repetition Scheduler algorithm using ts-fsrs.
 */
@Injectable()
export class FsrsSchedulerService {
  private readonly logger = new Logger(FsrsSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Automatically calculates FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy) based on answer correctness,
   * response duration in milliseconds, and the exercise type.
   */
  autoGrade(
    isCorrect: boolean,
    durationMs: number,
    exerciseType: ExerciseType | string,
    attempts = 1,
  ): Rating {
    if (!isCorrect || attempts > 2) {
      return Rating.Again;
    }

    if (attempts === 2) {
      return Rating.Hard;
    }

    if (durationMs <= 0) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'INVALID_DURATION',
        message: 'durationMs must be greater than 0',
      });
    }

    const typeKey = String(exerciseType).toUpperCase();
    const thresholds = GRADE_THRESHOLDS[typeKey] || DEFAULT_THRESHOLD;

    if (durationMs <= thresholds.easyMaxMs) {
      return Rating.Easy;
    }
    if (durationMs >= thresholds.hardMinMs) {
      return Rating.Hard;
    }
    return Rating.Good;
  }

  /**
   * Retrieves list of word IDs due for review for a user, respecting daily review limits.
   */
  async getDueCards(userId: string, limit = 20): Promise<{ wordIds: number[]; total: number }> {
    const config = await this.prisma.fSRSConfig.findUnique({
      where: { userId },
    });
    const maxReviews = config?.maxReviewsPerDay ?? 100;
    const effectiveLimit = Math.min(limit, maxReviews);

    const now = new Date();

    const [states, total] = await Promise.all([
      this.prisma.cardMemoryState.findMany({
        where: {
          userId,
          OR: [{ nextReview: { lte: now } }, { nextReview: null }],
        },
        orderBy: [{ nextReview: 'asc' }],
        take: effectiveLimit,
        select: { wordId: true },
      }),
      this.prisma.cardMemoryState.count({
        where: {
          userId,
          OR: [{ nextReview: { lte: now } }, { nextReview: null }],
        },
      }),
    ]);

    return {
      wordIds: states.map((s) => s.wordId),
      total,
    };
  }

  /**
   * Processes a single word review result and updates memory state & review log.
   */
  async reviewCard(dto: ReviewRequestDto): Promise<CardStateResult> {
    const grade = this.autoGrade(dto.isCorrect, dto.durationMs, dto.exerciseType, dto.attempts);

    const config = await this.prisma.fSRSConfig.findUnique({
      where: { userId: dto.userId },
    });

    const f = this.buildScheduler(config);

    const existingState = await this.prisma.cardMemoryState.findUnique({
      where: {
        uq_user_word: {
          userId: dto.userId,
          wordId: dto.wordId,
        },
      },
    });

    const card: Card = this.cardFromDb(existingState);
    const now = new Date();
    const item: RecordLogItem = f.next(card, now, grade as 1 | 2 | 3 | 4);

    const newCard = item.card;
    const retrievability = f.retrievability(newCard, now) ?? 1.0;

    const previousReps = existingState?.reps ?? 0;
    const previousLapses = existingState?.lapses ?? 0;
    const wasLapse = grade === Rating.Again && card.state === 2; // Review state -> Again is a lapse

    const reps = previousReps + 1;
    const lapses = previousLapses + (wasLapse ? 1 : 0);

    const elapsedDays = (now.getTime() - (existingState?.lastReviewedAt?.getTime() ?? now.getTime())) / (1000 * 86400);
    const scheduledDays = (newCard.due.getTime() - now.getTime()) / (1000 * 86400);

    // Save state and review log in a transaction
    await this.prisma.$transaction([
      this.prisma.cardMemoryState.upsert({
        where: {
          uq_user_word: {
            userId: dto.userId,
            wordId: dto.wordId,
          },
        },
        create: {
          id: uuidv7(),
          userId: dto.userId,
          wordId: dto.wordId,
          state: newCard.state,
          difficulty: newCard.difficulty,
          stability: newCard.stability,
          retrievability,
          nextReview: newCard.due,
          lastReviewedAt: now,
          reps,
          lapses,
          cardData: JSON.parse(JSON.stringify(newCard)),
        },
        update: {
          state: newCard.state,
          difficulty: newCard.difficulty,
          stability: newCard.stability,
          retrievability,
          nextReview: newCard.due,
          lastReviewedAt: now,
          reps,
          lapses,
          cardData: JSON.parse(JSON.stringify(newCard)),
        },
      }),
      this.prisma.reviewLog.create({
        data: {
          id: uuidv7(),
          userId: dto.userId,
          wordId: dto.wordId,
          grade,
          durationMs: dto.durationMs,
          state: card.state,
          difficulty: card.difficulty,
          stability: card.stability,
          elapsedDays: Math.max(0, elapsedDays),
          scheduledDays: Math.max(0, scheduledDays),
          reviewedAt: now,
          logData: {
            review: JSON.parse(JSON.stringify(item.log)),
            event: {
              exerciseType: dto.exerciseType,
              isCorrect: dto.isCorrect,
              attempts: dto.attempts ?? 1,
            },
          },
        },
      }),
    ]);

    return {
      wordId: dto.wordId,
      state: newCard.state,
      difficulty: Number(newCard.difficulty.toFixed(4)),
      stability: Number(newCard.stability.toFixed(4)),
      retrievability: Number(retrievability.toFixed(4)),
      nextReview: newCard.due,
      reps,
      lapses,
      grade,
    };
  }

  /**
   * Processes a bulk batch of review results from a completed practice session.
   */
  async reviewBulk(dto: BulkReviewRequestDto): Promise<{ processed: number; cards: CardStateResult[] }> {
    const results: CardStateResult[] = [];

    for (const item of dto.items) {
      const res = await this.reviewCard({
        userId: dto.userId,
        wordId: item.wordId,
        isCorrect: item.isCorrect,
        durationMs: item.durationMs,
        exerciseType: item.exerciseType,
        attempts: item.attempts,
        hadWrong: item.hadWrong,
      });
      results.push(res);
    }

    return {
      processed: results.length,
      cards: results,
    };
  }

  /**
   * Initializes flashcards in FSRS as state=0 (NEW) when a user completes a lesson.
   */
  async initCards(userId: string, wordIds: number[]): Promise<{ initialized: number }> {
    if (!wordIds || wordIds.length === 0) {
      return { initialized: 0 };
    }

    const existing = await this.prisma.cardMemoryState.findMany({
      where: {
        userId,
        wordId: { in: wordIds },
      },
      select: { wordId: true },
    });

    const existingSet = new Set(existing.map((e) => e.wordId));
    const newWordIds = wordIds.filter((id) => !existingSet.has(id));

    if (newWordIds.length === 0) {
      return { initialized: 0 };
    }

    const defaultCard = createEmptyCard();

    await this.prisma.cardMemoryState.createMany({
      data: newWordIds.map((wordId) => ({
        id: uuidv7(),
        userId,
        wordId,
        state: 0,
        difficulty: 0.0,
        stability: 0.0,
        retrievability: 1.0,
        nextReview: null,
        reps: 0,
        lapses: 0,
        cardData: JSON.parse(JSON.stringify(defaultCard)),
      })),
    });

    return { initialized: newWordIds.length };
  }

  /**
   * Returns summary counts of user's cards across states (New, Learning, Review, Relearning, Due).
   */
  async getStats(userId: string) {
    const now = new Date();

    const [allStates, dueCount] = await Promise.all([
      this.prisma.cardMemoryState.findMany({
        where: { userId },
        select: { state: true },
      }),
      this.prisma.cardMemoryState.count({
        where: {
          userId,
          OR: [{ nextReview: { lte: now } }, { nextReview: null }],
        },
      }),
    ]);

    const stats = {
      total: allStates.length,
      new: 0,
      learning: 0,
      review: 0,
      relearning: 0,
      due: dueCount,
    };

    for (const card of allStates) {
      if (card.state === 0) stats.new++;
      else if (card.state === 1) stats.learning++;
      else if (card.state === 2) stats.review++;
      else if (card.state === 3) stats.relearning++;
    }

    return stats;
  }

  /**
   * Returns list of words most at risk of forgetting (lowest retrievability).
   */
  async getCardsRisk(userId: string, limit = 10) {
    return this.prisma.cardMemoryState.findMany({
      where: {
        userId,
        state: { in: [1, 2, 3] }, // Only cards that have been studied
      },
      orderBy: { retrievability: 'asc' },
      take: limit,
      select: {
        wordId: true,
        state: true,
        retrievability: true,
        difficulty: true,
        stability: true,
        nextReview: true,
        reps: true,
        lapses: true,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Private Utilities
  // ══════════════════════════════════════════════════════════════════════════

  private buildScheduler(config: { weights?: any; requestRetention?: number } | null) {
    const requestRetention = config?.requestRetention ?? 0.9;
    return fsrs(
      generatorParameters({
        request_retention: requestRetention,
        enable_fuzz: true,
      }),
    );
  }

  private cardFromDb(state: { cardData?: any } | null): Card {
    if (state?.cardData && typeof state.cardData === 'object') {
      const data = state.cardData as Record<string, unknown>;
      const empty = createEmptyCard();
      return {
        ...empty,
        due: data.due ? new Date(data.due as string) : empty.due,
        stability: Number(data.stability ?? empty.stability),
        difficulty: Number(data.difficulty ?? empty.difficulty),
        scheduled_days: Number(data.scheduled_days ?? empty.scheduled_days),
        learning_steps: Number(data.learning_steps ?? empty.learning_steps),
        reps: Number(data.reps ?? empty.reps),
        lapses: Number(data.lapses ?? empty.lapses),
        state: (Number(data.state ?? empty.state) as 0 | 1 | 2 | 3),
        last_review: data.last_review ? new Date(data.last_review as string) : undefined,
      };
    }
    return createEmptyCard();
  }
}

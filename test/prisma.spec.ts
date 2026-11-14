import { describe, it, expect } from 'vitest';
import { PrismaClient } from '../src/database/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

describe('Prisma Connection & Multi-Schema Test', () => {
  it('should query all schemas from Neon DB without error', async () => {
    const connectionString =
      'postgresql://neondb_owner:npg_pRZtXzqJL9i8@ep-shy-tree-a1gw0qk5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    const [users, words, lessons, cardStates, reviewLogs, listeningLessons, blanks] =
      await Promise.all([
        prisma.user.count(),
        prisma.word.count(),
        prisma.lesson.count(),
        prisma.cardMemoryState.count(),
        prisma.reviewLog.count(),
        prisma.listeningLesson.count(),
        prisma.segmentBlank.count(),
      ]);

    expect(users).toBeGreaterThan(0);
    expect(words).toBeGreaterThan(0);
    expect(lessons).toBeGreaterThan(0);
    expect(cardStates).toBeGreaterThan(0);
    expect(reviewLogs).toBeGreaterThan(0);
    expect(listeningLessons).toBeGreaterThan(0);
    expect(blanks).toBeGreaterThan(0);

    console.log('Neon Database Schema counts:', {
      users,
      words,
      lessons,
      cardStates,
      reviewLogs,
      listeningLessons,
      blanks,
    });

    await prisma.$disconnect();
  }, 30000);
});

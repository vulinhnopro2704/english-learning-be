import { describe, it, expect, beforeAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FsrsSchedulerService } from '../src/modules/fsrs/services/fsrs-scheduler.service';
import { BlankGeneratorService } from '../src/modules/listening/services/blank-generator.service';
import { Rating } from 'ts-fsrs';
import { PrismaService } from '../src/database/prisma.service';

describe('Modular Monolith Core Services Test', () => {
  let fsrsScheduler: FsrsSchedulerService;
  let blankGenerator: BlankGeneratorService;

  beforeAll(async () => {
    // Mock minimal PrismaService for unit isolation
    const mockPrisma = {
      cardMemoryState: {
        findMany: () => Promise.resolve([]),
      },
      fSRSConfig: {
        findUnique: () => Promise.resolve(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FsrsSchedulerService,
        BlankGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    fsrsScheduler = module.get<FsrsSchedulerService>(FsrsSchedulerService);
    blankGenerator = module.get<BlankGeneratorService>(BlankGeneratorService);
  });

  describe('FSRS Scheduling Engine (Replacing Python fsrs-ai)', () => {
    it('should correctly auto-grade fast and accurate responses as Rating.Easy', () => {
      const rating = fsrsScheduler.autoGrade(true, 1500, 'FLASHCARD', 1);
      expect(rating).toBe(Rating.Easy);
    });

    it('should grade correct but medium-speed responses as Rating.Good', () => {
      const goodRating = fsrsScheduler.autoGrade(true, 5000, 'FLASHCARD', 1);
      expect(goodRating).toBe(Rating.Good);
    });

    it('should grade correct but slow responses (>10000ms) as Rating.Hard', () => {
      const hardRating = fsrsScheduler.autoGrade(true, 12000, 'FLASHCARD', 1);
      expect(hardRating).toBe(Rating.Hard);
    });

    it('should grade incorrect or multi-attempt responses as Rating.Again', () => {
      const incorrectRating = fsrsScheduler.autoGrade(false, 3000, 'FLASHCARD', 1);
      expect(incorrectRating).toBe(Rating.Again);

      const lapseRating = fsrsScheduler.autoGrade(true, 2000, 'FLASHCARD', 3);
      expect(lapseRating).toBe(Rating.Again);
    });
  });

  describe('Listening Cloze Engine (Replacing Python listening-service)', () => {
    it('should generate cloze blanks from English transcript segments', () => {
      const segments = [
        {
          id: 1,
          start: 0.0,
          end: 3.5,
          duration: 3.5,
          text: 'Welcome to this advanced English vocabulary lesson for intermediate students.',
        },
      ];

      const processedSegments = blankGenerator.generateBlanks(segments, 'medium');
      expect(processedSegments.length).toBe(1);
      expect(processedSegments[0].blanks.length).toBeGreaterThan(0);

      const firstBlank = processedSegments[0].blanks[0];
      expect(firstBlank).toHaveProperty('originalWord');
      expect(firstBlank).toHaveProperty('index');
      expect(firstBlank).toHaveProperty('hint');
      expect(processedSegments[0].maskedText).toContain('_____');
    });

    it('should not blank out common English stop words', () => {
      const segments = [
        {
          id: 2,
          start: 0.0,
          end: 2.0,
          duration: 2.0,
          text: 'The book is on the table with a pen.',
        },
      ];

      const processedSegments = blankGenerator.generateBlanks(segments, 'hard');
      const blankedWords = processedSegments[0].blanks.map((b) => b.originalWord.toLowerCase());
      expect(blankedWords).not.toContain('the');
      expect(blankedWords).not.toContain('is');
      expect(blankedWords).not.toContain('on');
      expect(blankedWords).not.toContain('a');
    });
  });
});

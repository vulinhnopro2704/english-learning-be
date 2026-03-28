import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';

const noOpDecorator = () => () => undefined;

jest.mock('@english-learning/nest-api-docs', () => ({
  ApiCreatedEntityResponse: noOpDecorator,
  ApiCursorPaginatedResponse: noOpDecorator,
  ApiMessageResponse: noOpDecorator,
  ApiOkEntityResponse: noOpDecorator,
  ApiStandardErrorResponses: noOpDecorator,
}));

jest.mock('@english-learning/nest-error-handler', () => ({
  ApiException: class ApiException extends Error {
    statusCode: number;
    errorCode: string;

    constructor(payload: {
      statusCode: number;
      errorCode: string;
      message: string;
    }) {
      super(payload.message);
      this.statusCode = payload.statusCode;
      this.errorCode = payload.errorCode;
    }
  },
}));

jest.mock('../src/modules/db/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { LessonsController } from '../src/modules/lessons/lessons.controller';
import { LessonsService } from '../src/modules/lessons/lessons.service';
import { PrismaService } from '../src/modules/db/prisma.service';
import { ProgressService } from '../src/modules/progress/progress.service';
import { StreakService } from '../src/modules/streak/streak.service';

describe('LessonsController complete endpoint (e2e)', () => {
  let app: INestApplication<App>;

  const mockProgressService = {
    completeLesson: jest.fn().mockResolvedValue({
      lessonProgress: {
        id: 1,
        userId: '8c530f0c-6355-4c9f-a2c7-e47f6c5c66df',
        lessonId: 10,
        status: 'COMPLETED',
        score: 80,
      },
      wordsUnlocked: 2,
    }),
  };

  const mockPrismaService = {
    word: {
      findMany: jest.fn().mockResolvedValue([{ id: 101 }, { id: 102 }]),
    },
    practiceSession: {
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => ({
        id: 99,
        ...data,
      })),
    },
  };

  const mockStreakService = {
    recordActivity: jest.fn().mockResolvedValue({
      userId: '8c530f0c-6355-4c9f-a2c7-e47f6c5c66df',
      currentStreak: 3,
      longestStreak: 7,
    }),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://fsrs-service'),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LessonsController],
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProgressService, useValue: mockProgressService },
        { provide: StreakService, useValue: mockStreakService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    await app.close();
  });

  it('accepts repeated completion calls (idempotent behavior)', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as unknown as Response);

    const first = await request(app.getHttpServer())
      .post('/lessons/10/complete')
      .set('x-user-id', '8c530f0c-6355-4c9f-a2c7-e47f6c5c66df')
      .send({ score: 80 })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/lessons/10/complete')
      .set('x-user-id', '8c530f0c-6355-4c9f-a2c7-e47f6c5c66df')
      .send({ score: 80 })
      .expect(201);

    expect(first.body.lessonProgress.status).toBe('COMPLETED');
    expect(second.body.lessonProgress.status).toBe('COMPLETED');
    expect(first.body.wordsUnlocked).toBe(2);
    expect(second.body.wordsUnlocked).toBe(2);
    expect(mockProgressService.completeLesson).toHaveBeenCalledTimes(2);
  });

  it('still completes lesson when FSRS init fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('FSRS down'));

    const response = await request(app.getHttpServer())
      .post('/lessons/10/complete')
      .set('x-user-id', '8c530f0c-6355-4c9f-a2c7-e47f6c5c66df')
      .send({ score: 75 })
      .expect(201);

    expect(response.body.lessonProgress.status).toBe('COMPLETED');
    expect(response.body.wordsUnlocked).toBe(2);
    expect(response.body.session.type).toBe('LEARN_LESSON');
    expect(mockPrismaService.practiceSession.create).toHaveBeenCalledTimes(1);
    expect(mockStreakService.recordActivity).toHaveBeenCalledTimes(1);
  });
});

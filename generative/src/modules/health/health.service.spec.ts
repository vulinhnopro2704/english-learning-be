import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { RedisService } from '../redis/redis.service';

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: RedisService,
          useValue: {
            ping: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
  });

  it('returns liveness info', () => {
    expect(healthService.getHealth()).toEqual({
      status: 'ok',
      service: 'generative',
    });
  });

  it('returns readiness info', async () => {
    await expect(healthService.getReadiness()).resolves.toEqual({
      status: 'ready',
      checks: {
        redis: 'ok',
      },
    });
  });
});

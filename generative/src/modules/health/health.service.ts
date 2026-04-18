import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(private readonly redisService: RedisService) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'generative',
    };
  }

  async getReadiness() {
    const redisReady = await this.redisService.ping();
    return {
      status: redisReady ? 'ready' : 'not_ready',
      checks: {
        redis: redisReady ? 'ok' : 'unreachable',
      },
    };
  }
}

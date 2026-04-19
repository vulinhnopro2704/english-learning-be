import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
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
    if (!redisReady) {
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'SERVICE_UNAVAILABLE',
        message: 'Redis dependency is unreachable',
      });
    }

    return {
      status: 'ready',
      checks: {
        redis: 'ok',
      },
    };
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    const redisOptions: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number): number => Math.min(times * 200, 5000),
      lazyConnect: false,
    };

    this.client = new Redis(redisUrl, redisOptions);

    this.client.on('error', (err: Error | string): void => {
      const errorMessage = typeof err === 'string' ? err : err.message;
      this.logger.error(`Redis connection error: ${errorMessage}`);
    });

    this.client.on('connect', (): void => {
      this.logger.log('Redis connected successfully');
    });
  }

  async isTokenBlacklisted(userId: string, jti: string): Promise<boolean> {
    const key = `TOKEN_BLACKLIST_${userId}_${jti}`;
    const result = await this.client.exists(key);
    return result === 1;
  }

  async incrementRateLimit(key: string, ttlSeconds: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return value;
  }

  async isIpBlacklisted(ip: string): Promise<boolean> {
    const keyResult = await this.client.exists(`IP_BLACKLIST_${ip}`);
    if (keyResult === 1) {
      return true;
    }

    const setResult = await this.client.sismember('IP_BLACKLIST', ip);
    return setResult === 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

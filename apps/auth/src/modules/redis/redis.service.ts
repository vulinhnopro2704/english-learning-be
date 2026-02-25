import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: false,
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  async blacklistToken(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    const key = `TOKEN_BLACKLIST_${userId}_${jti}`;
    await this.client.set(key, '1', 'EX', ttlSeconds);
  }

  async isTokenBlacklisted(userId: string, jti: string): Promise<boolean> {
    const key = `TOKEN_BLACKLIST_${userId}_${jti}`;
    const result = await this.client.exists(key);
    return result === 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

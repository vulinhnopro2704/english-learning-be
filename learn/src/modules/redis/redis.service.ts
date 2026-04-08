import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    } else {
      const host = this.configService.get<string>('REDIS_HOST') ?? '127.0.0.1';
      const port = Number(this.configService.get<string>('REDIS_PORT') ?? 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      const db = Number(this.configService.get<string>('REDIS_DB') ?? 0);

      this.client = new Redis({
        host,
        port,
        password,
        db,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }

    this.client.on('error', (error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }

    await this.client.set(key, value);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}

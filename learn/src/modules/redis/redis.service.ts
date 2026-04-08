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
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(
        `Redis get failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
        return;
      }

      await this.client.set(key, value);
    } catch (error) {
      this.logger.warn(
        `Redis set failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async del(key: string) {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis del failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Redis JSON parse failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async delByPattern(pattern: string) {
    try {
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          200,
        );

        if (keys.length > 0) {
          await this.client.del(...keys);
        }

        cursor = nextCursor;
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(
        `Redis delByPattern failed for ${pattern}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async delByPatterns(patterns: string[]) {
    for (const pattern of patterns) {
      await this.delByPattern(pattern);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}

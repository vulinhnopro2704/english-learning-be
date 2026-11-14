import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';

/**
 * Standard TTL constants for cache entries.
 */
export const CACHE_TTL_SECONDS = {
  SHORT: 60, // 1 minute
  MEDIUM: 60 * 5, // 5 minutes
  LONG: 60 * 60 * 24, // 24 hours
} as const;

/**
 * Supported caching scopes across the learning platform.
 */
export type CacheScope =
  | 'courses'
  | 'lessons'
  | 'words'
  | 'vocabulary'
  | 'progress'
  | 'practice'
  | 'streak'
  | 'dictionary'
  | 'listening'
  | 'fsrs';

/**
 * Cached user profile structure.
 */
export interface CachedUserProfile {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  gender?: string | null;
  hobbies?: string[];
  funFact?: string | null;
}

/**
 * Unified Redis Service supporting:
 * - General key-value and JSON caching with TTL
 * - Cache key building and pattern-based invalidation
 * - JWT token revocation (blacklisting)
 * - User profile caching
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      process.env.REDIS_URL ||
      'redis://localhost:6379';

    const redisOptions: RedisOptions = {
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number): number => Math.min(times * 150, 3000),
      lazyConnect: false,
      enableOfflineQueue: false,
    };

    this.client = new Redis(redisUrl, redisOptions);

    this.client.on('error', (err: Error) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis disconnected gracefully');
    } catch (error) {
      this.logger.warn(
        `Error disconnecting Redis: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Key-Value Cache Operations
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Retrieves a string value from Redis.
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(
        `Redis get failed for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Sets a string value in Redis with optional TTL in seconds.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
        return;
      }
      await this.client.set(key, value);
    } catch (error) {
      this.logger.warn(
        `Redis set failed for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Deletes a key from Redis.
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis del failed for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieves and deserializes a JSON object from Redis.
   */
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Redis JSON parse failed for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Serializes and sets a JSON object in Redis with optional TTL in seconds.
   */
  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Deletes all keys matching a specific pattern using SCAN.
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(
        `Redis delByPattern failed for pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Deletes multiple patterns sequentially.
   */
  async delByPatterns(patterns: string[]): Promise<void> {
    await Promise.all(patterns.map((p) => this.delByPattern(p)));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Token Revocation & Profile Operations
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Blacklists a revoked JWT access or refresh token by user ID and JTI.
   */
  async blacklistToken(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    const key = `TOKEN_BLACKLIST_${userId}_${jti}`;
    await this.set(key, '1', ttlSeconds);
  }

  /**
   * Checks whether a token has been blacklisted.
   */
  async isTokenBlacklisted(userId: string, jti: string): Promise<boolean> {
    try {
      const key = `TOKEN_BLACKLIST_${userId}_${jti}`;
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Caches user profile for fast lookup during request processing.
   */
  async cacheUserProfile(userId: string, profile: CachedUserProfile): Promise<void> {
    const key = `USER_PROFILE_${userId}`;
    await this.setJson(key, profile, CACHE_TTL_SECONDS.LONG);
  }

  /**
   * Retrieves cached user profile.
   */
  async getUserProfile(userId: string): Promise<CachedUserProfile | null> {
    const key = `USER_PROFILE_${userId}`;
    return this.getJson<CachedUserProfile>(key);
  }

  /**
   * Invalidates cached user profile.
   */
  async invalidateUserProfile(userId: string): Promise<void> {
    const key = `USER_PROFILE_${userId}`;
    await this.del(key);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Cache Key Building Helpers
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Builds standardized cache key for application scopes.
   * Format: learn:v1:<scope>:u:<userId|public>:q:<paramsHash>
   */
  buildCacheKey(
    scope: CacheScope,
    options?: {
      userId?: string;
      params?: Record<string, unknown>;
    },
  ): string {
    const userSegment = options?.userId?.trim() || 'public';
    const serializedParams = options?.params
      ? encodeURIComponent(JSON.stringify(this.sortObjectKeys(options.params)))
      : 'all';

    return `learn:v1:${scope}:u:${userSegment}:q:${serializedParams}`;
  }

  /**
   * Builds pattern for invalidating all keys under a given scope for a user or all users.
   */
  buildScopePattern(scope: CacheScope, userId?: string): string {
    const userSegment = userId?.trim() ? `u:${userId.trim()}` : '*';
    return `learn:v1:${scope}:${userSegment}*`;
  }

  private sortObjectKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortObjectKeys(item));
    }
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          const nextVal = (value as Record<string, unknown>)[key];
          if (nextVal !== undefined) {
            acc[key] = this.sortObjectKeys(nextVal);
          }
          return acc;
        }, {});
    }
    return value;
  }
}

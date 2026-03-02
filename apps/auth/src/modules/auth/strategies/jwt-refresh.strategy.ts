import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service.js';
import type { JwtPayload } from './jwt.strategy.js';

function extractRefreshToken(req: Request): string | null {
  return (req?.cookies as Record<string, string> | undefined)?.refresh_token ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: extractRefreshToken,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(options);
  }

  async validate(payload: JwtPayload) {
    const isBlacklisted = await this.redisService.isTokenBlacklisted(payload.sub, payload.jti);
    if (isBlacklisted) {
      return null;
    }
    return { id: payload.sub, email: payload.email, jti: payload.jti };
  }
}

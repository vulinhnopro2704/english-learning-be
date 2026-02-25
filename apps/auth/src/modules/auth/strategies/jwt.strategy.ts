import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service.js';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  type: 'access' | 'refresh';
}

function extractAccessToken(req: Request): string | null {
  return (req?.cookies as Record<string, string> | undefined)?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: extractAccessToken,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
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

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  type: 'access' | 'refresh';
}

function extractAccessToken(req: Request): string | null {
  return (
    (req?.cookies as Record<string, string> | undefined)?.access_token ?? null
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: extractAccessToken,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    };
    super(options);
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email, jti: payload.jti };
  }
}

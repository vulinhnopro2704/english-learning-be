import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ApiException } from '../exceptions/api.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RedisService } from '../../redis/redis.service';
import type { CurrentUser } from '../types/api.types';

interface JwtTokenPayload {
  sub: string;
  email: string;
  role?: string;
  jti: string;
  type: string;
  name?: string;
}

/**
 * Global JWT Authentication Guard.
 * - Respects @Public() decorator.
 * - Extracts token from Bearer header or access_token cookie.
 * - Checks Redis blacklist to prevent use of revoked/logged-out tokens.
 * - Attaches strongly-typed CurrentUser object to request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    const token = this.extractToken(request);

    if (isPublic) {
      if (token) {
        try {
          const user = await this.validateToken(token);
          request.user = user;
        } catch {
          // If public endpoint has an expired or invalid token, treat as unauthenticated
          request.user = undefined;
        }
      }
      return true;
    }

    if (!token) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication token is required',
      });
    }

    request.user = await this.validateToken(token);
    return true;
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    const cookies = request.cookies as Record<string, string> | undefined;
    if (cookies && cookies['access_token']) {
      return cookies['access_token'].trim();
    }

    return null;
  }

  private async validateToken(token: string): Promise<CurrentUser> {
    let payload: JwtTokenPayload;
    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'default_secret';
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, { secret });
    } catch {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_TOKEN',
        message: 'Token is invalid or expired',
      });
    }

    if (!payload.sub || !payload.jti) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_TOKEN_PAYLOAD',
        message: 'Malformed token payload',
      });
    }

    // Check token revocation blacklist in Redis
    const isBlacklisted = await this.redisService.isTokenBlacklisted(payload.sub, payload.jti);
    if (isBlacklisted) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'TOKEN_REVOKED',
        message: 'Token has been revoked or logged out',
      });
    }

    // Optional user profile enhancement from Redis
    const cachedProfile = await this.redisService.getUserProfile(payload.sub);

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'USER',
      jti: payload.jti,
      name: cachedProfile?.name ?? payload.name ?? null,
      gender: cachedProfile?.gender ?? null,
      hobbies: cachedProfile?.hobbies ?? [],
      funFact: cachedProfile?.funFact ?? null,
    };
  }
}

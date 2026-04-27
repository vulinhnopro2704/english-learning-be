import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { createApiErrorResponse } from '@english-learning/api-error-types';
import { RedisService } from '../redis/redis.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role?: string;
  jti: string;
  type: 'access' | 'refresh';
  exp?: number;
}

@Injectable()
export class GatewayProxyService {
  private readonly logger = new Logger(GatewayProxyService.name);
  private readonly authDocsPrefix = '/auth/api-docs';
  private readonly learnDocsPrefix = '/learn/api-docs';
  private readonly storageDocsPrefix = '/storage/api-docs';
  private readonly fsrsAiDocsPrefix = '/fsrs-ai/api-docs';
  private readonly generativeDocsPrefix = '/generative/api-docs';

  private readonly authUpstreamUrl: string;
  private readonly learnUpstreamUrl: string;
  private readonly storageUpstreamUrl: string;
  private readonly fsrsAiUpstreamUrl: string;
  private readonly generativeUpstreamUrl: string;
  private readonly swaggerPath: string;
  private readonly swaggerEnabled: boolean;
  private readonly rateLimitWindowSec: number;
  private readonly rateLimitMax: number;
  private readonly trustXForwardedFor: boolean;
  private readonly envIpBlacklist: Set<string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {
    this.authUpstreamUrl =
      this.configService.get<string>('AUTH_UPSTREAM_URL') ?? 'http://auth:3001';
    this.learnUpstreamUrl =
      this.configService.get<string>('LEARN_UPSTREAM_URL') ??
      'http://learn:3002';
    this.storageUpstreamUrl =
      this.configService.get<string>('STORAGE_UPSTREAM_URL') ??
      'http://storage:3003';
    this.fsrsAiUpstreamUrl =
      this.configService.get<string>('FSRS_AI_UPSTREAM_URL') ??
      'http://fsrs-ai:3004';
    this.generativeUpstreamUrl =
      this.configService.get<string>('GENERATIVE_UPSTREAM_URL') ??
      'http://generative:3005';
    this.swaggerPath = `/${(this.configService.get<string>('SWAGGER_PATH') ?? 'api-docs').replace(/^\/+/, '')}`;
    this.swaggerEnabled =
      (this.configService.get<string>('SWAGGER_ENABLED') ?? 'true') === 'true';
    this.rateLimitWindowSec = Number(
      this.configService.get<string>('RATE_LIMIT_WINDOW_SEC') ?? '60',
    );
    this.rateLimitMax = Number(
      this.configService.get<string>('RATE_LIMIT_MAX') ?? '100',
    );
    this.trustXForwardedFor =
      (this.configService.get<string>('TRUST_X_FORWARDED_FOR') ?? 'true') ===
      'true';

    const blacklistRaw = this.configService.get<string>('IP_BLACKLIST') ?? '';
    this.envIpBlacklist = new Set(
      blacklistRaw
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean),
    );
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (this.shouldBypass(req)) {
      next();
      return;
    }

    const clientIp = this.getClientIp(req);

    if (await this.isBlockedIp(clientIp)) {
      res.status(HttpStatus.FORBIDDEN).json(
        createApiErrorResponse({
          statusCode: HttpStatus.FORBIDDEN,
          errorCode: 'FORBIDDEN',
          message: 'IP address is blocked',
          traceId: this.getTraceId(req),
        }),
      );
      return;
    }

    const isLimited = await this.isRateLimited(clientIp);
    if (isLimited) {
      res.setHeader('Retry-After', `${this.rateLimitWindowSec}`);
      res.status(HttpStatus.TOO_MANY_REQUESTS).json(
        createApiErrorResponse({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'TOO_MANY_REQUESTS',
          message: 'Too many requests',
          traceId: this.getTraceId(req),
        }),
      );
      return;
    }

    const targetBase = this.resolveTargetBase(req.path);

    let forwardedIdentity: AccessTokenPayload | null = null;
    if (this.requiresAuth(req.method, req.path)) {
      try {
        forwardedIdentity = await this.verifyAccessToken(req);
      } catch (error) {
        const errorResponse =
          error instanceof ApiException ? error.getResponse() : undefined;
        const errorCode =
          typeof errorResponse === 'object' &&
          errorResponse !== null &&
          typeof (errorResponse as { errorCode?: unknown }).errorCode ===
            'string'
            ? (errorResponse as { errorCode: string }).errorCode
            : 'UNAUTHORIZED';
        const message =
          typeof errorResponse === 'object' &&
          errorResponse !== null &&
          typeof (errorResponse as { message?: unknown }).message === 'string'
            ? (errorResponse as { message: string }).message
            : 'Unauthorized';
        res.status(HttpStatus.UNAUTHORIZED).json(
          createApiErrorResponse({
            statusCode: HttpStatus.UNAUTHORIZED,
            errorCode,
            message,
            traceId: this.getTraceId(req),
          }),
        );
        return;
      }
    }

    await this.forwardRequest(
      req,
      res,
      targetBase,
      forwardedIdentity,
      clientIp,
    );
  }

  private shouldBypass(req: Request): boolean {
    if (req.method === 'OPTIONS') {
      return true;
    }

    if (req.path === '/health') {
      return true;
    }

    if (req.path === '/') {
      return true;
    }

    if (!this.swaggerEnabled) {
      return false;
    }

    return (
      req.path === this.swaggerPath ||
      req.path.startsWith(`${this.swaggerPath}/`)
    );
  }

  private resolveTargetBase(path: string): string {
    if (path.startsWith(this.authDocsPrefix)) {
      return this.authUpstreamUrl;
    }

    if (path.startsWith(this.learnDocsPrefix)) {
      return this.learnUpstreamUrl;
    }

    if (path.startsWith(this.storageDocsPrefix)) {
      return this.storageUpstreamUrl;
    }

    if (path.startsWith(this.fsrsAiDocsPrefix)) {
      return this.fsrsAiUpstreamUrl;
    }

    if (path.startsWith(this.generativeDocsPrefix)) {
      return this.generativeUpstreamUrl;
    }

    if (path.startsWith('/auth') || path.startsWith('/users')) {
      return this.authUpstreamUrl;
    }

    if (path.startsWith('/fsrs-ai')) {
      return this.fsrsAiUpstreamUrl;
    }

    if (path.startsWith('/storage') || path.startsWith('/files')) {
      return this.storageUpstreamUrl;
    }

    if (
      path.startsWith('/generative') ||
      path.startsWith('/tutor') ||
      path.startsWith('/roleplay')
    ) {
      return this.generativeUpstreamUrl;
    }

    return this.learnUpstreamUrl;
  }

  private requiresAuth(method: string, path: string): boolean {
    const normalizedMethod = method.toUpperCase();

    if (path === '/auth/login' && normalizedMethod === 'POST') {
      return false;
    }

    if (path === '/auth/register' && normalizedMethod === 'POST') {
      return false;
    }

    if (path === '/auth/refresh' && normalizedMethod === 'POST') {
      return false;
    }

    if (
      path.startsWith(this.authDocsPrefix) ||
      path.startsWith(this.learnDocsPrefix) ||
      path.startsWith(this.storageDocsPrefix) ||
      path.startsWith(this.fsrsAiDocsPrefix) ||
      path.startsWith(this.generativeDocsPrefix)
    ) {
      return false;
    }

    return true;
  }

  private async verifyAccessToken(req: Request): Promise<AccessTokenPayload> {
    const token = this.extractAccessToken(req);
    if (!token) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'MISSING_ACCESS_TOKEN',
        message: 'Missing access token',
      });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid or expired access token',
      });
    }

    if (payload.type !== 'access') {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_TOKEN_TYPE',
        message: 'Invalid token type',
      });
    }

    if (!payload.sub || !payload.jti) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'MALFORMED_TOKEN_PAYLOAD',
        message: 'Malformed token payload',
      });
    }

    const revoked = await this.redisService.isTokenBlacklisted(
      payload.sub,
      payload.jti,
    );
    if (revoked) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'ACCESS_TOKEN_REVOKED',
        message: 'Access token has been revoked',
      });
    }

    return payload;
  }

  private extractAccessToken(req: Request): string | null {
    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice(7).trim();
    }

    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.access_token ?? null;
  }

  private async isBlockedIp(clientIp: string): Promise<boolean> {
    if (this.envIpBlacklist.has(clientIp)) {
      return true;
    }

    try {
      return await this.redisService.isIpBlacklisted(clientIp);
    } catch (error) {
      this.logger.warn(
        `Failed to validate IP blacklist in Redis for IP ${clientIp}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async isRateLimited(clientIp: string): Promise<boolean> {
    const window = Math.floor(Date.now() / 1000 / this.rateLimitWindowSec);
    const key = `RATE_LIMIT_${clientIp}_${window}`;

    try {
      const count = await this.redisService.incrementRateLimit(
        key,
        this.rateLimitWindowSec + 1,
      );
      return count > this.rateLimitMax;
    } catch (error) {
      this.logger.warn(
        `Failed to apply rate limit for IP ${clientIp}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private getClientIp(req: Request): string {
    if (this.trustXForwardedFor) {
      const forwarded = req.header('x-forwarded-for');
      if (forwarded) {
        const firstIp = forwarded.split(',')[0]?.trim();
        if (firstIp) {
          return firstIp;
        }
      }
    }

    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }

  private getTraceId(req: Request): string {
    return (
      req.header('x-trace-id') ??
      (req as Record<string, any>).traceId ??
      'unknown'
    );
  }

  private async forwardRequest(
    req: Request,
    res: Response,
    targetBase: string,
    identity: AccessTokenPayload | null,
    clientIp: string,
  ): Promise<void> {
    const targetPath = this.rewriteTargetPath(req.path);
    const targetUrl = new URL(
      targetPath +
        (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
      targetBase,
    );

    const headers = this.buildForwardHeaders(req, identity, clientIp);
    const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());

    const body = hasBody ? this.buildRequestBody(req, headers) : undefined;

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
      });

      this.copyResponseHeaders(response, res);
      res.status(response.status);

      const responseText = await response.text();
      if (!responseText) {
        res.end();
        return;
      }

      res.send(responseText);
    } catch (error) {
      const traceId = this.getTraceId(req);
      this.logger.error(
        `Forward request failed for ${req.method} ${req.originalUrl} traceId=${traceId}: ${(error as Error).message}`,
      );
      res.status(HttpStatus.BAD_GATEWAY).json(
        createApiErrorResponse({
          statusCode: HttpStatus.BAD_GATEWAY,
          errorCode: 'BAD_GATEWAY',
          message: 'Failed to reach upstream service',
          traceId,
        }),
      );
    }
  }

  private rewriteTargetPath(path: string): string {
    if (path.startsWith(this.authDocsPrefix)) {
      return path.replace(this.authDocsPrefix, '/api-docs');
    }

    if (path.startsWith(this.learnDocsPrefix)) {
      return path.replace(this.learnDocsPrefix, '/api-docs');
    }

    if (path.startsWith(this.storageDocsPrefix)) {
      return path.replace(this.storageDocsPrefix, '/api-docs');
    }

    if (path.startsWith(this.fsrsAiDocsPrefix)) {
      return path.replace(this.fsrsAiDocsPrefix, '/api-docs');
    }

    if (path.startsWith(this.generativeDocsPrefix)) {
      return path.replace(this.generativeDocsPrefix, '/api-docs');
    }

    if (path.startsWith('/fsrs-ai')) {
      return path.replace('/fsrs-ai', '');
    }

    if (path.startsWith('/storage')) {
      return path.replace('/storage', '');
    }

    if (path.startsWith('/generative')) {
      return path.replace('/generative', '');
    }

    return path;
  }

  private buildForwardHeaders(
    req: Request,
    identity: AccessTokenPayload | null,
    clientIp: string,
  ): Headers {
    const headers = new Headers();

    Object.entries(req.headers).forEach(([name, value]) => {
      if (value == null) {
        return;
      }

      const lowerName = name.toLowerCase();
      if (
        lowerName === 'host' ||
        lowerName === 'content-length' ||
        lowerName === 'connection' ||
        lowerName === 'authorization' ||
        lowerName === 'x-user-id' ||
        lowerName === 'x-user-role' ||
        lowerName === 'x-user-email' ||
        lowerName === 'x-user-jti'
      ) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(name, v));
        return;
      }

      headers.set(name, value);
    });

    if (identity) {
      headers.set('x-user-id', identity.sub);
      headers.set('x-user-role', identity.role ?? 'user');
      headers.set('x-user-email', identity.email);
      headers.set('x-user-jti', identity.jti);
    }

    headers.set('x-forwarded-for', clientIp);

    return headers;
  }

  private buildRequestBody(
    req: Request,
    headers: Headers,
  ): BodyInit | undefined {
    if (req.body == null) {
      return undefined;
    }

    if (Buffer.isBuffer(req.body)) {
      return new Uint8Array(req.body);
    }

    if (typeof req.body === 'string') {
      return req.body;
    }

    const contentType = headers.get('content-type') ?? '';
    if (!contentType) {
      headers.set('content-type', 'application/json');
      return JSON.stringify(req.body);
    }

    if (contentType.includes('application/json')) {
      return JSON.stringify(req.body);
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      return new URLSearchParams(req.body as Record<string, string>).toString();
    }

    return JSON.stringify(req.body);
  }

  private copyResponseHeaders(
    upstream: globalThis.Response,
    res: Response,
  ): void {
    upstream.headers.forEach((value, name) => {
      const lowerName = name.toLowerCase();
      if (
        lowerName === 'content-length' ||
        lowerName === 'transfer-encoding' ||
        lowerName === 'connection'
      ) {
        return;
      }
      res.setHeader(name, value);
    });

    const setCookies = upstream.headers.getSetCookie();
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }
  }
}

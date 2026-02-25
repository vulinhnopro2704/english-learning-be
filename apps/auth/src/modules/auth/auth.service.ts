import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../db/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { RegisterDto } from './dtos/register.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { hash, compare } from 'bcryptjs';
import { uuidv7 } from 'uuidv7';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiration: string;
  private readonly refreshExpiration: string;
  private readonly cookieDomain: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessExpiration = this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRATION');
    this.refreshExpiration = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRATION');
    this.cookieDomain = this.configService.get<string>('COOKIE_DOMAIN', 'localhost');
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        id: uuidv7(),
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    this.logger.log(`User registered: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async logout(userId: string, accessJti: string, refreshJti: string): Promise<void> {
    const accessTtl = this.parseDurationToSeconds(this.accessExpiration);
    const refreshTtl = this.parseDurationToSeconds(this.refreshExpiration);

    await Promise.all([
      this.redisService.blacklistToken(userId, accessJti, accessTtl),
      this.redisService.blacklistToken(userId, refreshJti, refreshTtl),
    ]);

    this.logger.log(`User logged out: ${userId}`);
  }

  async refreshTokens(userId: string, oldRefreshJti: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Blacklist the old refresh token
    const refreshTtl = this.parseDurationToSeconds(this.refreshExpiration);
    await this.redisService.blacklistToken(userId, oldRefreshJti, refreshTtl);

    const tokens = await this.generateTokens(user.id, user.email);
    this.logger.log(`Tokens refreshed for user: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async generateTokens(userId: string, email: string) {
    const accessJti = uuidv7();
    const refreshJti = uuidv7();

    const accessExpiresIn = this.parseDurationToSeconds(this.accessExpiration);
    const refreshExpiresIn = this.parseDurationToSeconds(this.refreshExpiration);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, jti: accessJti, type: 'access' },
        { secret: this.accessSecret, expiresIn: accessExpiresIn },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, jti: refreshJti, type: 'refresh' },
        { secret: this.refreshSecret, expiresIn: refreshExpiresIn },
      ),
    ]);

    return { accessToken, refreshToken, accessJti, refreshJti };
  }

  setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    const commonOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict' as const,
      domain: this.isProduction ? this.cookieDomain : undefined,
      path: '/',
    };

    res.cookie('access_token', accessToken, {
      ...commonOptions,
      maxAge: this.parseDurationToSeconds(this.accessExpiration) * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      ...commonOptions,
      maxAge: this.parseDurationToSeconds(this.refreshExpiration) * 1000,
    });
  }

  clearTokenCookies(res: Response): void {
    const commonOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict' as const,
      domain: this.isProduction ? this.cookieDomain : undefined,
      path: '/',
    };

    res.clearCookie('access_token', commonOptions);
    res.clearCookie('refresh_token', commonOptions);
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }) {
    const { ...sanitized } = user;
    return {
      id: sanitized.id,
      email: sanitized.email,
      name: sanitized.name,
      avatar: sanitized.avatar,
      role: sanitized.role,
      createdAt: sanitized.createdAt,
      updatedAt: sanitized.updatedAt,
      lastLoginAt: sanitized.lastLoginAt,
    };
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        throw new Error(`Unknown duration unit: ${unit}`);
    }
  }
}

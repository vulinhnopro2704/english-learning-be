import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { hash, compare } from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { uuidv7 } from 'uuidv7';
import type { Response } from 'express';
import { AuthProvider, UserRole } from '../../generated/prisma/client';
import { MailService } from './mail.service';

interface GoogleAuthProfile {
  provider: 'GOOGLE';
  providerAccountId: string;
  email: string;
  name?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiration: string;
  private readonly refreshExpiration: string;
  private readonly cookieDomain?: string;
  private readonly isProduction: boolean;
  private readonly appPublicBaseUrl: string;
  private readonly emailVerificationTtlMinutes: number;
  private readonly passwordResetTtlMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
  ) {
    this.accessSecret =
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessExpiration = this.configService.getOrThrow<string>(
      'JWT_ACCESS_EXPIRATION',
    );
    this.refreshExpiration = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRATION',
    );
    this.cookieDomain = this.normalizeCookieDomain(
      this.configService.get<string>('COOKIE_DOMAIN'),
    );
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    this.appPublicBaseUrl = this.configService
      .get<string>('APP_PUBLIC_BASE_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');
    this.emailVerificationTtlMinutes = Number(
      this.configService.get<string>(
        'EMAIL_VERIFICATION_TOKEN_TTL_MINUTES',
        '60',
      ),
    );
    this.passwordResetTtlMinutes = Number(
      this.configService.get<string>('PASSWORD_RESET_TOKEN_TTL_MINUTES', '30'),
    );
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser) {
        throw new ApiException({
          statusCode: HttpStatus.CONFLICT,
          errorCode: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email already registered',
        });
      }

      const hashedPassword = await hash(dto.password, 12);
      const verification = this.createOpaqueToken();

      const user = await this.prisma.user.create({
        data: {
          id: uuidv7(),
          email: normalizedEmail,
          password: hashedPassword,
          name: dto.name,
          emailVerificationTokenHash: verification.hash,
          emailVerificationSentAt: new Date(),
          accounts: {
            create: {
              id: uuidv7(),
              provider: AuthProvider.EMAIL,
              providerAccountId: normalizedEmail,
            },
          },
        },
      });

      await this.mailService.sendEmailVerification(
        user.email,
        `${this.appPublicBaseUrl}/verify-email?token=${encodeURIComponent(verification.raw)}`,
      );

      this.logger.log(`User registered: ${user.email}`);

      return {
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Register failed for ${normalizedEmail}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    try {
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (!user || !user.password) {
        throw new ApiException({
          statusCode: HttpStatus.UNAUTHORIZED,
          errorCode: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        });
      }

      if (!user.emailVerifiedAt) {
        throw new ApiException({
          statusCode: HttpStatus.FORBIDDEN,
          errorCode: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before logging in',
        });
      }

      const isPasswordValid = await compare(dto.password, user.password);
      if (!isPasswordValid) {
        throw new ApiException({
          statusCode: HttpStatus.UNAUTHORIZED,
          errorCode: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        });
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const tokens = await this.generateTokens(user.id, user.email, user.role);
      this.logger.log(`User logged in: ${user.email}`);

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Login failed for ${normalizedEmail}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async loginWithGoogle(profile: GoogleAuthProfile) {
    try {
      const normalizedEmail = this.normalizeEmail(profile.email);
      if (!normalizedEmail) {
        throw new ApiException({
          statusCode: HttpStatus.UNAUTHORIZED,
          errorCode: 'GOOGLE_EMAIL_MISSING',
          message: 'Google account email is missing',
        });
      }

      this.logger.log(
        `Google login processing providerAccountId=${profile.providerAccountId} email=${normalizedEmail}`,
      );

      const existingAccount = await this.prisma.authAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: profile.providerAccountId,
          },
        },
        include: { user: true },
      });

      let user = existingAccount?.user ?? null;
      this.logger.log(
        `Google account lookup providerAccountId=${profile.providerAccountId} linkedUser=${user ? user.id : 'none'}`,
      );

      if (!user) {
        user = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          user = await this.prisma.user.create({
            data: {
              id: uuidv7(),
              email: normalizedEmail,
              name: profile.name,
              avatar: profile.avatar,
              emailVerifiedAt: new Date(),
            },
          });
          this.logger.log(`Google login created new user userId=${user.id}`);
        } else {
          this.logger.log(
            `Google login linked existing email userId=${user.id}`,
          );
        }

        await this.prisma.authAccount.create({
          data: {
            id: uuidv7(),
            userId: user.id,
            provider: AuthProvider.GOOGLE,
            providerAccountId: profile.providerAccountId,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
          },
        });
        this.logger.log(
          `Google login created auth account providerAccountId=${profile.providerAccountId} userId=${user.id}`,
        );
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name ?? profile.name,
          avatar: user.avatar ?? profile.avatar,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          lastLoginAt: new Date(),
        },
      });

      const tokens = await this.generateTokens(
        updatedUser.id,
        updatedUser.email,
        updatedUser.role,
      );
      this.logger.log(
        `Google login success userId=${updatedUser.id} email=${updatedUser.email}`,
      );

      return {
        user: this.sanitizeUser(updatedUser),
        ...tokens,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Google login failed for providerAccountId=${profile.providerAccountId} email=${profile.email}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.emailVerifiedAt) {
      return {
        message: 'If your email exists, verification mail has been sent',
      };
    }

    const verification = this.createOpaqueToken();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: verification.hash,
        emailVerificationSentAt: new Date(),
      },
    });

    await this.mailService.sendEmailVerification(
      user.email,
      `${this.appPublicBaseUrl}/verify-email?token=${encodeURIComponent(verification.raw)}`,
    );

    return { message: 'If your email exists, verification mail has been sent' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (!user || !user.emailVerificationSentAt) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'TOKEN_INVALID',
        message: 'Verification token is invalid',
      });
    }

    if (
      this.isExpired(
        user.emailVerificationSentAt,
        this.emailVerificationTtlMinutes,
      )
    ) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'TOKEN_EXPIRED',
        message: 'Verification token has expired',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationSentAt: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return {
        message: 'If your email exists, reset instructions have been sent',
      };
    }

    const reset = this.createOpaqueToken();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: reset.hash,
        passwordResetSentAt: new Date(),
      },
    });

    await this.mailService.sendPasswordReset(
      user.email,
      `${this.appPublicBaseUrl}/reset-password?token=${encodeURIComponent(reset.raw)}`,
    );

    return {
      message: 'If your email exists, reset instructions have been sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);

    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (!user || !user.passwordResetSentAt) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'TOKEN_INVALID',
        message: 'Reset token is invalid',
      });
    }

    if (
      this.isExpired(user.passwordResetSentAt, this.passwordResetTtlMinutes)
    ) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'TOKEN_EXPIRED',
        message: 'Reset token has expired',
      });
    }

    const newPasswordHash = await hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPasswordHash,
        passwordResetTokenHash: null,
        passwordResetSentAt: null,
      },
    });

    return { message: 'Password has been reset successfully' };
  }

  async logout(
    userId: string,
    accessJti: string,
    refreshJti: string,
  ): Promise<void> {
    const accessTtl = this.parseDurationToSeconds(this.accessExpiration);
    const refreshTtl = this.parseDurationToSeconds(this.refreshExpiration);

    const blacklistTasks: Promise<void>[] = [];
    if (accessJti) {
      blacklistTasks.push(
        this.redisService.blacklistToken(userId, accessJti, accessTtl),
      );
    }
    if (refreshJti) {
      blacklistTasks.push(
        this.redisService.blacklistToken(userId, refreshJti, refreshTtl),
      );
    }
    if (blacklistTasks.length > 0) {
      await Promise.all(blacklistTasks);
    }

    this.logger.log(`User logged out: ${userId}`);
  }

  async refreshTokens(
    userId: string,
    oldRefreshJti: string,
    oldAccessJti?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'AUTH_USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const refreshTtl = this.parseDurationToSeconds(this.refreshExpiration);
    const accessTtl = this.parseDurationToSeconds(this.accessExpiration);
    const blacklistTasks: Promise<void>[] = [];
    if (oldRefreshJti) {
      blacklistTasks.push(
        this.redisService.blacklistToken(userId, oldRefreshJti, refreshTtl),
      );
    }
    if (oldAccessJti) {
      blacklistTasks.push(
        this.redisService.blacklistToken(userId, oldAccessJti, accessTtl),
      );
    }
    if (blacklistTasks.length > 0) {
      await Promise.all(blacklistTasks);
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
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
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'AUTH_USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return this.sanitizeUser(user);
  }

  async generateTokens(userId: string, email: string, role: UserRole) {
    const accessJti = uuidv7();
    const refreshJti = uuidv7();

    const accessExpiresIn = this.parseDurationToSeconds(this.accessExpiration);
    const refreshExpiresIn = this.parseDurationToSeconds(
      this.refreshExpiration,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role, jti: accessJti, type: 'access' },
        { secret: this.accessSecret, expiresIn: accessExpiresIn },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role, jti: refreshJti, type: 'refresh' },
        { secret: this.refreshSecret, expiresIn: refreshExpiresIn },
      ),
    ]);

    return { accessToken, refreshToken, accessJti, refreshJti };
  }

  setTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const commonOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
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
      sameSite: 'lax' as const,
      domain: this.isProduction ? this.cookieDomain : undefined,
      path: '/',
    };

    res.clearCookie('access_token', commonOptions);
    res.clearCookie('refresh_token', commonOptions);
  }

  getOAuthRedirectUrl(success: boolean, errorCode?: string): string {
    const successUrl = this.configService.getOrThrow<string>(
      'GOOGLE_OAUTH_SUCCESS_REDIRECT_URL',
    );
    const failureUrl = this.configService.getOrThrow<string>(
      'GOOGLE_OAUTH_FAILURE_REDIRECT_URL',
    );

    const url = new URL(success ? successUrl : failureUrl);
    if (!success && errorCode) {
      url.searchParams.set('error', errorCode);
    }
    return url.toString();
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: UserRole;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private createOpaqueToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('hex');
    return { raw, hash: this.hashToken(raw) };
  }

  private isExpired(issuedAt: Date, ttlMinutes: number): boolean {
    return Date.now() > issuedAt.getTime() + ttlMinutes * 60 * 1000;
  }

  private normalizeCookieDomain(domain?: string): string | undefined {
    if (!domain) {
      return undefined;
    }
    const normalized = domain.split(':')[0]?.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    // Host-only cookies are safer for localhost/IP setups; explicit Domain on
    // these values is frequently rejected by browsers.
    if (
      normalized === 'localhost' ||
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)
    ) {
      return undefined;
    }
    return normalized;
  }
}

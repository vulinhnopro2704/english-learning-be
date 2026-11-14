import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { uuidv7 } from 'uuidv7';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from './mail.service';
import { ApiException } from '../../common/exceptions/api.exception';
import type { CurrentUser } from '../../common/types/api.types';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  UpdateProfileDto,
  Gender,
} from './dtos';

export interface GoogleAuthProfile {
  provider: 'GOOGLE';
  providerAccountId: string;
  email: string;
  name?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatar: string | null;
  emailVerified: boolean;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  hobbies?: string[];
  funFact?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

/**
 * Core Authentication Service managing user identities, JWT tokens, OAuth, and password lifecycles.
 */
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
    this.accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'default_access_secret';
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'default_refresh_secret';
    this.accessExpiration = this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m');
    this.refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    this.cookieDomain = this.normalizeCookieDomain(this.configService.get<string>('COOKIE_DOMAIN'));
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.appPublicBaseUrl = (this.configService.get<string>('APP_PUBLIC_BASE_URL') || 'http://localhost:5173').replace(/\/+$/, '');
    this.emailVerificationTtlMinutes = Number(this.configService.get<string>('EMAIL_VERIFICATION_TOKEN_TTL_MINUTES', '60'));
    this.passwordResetTtlMinutes = Number(this.configService.get<string>('PASSWORD_RESET_TOKEN_TTL_MINUTES', '30'));
  }

  /**
   * Registers a new user with email and password. Dispatches email verification link.
   */
  async register(dto: RegisterDto): Promise<{ user: UserSummary }> {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ApiException({
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await hash(dto.password, 12);
    const verification = this.createOpaqueToken();

    const user = await this.prisma.user.create({
      data: {
        id: uuidv7(),
        email: normalizedEmail,
        password: hashedPassword,
        name: dto.name?.trim() || null,
        role: 'USER',
        emailVerificationTokenHash: verification.tokenHash,
        emailVerificationSentAt: new Date(),
        hobbies: [],
      },
    });

    const verifyUrl = `${this.appPublicBaseUrl}/verify-email?token=${verification.rawToken}`;
    await this.mailService.sendEmailVerification(normalizedEmail, verifyUrl);

    return { user: this.toUserSummary(user) };
  }

  /**
   * Authenticates user with email and password and returns JWT tokens.
   */
  async login(dto: LoginDto): Promise<AuthTokens> {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.password) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = await compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userSummary = this.toUserSummary(user);
    await this.cacheUserProfile(userSummary);

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userSummary,
    };
  }

  /**
   * Logs in or creates a user account via Google OAuth profile.
   */
  async loginWithGoogle(profile: GoogleAuthProfile): Promise<AuthTokens> {
    const normalizedEmail = this.normalizeEmail(profile.email);

    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: uuidv7(),
          email: normalizedEmail,
          name: profile.name || null,
          avatar: profile.avatar || null,
          emailVerifiedAt: new Date(),
          role: 'USER',
          hobbies: [],
        },
      });
    } else if (!user.avatar && profile.avatar) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { avatar: profile.avatar },
      });
    }

    // Upsert OAuth account link
    const existingAccount = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId: profile.providerAccountId,
        },
      },
    });

    if (!existingAccount) {
      await this.prisma.authAccount.create({
        data: {
          id: uuidv7(),
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: profile.providerAccountId,
          accessToken: profile.accessToken || null,
          refreshToken: profile.refreshToken || null,
        },
      });
    }

    const userSummary = this.toUserSummary(user);
    await this.cacheUserProfile(userSummary);

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userSummary,
    };
  }

  /**
   * Refreshes access token using a valid refresh token.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; email: string; role?: string; jti: string; type: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      });
    }

    if (payload.type !== 'refresh') {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'INVALID_TOKEN_TYPE',
        message: 'Token is not a refresh token',
      });
    }

    const isBlacklisted = await this.redisService.isTokenBlacklisted(payload.sub, payload.jti);
    if (isBlacklisted) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'TOKEN_REVOKED',
        message: 'Refresh token has been revoked',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'USER_NOT_FOUND',
        message: 'User no longer exists',
      });
    }

    // Revoke previous refresh token
    const oldTtl = 7 * 24 * 60 * 60; // 7 days
    await this.redisService.blacklistToken(payload.sub, payload.jti, oldTtl);

    const userSummary = this.toUserSummary(user);
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userSummary,
    };
  }

  /**
   * Logs out user by blacklisting current access and refresh tokens.
   */
  async logout(user: CurrentUser, refreshToken?: string): Promise<void> {
    // 15 mins for access token
    await this.redisService.blacklistToken(user.id, user.jti, 15 * 60);

    if (refreshToken) {
      try {
        const refreshPayload = await this.jwtService.verifyAsync<{ jti: string }>(refreshToken, {
          secret: this.refreshSecret,
        });
        if (refreshPayload?.jti) {
          await this.redisService.blacklistToken(user.id, refreshPayload.jti, 7 * 24 * 60 * 60);
        }
      } catch {
        // Ignore malformed refresh token on logout
      }
    }

    await this.redisService.invalidateUserProfile(user.id);
  }

  /**
   * Dispatches password reset email.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return; // Silent return for security

    const resetToken = this.createOpaqueToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: resetToken.tokenHash,
        passwordResetSentAt: new Date(),
      },
    });

    const resetUrl = `${this.appPublicBaseUrl}/reset-password?token=${resetToken.rawToken}`;
    await this.mailService.sendPasswordReset(normalizedEmail, resetUrl);
  }

  /**
   * Resets password using valid token.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashToken(dto.token);

    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (!user || !user.passwordResetSentAt) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'INVALID_RESET_TOKEN',
        message: 'Invalid or expired password reset token',
      });
    }

    const ageMinutes = (Date.now() - user.passwordResetSentAt.getTime()) / (1000 * 60);
    if (ageMinutes > this.passwordResetTtlMinutes) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'RESET_TOKEN_EXPIRED',
        message: 'Password reset token has expired',
      });
    }

    const hashedPassword = await hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetSentAt: null,
      },
    });
  }

  /**
   * Verifies email with token.
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const tokenHash = this.hashToken(dto.token);

    const user = await this.prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (!user || !user.emailVerificationSentAt) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'INVALID_VERIFICATION_TOKEN',
        message: 'Invalid or expired verification token',
      });
    }

    const ageMinutes = (Date.now() - user.emailVerificationSentAt.getTime()) / (1000 * 60);
    if (ageMinutes > this.emailVerificationTtlMinutes) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'VERIFICATION_TOKEN_EXPIRED',
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
  }

  /**
   * Changes password for authenticated user.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'PASSWORD_NOT_SET',
        message: 'Account does not have a local password configured',
      });
    }

    const isValid = await compare(dto.oldPassword, user.password);
    if (!isValid) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'INVALID_OLD_PASSWORD',
        message: 'Old password is incorrect',
      });
    }

    const newHashed = await hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newHashed },
    });
  }

  /**
   * Updates user profile details and syncs Redis cache.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserSummary> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
        ...(dto.phoneNumber !== undefined ? { phoneNumber: dto.phoneNumber } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender as any } : {}),
        ...(dto.hobbies !== undefined ? { hobbies: dto.hobbies } : {}),
        ...(dto.funFact !== undefined ? { funFact: dto.funFact } : {}),
      },
    });

    const summary = this.toUserSummary(updated);
    await this.cacheUserProfile(summary);
    return summary;
  }

  /**
   * Retrieves profile of authenticated user.
   */
  async getProfile(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return this.toUserSummary(user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Cookie Management
  // ══════════════════════════════════════════════════════════════════════════

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProd = this.isProduction;
    const domain = this.cookieDomain;

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 mins
      ...(domain ? { domain } : {}),
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...(domain ? { domain } : {}),
    });
  }

  clearAuthCookies(res: Response): void {
    const isProd = this.isProduction;
    const domain = this.cookieDomain;

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Private Utilities
  // ══════════════════════════════════════════════════════════════════════════

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessJti = uuidv7();
    const refreshJti = uuidv7();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role, jti: accessJti, type: 'access' },
        { secret: this.accessSecret, expiresIn: this.accessExpiration as any },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role, jti: refreshJti, type: 'refresh' },
        { secret: this.refreshSecret, expiresIn: this.refreshExpiration as any },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async cacheUserProfile(user: UserSummary): Promise<void> {
    await this.redisService.cacheUserProfile(user.id, {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      gender: user.gender,
      hobbies: user.hobbies,
      funFact: user.funFact,
    });
  }

  private toUserSummary(user: any): UserSummary {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      role: user.role ?? 'USER',
      avatar: user.avatar ?? null,
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneNumber: user.phoneNumber ?? null,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null,
      gender: user.gender ?? null,
      hobbies: user.hobbies ?? [],
      funFact: user.funFact ?? null,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private createOpaqueToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  private normalizeCookieDomain(rawDomain?: string): string | undefined {
    const domain = rawDomain?.trim().replace(/:\d+$/, '').toLowerCase();
    if (!domain || domain === 'localhost' || domain === '127.0.0.1' || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) {
      return undefined;
    }
    return domain;
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '@english-learning/nest-api-docs';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from './decorators/current-user.decorator';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';

interface GoogleCallbackUser {
  provider: 'GOOGLE';
  providerAccountId: string;
  email: string;
  name?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiStandardErrorResponses({ statuses: [409, 422, 500] })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { user: result.user };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Start Google OAuth2 login flow' })
  async googleAuth(@Req() req: Request) {
    this.logger.log(
      `Google OAuth start requested traceId=${req.header('x-trace-id') ?? 'unknown'}`,
    );
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const profile = req.user as GoogleCallbackUser;
      this.logger.log(
        `Google OAuth callback received providerAccountId=${profile?.providerAccountId ?? 'unknown'} email=${profile?.email ?? 'unknown'} traceId=${req.header('x-trace-id') ?? 'unknown'}`,
      );
      const result = await this.authService.loginWithGoogle(profile);
      this.authService.setTokenCookies(
        res,
        result.accessToken,
        result.refreshToken,
      );
      this.logger.log(
        `Google OAuth callback success userId=${result.user.id} redirect=${this.authService.getOAuthRedirectUrl(true)}`,
      );
      return res.redirect(this.authService.getOAuthRedirectUrl(true));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown OAuth callback error';
      this.logger.error(
        `Google OAuth callback failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return res.redirect(
        this.authService.getOAuthRedirectUrl(false, 'OAUTH_FAILED'),
      );
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.authService.setTokenCookies(
      res,
      result.accessToken,
      result.refreshToken,
    );
    return { user: result.user };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.OK)
  async resendVerifyEmail(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Logout current user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiStandardErrorResponses({ statuses: [401, 500] })
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshTokenCookie = cookies?.refresh_token;
    let refreshJti = '';
    if (refreshTokenCookie) {
      try {
        const decoded: { jti?: string } | null =
          this.jwtService.decode(refreshTokenCookie);
        refreshJti = decoded?.jti ?? '';
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown decode error';
        this.logger.error(
          `Failed to decode refresh token during logout: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    await this.authService.logout(user.id, user.jti, refreshJti);
    this.authService.clearTokenCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiStandardErrorResponses({ statuses: [401, 500] })
  async refresh(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const accessTokenCookie = cookies?.access_token;
    let accessJti = '';
    if (accessTokenCookie) {
      try {
        const decoded: { jti?: string } | null =
          this.jwtService.decode(accessTokenCookie);
        accessJti = decoded?.jti ?? '';
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown decode error';
        this.logger.error(
          `Failed to decode access token during refresh: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    const result = await this.authService.refreshTokens(user.id, user.jti, accessJti);
    this.authService.setTokenCookies(
      res,
      result.accessToken,
      result.refreshToken,
    );
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiStandardErrorResponses({ statuses: [401, 500] })
  async me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getMe(user.id);
  }
}

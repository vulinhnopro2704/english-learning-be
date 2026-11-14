import {
  Controller,
  Post,
  Get,
  Patch,
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
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService, GoogleAuthProfile } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  UpdateProfileDto,
} from './dtos';
import { Public } from '../../common/decorators/public.decorator';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser } from '../../common/types/api.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.authService.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 authentication flow' })
  async googleAuth() {
    // Handled by passport-google-oauth20
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const state = req.query.state as string;
    const profile = req.user as GoogleAuthProfile;
    const result = await this.authService.loginWithGoogle(profile);

    this.authService.setAuthCookies(res, result.accessToken, result.refreshToken);

    if (state === 'mobile') {
      const mobileRedirect =
        process.env.MOBILE_AUTH_REDIRECT_URL || 'app://auth/callback';
      return res.redirect(
        `${mobileRedirect}?access_token=${result.accessToken}&refresh_token=${result.refreshToken}`,
      );
    }

    const frontendUrl = process.env.APP_PUBLIC_BASE_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/auth/callback?success=true`);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh_token cookie or body' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = bodyRefreshToken || cookies?.['refresh_token'];

    if (!token) {
      this.authService.clearAuthCookies(res);
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
      });
    }

    try {
      const result = await this.authService.refreshTokens(token);
      this.authService.setAuthCookies(res, result.accessToken, result.refreshToken);
      return result;
    } catch (err) {
      this.authService.clearAuthCookies(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke active tokens' })
  async logout(
    @GetCurrentUser() user: CurrentUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.['refresh_token'];
    await this.authService.logout(user, refreshToken);
    this.authService.clearAuthCookies(res);
    return { success: true, message: 'Logged out successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return {
      success: true,
      message: 'If the email exists, a password reset link has been dispatched',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with verification token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { success: true, message: 'Password has been reset successfully' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto);
    return { success: true, message: 'Email has been verified successfully' };
  }

  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  async changePassword(
    @GetCurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto);
    return { success: true, message: 'Password updated successfully' };
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile of authenticated user' })
  async updateProfile(
    @GetCurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getMe(@GetCurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }
}

import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StreakService } from './streak.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('streak')
@UseGuards(JwtAuthGuard)
export class StreakController {
  constructor(private readonly streakService: StreakService) {}

  @Get()
  getStreak(@CurrentUser('id') userId: string) {
    return this.streakService.getStreak(userId);
  }

  @Post('activity')
  recordActivity(@CurrentUser('id') userId: string) {
    return this.streakService.recordActivity(userId);
  }
}

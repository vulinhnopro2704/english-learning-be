import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { StreakService } from './streak.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('streak')
@ApiBearerAuth()
@Controller('streak')
@UseGuards(JwtAuthGuard)
export class StreakController {
  constructor(private readonly streakService: StreakService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user streak info' })
  @ApiResponse({ status: 200, description: 'Current streak data' })
  getStreak(@CurrentUser('id') userId: string) {
    return this.streakService.getStreak(userId);
  }

  @Post('activity')
  @ApiOperation({ summary: 'Record a learning activity for streak' })
  @ApiResponse({ status: 201, description: 'Activity recorded' })
  recordActivity(@CurrentUser('id') userId: string) {
    return this.streakService.recordActivity(userId);
  }
}

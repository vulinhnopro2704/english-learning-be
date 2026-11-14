import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StreakService } from './streak.service';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Streak')
@ApiBearerAuth()
@Controller('streak')
export class StreakController {
  constructor(private readonly streakService: StreakService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user streak information' })
  @ApiResponse({ status: 200, description: 'Current streak data' })
  getStreak(@GetCurrentUser('id') userId: string) {
    return this.streakService.getStreak(userId);
  }

  @Post('activity')
  @ApiOperation({ summary: 'Record a learning activity to update streak' })
  @ApiResponse({ status: 201, description: 'Activity recorded successfully' })
  recordActivity(@GetCurrentUser('id') userId: string) {
    return this.streakService.recordActivity(userId);
  }
}

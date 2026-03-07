import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PracticeService } from './practice.service';
import {
  SubmitFSRSPracticeDto,
  SubmitLessonPracticeDto,
  PracticeHistoryFilterDto,
} from './dtos/practice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('practice')
@ApiBearerAuth()
@Controller('practice')
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('fsrs')
  @ApiOperation({
    summary: 'Submit FSRS vocabulary review (Ôn tập)',
    description:
      'Submit batch review results from a practice session. ' +
      'Each item includes wordId, isCorrect, durationMs, and exerciseType. ' +
      'Auto-grading converts these into FSRS grade (1-4).',
  })
  @ApiResponse({ status: 201, description: 'Review processed & session saved' })
  @ApiResponse({ status: 502, description: 'FSRS-AI service error' })
  @ApiResponse({ status: 503, description: 'FSRS-AI service unavailable' })
  submitFSRS(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitFSRSPracticeDto,
  ) {
    return this.practiceService.submitFSRS(userId, dto);
  }

  @Post('lesson')
  @ApiOperation({
    summary: 'Submit lesson practice (Học mới)',
    description:
      'Submit lesson completion. Marks the lesson as completed, ' +
      'unlocks word progress, and initializes FSRS cards.',
  })
  @ApiResponse({ status: 201, description: 'Lesson completed & session saved' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  submitLesson(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitLessonPracticeDto,
  ) {
    return this.practiceService.submitLesson(userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get practice session history' })
  @ApiResponse({ status: 200, description: 'Paginated practice sessions' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query() filter: PracticeHistoryFilterDto,
  ) {
    return this.practiceService.getHistory(userId, filter);
  }
}

import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service.js';
import {
  CourseProgressFilterDto,
  LessonProgressFilterDto,
  WordProgressFilterDto,
  ReviewWordDto,
} from './dtos/progress.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // ═══ COURSE PROGRESS ═══════════════════════════════════════════════════════

  @Post('courses/:courseId/start')
  startCourse(
    @CurrentUser('id') userId: string,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.progressService.startCourse(userId, courseId);
  }

  @Get('courses')
  getMyCourses(@CurrentUser('id') userId: string, @Query() filter: CourseProgressFilterDto) {
    return this.progressService.getMyCourses(userId, filter);
  }

  // ═══ LESSON PROGRESS ═══════════════════════════════════════════════════════

  @Post('lessons/:lessonId/complete')
  completeLesson(
    @CurrentUser('id') userId: string,
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body('score', ParseIntPipe) score: number,
  ) {
    return this.progressService.completeLesson(userId, lessonId, score);
  }

  @Get('lessons')
  getMyLessons(@CurrentUser('id') userId: string, @Query() filter: LessonProgressFilterDto) {
    return this.progressService.getMyLessons(userId, filter);
  }

  // ═══ WORD PRACTICE (FSRS) ═════════════════════════════════════════════════

  @Get('review')
  getWordsToReview(@CurrentUser('id') userId: string, @Query('take') take?: string) {
    return this.progressService.getWordsToReview(userId, take ? parseInt(take, 10) : 20);
  }

  @Post('review')
  reviewWord(@CurrentUser('id') userId: string, @Body() dto: ReviewWordDto) {
    return this.progressService.reviewWord(userId, dto);
  }

  @Get('words')
  getMyWords(@CurrentUser('id') userId: string, @Query() filter: WordProgressFilterDto) {
    return this.progressService.getMyWords(userId, filter);
  }

  // ═══ STATS ════════════════════════════════════════════════════════════════

  @Get('stats')
  getStats(@CurrentUser('id') userId: string) {
    return this.progressService.getProgressStats(userId);
  }
}

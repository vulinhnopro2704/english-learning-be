import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '@english-learning/nest-api-docs';
import { ProgressService } from './progress.service';
import {
  CourseProgressFilterDto,
  LessonProgressFilterDto,
  WordProgressFilterDto,
  ReviewWordDto,
} from './dtos/progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // ═══ COURSE PROGRESS ═══════════════════════════════════════════════════════

  @Post('courses/:courseId/start')
  @ApiOperation({ summary: 'Start a course for the current user' })
  @ApiParam({ name: 'courseId', type: Number })
  @ApiResponse({ status: 201, description: 'Course started' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  startCourse(
    @CurrentUser('id') userId: string,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.progressService.startCourse(userId, courseId);
  }

  @Get('courses')
  @ApiOperation({ summary: 'Get current user enrolled courses' })
  @ApiResponse({ status: 200, description: 'List of enrolled courses' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  getMyCourses(
    @CurrentUser('id') userId: string,
    @Query() filter: CourseProgressFilterDto,
  ) {
    return this.progressService.getMyCourses(userId, filter);
  }

  // ═══ LESSON PROGRESS ═══════════════════════════════════════════════════════

  @Get('lessons')
  @ApiOperation({ summary: 'Get current user lesson progress' })
  @ApiResponse({ status: 200, description: 'List of lesson progress' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  getMyLessons(
    @CurrentUser('id') userId: string,
    @Query() filter: LessonProgressFilterDto,
  ) {
    return this.progressService.getMyLessons(userId, filter);
  }

  // ═══ WORD PRACTICE (FSRS) ═════════════════════════════════════════════════

  @Get('review')
  @ApiOperation({ summary: 'Get words due for review (spaced repetition)' })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Number of words to return (default: 20)',
  })
  @ApiResponse({ status: 200, description: 'List of words to review' })
  @ApiStandardErrorResponses({ statuses: [401, 500] })
  getWordsToReview(
    @CurrentUser('id') userId: string,
    @Query('take') take?: string,
  ) {
    return this.progressService.getWordsToReview(
      userId,
      take ? parseInt(take, 10) : 20,
    );
  }

  @Post('review')
  @ApiOperation({ summary: 'Submit a word review result' })
  @ApiResponse({ status: 201, description: 'Review recorded' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  reviewWord(@CurrentUser('id') userId: string, @Body() dto: ReviewWordDto) {
    return this.progressService.reviewWord(userId, dto);
  }

  @Get('words')
  @ApiOperation({ summary: 'Get current user word progress' })
  @ApiResponse({ status: 200, description: 'List of word progress' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  getMyWords(
    @CurrentUser('id') userId: string,
    @Query() filter: WordProgressFilterDto,
  ) {
    return this.progressService.getMyWords(userId, filter);
  }

  // ═══ STATS ════════════════════════════════════════════════════════════════

  @Get('stats')
  @ApiOperation({ summary: 'Get overall learning statistics' })
  @ApiResponse({ status: 200, description: 'User learning statistics' })
  @ApiStandardErrorResponses({ statuses: [401, 500] })
  getStats(@CurrentUser('id') userId: string) {
    return this.progressService.getProgressStats(userId);
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import {
  CourseProgressFilterDto,
  LessonProgressFilterDto,
  WordProgressFilterDto,
} from './dtos/progress.dto';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Progress')
@ApiBearerAuth()
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('courses/:courseId/start')
  @ApiOperation({ summary: 'Start a course for the current user' })
  @ApiParam({ name: 'courseId', type: Number })
  @ApiResponse({ status: 201, description: 'Course started' })
  startCourse(
    @GetCurrentUser('id') userId: string,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.progressService.startCourse(userId, courseId);
  }

  @Get('courses')
  @ApiOperation({ summary: 'Get current user enrolled courses' })
  @ApiResponse({ status: 200, description: 'List of enrolled courses' })
  getMyCourses(
    @GetCurrentUser('id') userId: string,
    @Query() filter: CourseProgressFilterDto,
  ) {
    return this.progressService.getMyCourses(userId, filter);
  }

  @Get('lessons')
  @ApiOperation({ summary: 'Get current user lesson progress' })
  @ApiResponse({ status: 200, description: 'List of lesson progress' })
  getMyLessons(
    @GetCurrentUser('id') userId: string,
    @Query() filter: LessonProgressFilterDto,
  ) {
    return this.progressService.getMyLessons(userId, filter);
  }

  @Get('words')
  @ApiOperation({ summary: 'Get current user word progress' })
  @ApiResponse({ status: 200, description: 'List of word progress' })
  getMyWords(
    @GetCurrentUser('id') userId: string,
    @Query() filter: WordProgressFilterDto,
  ) {
    return this.progressService.getMyWords(userId, filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get overall learning statistics' })
  @ApiResponse({ status: 200, description: 'User learning statistics' })
  getStats(@GetCurrentUser('id') userId: string) {
    return this.progressService.getProgressStats(userId);
  }
}

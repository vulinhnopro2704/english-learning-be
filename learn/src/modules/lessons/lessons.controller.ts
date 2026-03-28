import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedEntityResponse,
  ApiCursorPaginatedResponse,
  ApiMessageResponse,
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dtos/create-lesson.dto';
import { CompleteLessonDto } from './dtos/complete-lesson.dto';
import { LessonResponseDto } from './dtos/lesson-response.dto';
import { UpdateLessonDto } from './dtos/update-lesson.dto';
import { LessonFilterDto } from './dtos/lesson-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @ApiOperation({ summary: 'List lessons with optional filters' })
  @ApiCursorPaginatedResponse({
    description: 'Paginated list of lessons',
    itemType: LessonResponseDto,
    includeTotal: true,
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  findAll(
    @Query() filter: LessonFilterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.lessonsService.findAll(filter, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single lesson by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({ type: LessonResponseDto, description: 'Lesson found' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.lessonsService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new lesson' })
  @ApiCreatedEntityResponse({
    type: LessonResponseDto,
    description: 'Lesson created',
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  create(@Body() dto: CreateLessonDto) {
    return this.lessonsService.create(dto);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary:
      'Complete a lesson and trigger side effects (unlock words, streak, FSRS init, history)',
    description:
      'Single write endpoint for lesson completion. This marks lesson progress as COMPLETED, unlocks lesson words, updates streak activity, initializes FSRS cards (best-effort), and creates a LEARN_LESSON practice session.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 201,
    description:
      'Lesson completion pipeline executed. Returns lesson progress, unlocked word count, and created practice session.',
  })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  complete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteLessonDto,
  ) {
    return this.lessonsService.completeLesson(userId, id, dto.score ?? 0);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a lesson by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({
    type: LessonResponseDto,
    description: 'Lesson updated',
  })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLessonDto) {
    return this.lessonsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a lesson by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiMessageResponse('Lesson deleted')
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.remove(id);
  }
}

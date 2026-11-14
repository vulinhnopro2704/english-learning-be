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
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dtos/create-lesson.dto';
import { CompleteLessonDto } from './dtos/complete-lesson.dto';
import { UpdateLessonDto } from './dtos/update-lesson.dto';
import { LessonFilterDto } from './dtos/lesson-filter.dto';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser } from '../../common/types/api.types';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Lessons')
@ApiBearerAuth()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @ApiOperation({ summary: 'List lessons with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of lessons' })
  findAll(
    @Query() filter: LessonFilterDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.lessonsService.findAll(filter, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single lesson by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Lesson found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.lessonsService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Create a new lesson' })
  @ApiResponse({ status: 201, description: 'Lesson created' })
  create(
    @Body() dto: CreateLessonDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.lessonsService.create(dto, user);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Complete a lesson and trigger side effects (unlock words, streak, FSRS init, history)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Lesson completion processed' })
  complete(
    @GetCurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteLessonDto,
  ) {
    return this.lessonsService.completeLesson(userId, id, dto.score ?? 0);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Update a lesson by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Lesson updated' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLessonDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.lessonsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Delete a lesson by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Lesson deleted' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.lessonsService.remove(id, user);
  }
}

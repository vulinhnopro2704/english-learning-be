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
} from '@nestjs/swagger';
import {
  ApiCreatedEntityResponse,
  ApiCursorPaginatedResponse,
  ApiMessageResponse,
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dtos/create-course.dto';
import { CourseResponseDto } from './dtos/course-response.dto';
import { UpdateCourseDto } from './dtos/update-course.dto';
import { CourseFilterDto } from './dtos/course-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List courses with optional filters' })
  @ApiCursorPaginatedResponse({
    description: 'Paginated list of courses',
    itemType: CourseResponseDto,
    includeTotal: true,
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  findAll(
    @Query() filter: CourseFilterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.coursesService.findAll(filter, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single course by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({ type: CourseResponseDto, description: 'Course found' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.coursesService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new course' })
  @ApiCreatedEntityResponse({
    type: CourseResponseDto,
    description: 'Course created',
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a course by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({
    type: CourseResponseDto,
    description: 'Course updated',
  })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a course by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiMessageResponse('Course deleted')
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.remove(id);
  }
}

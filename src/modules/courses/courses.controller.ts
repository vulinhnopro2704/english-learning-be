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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dtos/create-course.dto';
import { UpdateCourseDto } from './dtos/update-course.dto';
import { CourseFilterDto } from './dtos/course-filter.dto';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser } from '../../common/types/api.types';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List courses with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of courses' })
  findAll(
    @Query() filter: CourseFilterDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.coursesService.findAll(filter, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single course by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Course found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.coursesService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Create a new course (Admin/Creator only)' })
  @ApiResponse({ status: 201, description: 'Course created successfully' })
  create(
    @Body() dto: CreateCourseDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.coursesService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Update a course by ID (Admin/Creator only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Course updated successfully' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.coursesService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Delete a course by ID (Admin/Creator only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Course deleted successfully' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.coursesService.remove(id, user);
  }
}

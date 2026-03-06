import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { CreateCourseDto } from './dtos/create-course.dto';
import { UpdateCourseDto } from './dtos/update-course.dto';
import { CourseFilterDto } from './dtos/course-filter.dto';
import type { Prisma } from '../../generated/prisma/client';

const COURSE_SELECT = {
  id: true,
  title: true,
  enTitle: true,
  description: true,
  image: true,
  icon: true,
  order: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: CourseFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.CourseWhereInput = {};

    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { enTitle: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }

    const orderBy: Prisma.CourseOrderByWithRelationInput = {
      [filter.sortBy ?? 'order']: filter.sortOrder ?? 'asc',
    };

    const findManyArgs: Prisma.CourseFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      select: {
        ...COURSE_SELECT,
        _count: { select: { lessons: true } },
      },
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany(findManyArgs),
      this.prisma.course.count({ where }),
    ]);

    const hasMore = courses.length > take;
    const data = hasMore ? courses.slice(0, take) : courses;
    const nextCursor =
      hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: {
        ...COURSE_SELECT,
        lessons: {
          select: {
            id: true,
            title: true,
            order: true,
            isPublished: true,
            _count: { select: { words: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: dto,
      select: COURSE_SELECT,
    });
  }

  async update(id: number, dto: UpdateCourseDto) {
    await this.findOne(id);

    return this.prisma.course.update({
      where: { id },
      data: dto,
      select: COURSE_SELECT,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.course.delete({ where: { id } });

    return { message: `Course with ID ${id} deleted successfully` };
  }
}

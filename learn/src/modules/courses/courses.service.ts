import { Injectable, HttpStatus } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import { CreateCourseDto } from './dtos/create-course.dto';
import { UpdateCourseDto } from './dtos/update-course.dto';
import { CourseFilterDto } from './dtos/course-filter.dto';
import type { Prisma } from '../../generated/prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

const COURSE_SELECT = {
  id: true,
  title: true,
  enTitle: true,
  description: true,
  image: true,
  icon: true,
  order: true,
  isPublished: true,
  isUserCreated: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  private isUserRole(user?: CurrentUserPayload): boolean {
    return (user?.role ?? '').toUpperCase() === 'USER';
  }

  private buildCourseVisibilityWhere(
    user?: CurrentUserPayload,
  ): Prisma.CourseWhereInput | undefined {
    if (!this.isUserRole(user)) {
      return undefined;
    }

    return {
      OR: [
        { isUserCreated: false },
        {
          isUserCreated: true,
          createdByUserId: user!.id,
        },
      ],
    };
  }

  private buildLessonVisibilityWhere(
    user?: CurrentUserPayload,
  ): Prisma.LessonWhereInput | undefined {
    if (!this.isUserRole(user)) {
      return undefined;
    }

    return {
      OR: [
        { isUserCreated: false },
        {
          isUserCreated: true,
          createdByUserId: user!.id,
        },
      ],
    };
  }

  private assertCourseWritePermission(
    course: { isUserCreated: boolean; createdByUserId: string | null },
    user?: CurrentUserPayload,
  ) {
    if (!this.isUserRole(user)) {
      return;
    }

    if (course.isUserCreated && course.createdByUserId === user!.id) {
      return;
    }

    throw new ApiException({
      statusCode: HttpStatus.FORBIDDEN,
      errorCode: 'COURSE_FORBIDDEN',
      message: 'You do not have permission to modify this course',
    });
  }

  async findAll(filter: CourseFilterDto, user?: CurrentUserPayload) {
    const take = filter.take ?? 20;

    const where: Prisma.CourseWhereInput = {};
    const visibilityWhere = this.buildCourseVisibilityWhere(user);

    if (visibilityWhere) {
      where.AND = [visibilityWhere];
    }

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

    if (!this.isUserRole(user) || data.length === 0) {
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

    const courseIds = data.map((course) => course.id);

    const [courseProgressRows, completedLessons] = await Promise.all([
      this.prisma.userCourseProgress.findMany({
        where: {
          userId: user!.id,
          courseId: { in: courseIds },
        },
        select: {
          courseId: true,
          isCompleted: true,
          startedAt: true,
          lastAccessedAt: true,
        },
      }),
      this.prisma.userLessonProgress.findMany({
        where: {
          userId: user!.id,
          status: 'COMPLETED',
          lesson: { courseId: { in: courseIds } },
        },
        select: {
          completedAt: true,
          lesson: { select: { courseId: true } },
        },
      }),
    ]);

    const lessonTotalRows = await this.prisma.lesson.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds } },
      _count: { _all: true },
    });
    const lessonTotalMap = new Map<number, number>();
    for (const row of lessonTotalRows) {
      if (row.courseId == null) {
        continue;
      }
      lessonTotalMap.set(row.courseId, row._count._all);
    }

    const courseProgressMap = new Map<
      number,
      (typeof courseProgressRows)[number]
    >();
    for (const row of courseProgressRows) {
      courseProgressMap.set(row.courseId, row);
    }

    const completedCountMap = new Map<number, number>();
    const lastCompletedAtMap = new Map<number, Date>();
    for (const item of completedLessons) {
      const courseId = item.lesson.courseId;
      if (courseId == null) {
        continue;
      }

      completedCountMap.set(
        courseId,
        (completedCountMap.get(courseId) ?? 0) + 1,
      );
      if (item.completedAt) {
        const last = lastCompletedAtMap.get(courseId);
        if (!last || item.completedAt > last) {
          lastCompletedAtMap.set(courseId, item.completedAt);
        }
      }
    }

    const enrichedData = data.map((course) => {
      const totalLessons = lessonTotalMap.get(course.id) ?? 0;
      const completedLessons = completedCountMap.get(course.id) ?? 0;
      const courseProgress = courseProgressMap.get(course.id);

      return {
        ...course,
        completedLessons,
        totalLessons,
        progress: {
          isStarted: !!courseProgress,
          isCompleted: courseProgress?.isCompleted ?? false,
          startedAt: courseProgress?.startedAt ?? null,
          lastAccessedAt: courseProgress?.lastAccessedAt ?? null,
          completedLessons,
          totalLessons,
          lastCompletedLessonAt: lastCompletedAtMap.get(course.id) ?? null,
        },
      };
    });

    const nextCursor =
      hasMore && enrichedData.length > 0
        ? (enrichedData[enrichedData.length - 1]?.id ?? null)
        : null;

    return {
      data: enrichedData,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    };
  }

  async findOne(id: number, user?: CurrentUserPayload) {
    const visibilityWhere = this.buildCourseVisibilityWhere(user);
    const lessonVisibilityWhere = this.buildLessonVisibilityWhere(user);

    const course = await this.prisma.course.findFirst({
      where: {
        id,
        ...(visibilityWhere ? { AND: [visibilityWhere] } : {}),
      },
      select: {
        ...COURSE_SELECT,
        lessons: {
          where: lessonVisibilityWhere,
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
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'COURSE_NOT_FOUND',
        message: `Course with ID ${id} not found`,
      });
    }

    if (!this.isUserRole(user)) {
      return course;
    }

    const lessonIds = course.lessons.map((lesson) => lesson.id);
    const [courseProgress, lessonProgressRows] = await Promise.all([
      this.prisma.userCourseProgress.findUnique({
        where: {
          userId_courseId: {
            userId: user!.id,
            courseId: id,
          },
        },
        select: {
          isCompleted: true,
          startedAt: true,
          lastAccessedAt: true,
        },
      }),
      lessonIds.length > 0
        ? this.prisma.userLessonProgress.findMany({
            where: {
              userId: user!.id,
              lessonId: { in: lessonIds },
            },
            select: {
              lessonId: true,
              status: true,
              score: true,
              completedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const lessonProgressMap = new Map<
      number,
      (typeof lessonProgressRows)[number]
    >();
    for (const row of lessonProgressRows) {
      lessonProgressMap.set(row.lessonId, row);
    }

    const completedLessons = lessonProgressRows.filter(
      (row) => row.status === 'COMPLETED',
    );
    const lastCompletedLessonAt = completedLessons.reduce<Date | null>(
      (last, row) => {
        if (!row.completedAt) {
          return last;
        }
        if (!last || row.completedAt > last) {
          return row.completedAt;
        }
        return last;
      },
      null,
    );

    const lessons = course.lessons.map((lesson) => {
      const progress = lessonProgressMap.get(lesson.id) ?? null;
      const isLearned = progress?.status === 'COMPLETED';

      return {
        ...lesson,
        isLearned,
        learnedAt: progress?.completedAt ?? null,
        progress: progress
          ? {
              status: progress.status,
              score: progress.score,
              completedAt: progress.completedAt,
              isLearned,
              learnedAt: progress.completedAt,
            }
          : null,
      };
    });

    return {
      ...course,
      lessons,
      completedLessons: completedLessons.length,
      totalLessons: course.lessons.length,
      progress: {
        isStarted: !!courseProgress,
        isCompleted: courseProgress?.isCompleted ?? false,
        startedAt: courseProgress?.startedAt ?? null,
        lastAccessedAt: courseProgress?.lastAccessedAt ?? null,
        completedLessons: completedLessons.length,
        totalLessons: course.lessons.length,
        lastCompletedLessonAt,
      },
    };
  }

  async create(dto: CreateCourseDto, user?: CurrentUserPayload) {
    const isUserCreated = this.isUserRole(user);

    return this.prisma.course.create({
      data: {
        ...dto,
        isUserCreated,
        createdByUserId: isUserCreated ? user!.id : null,
      },
      select: COURSE_SELECT,
    });
  }

  async update(id: number, dto: UpdateCourseDto, user?: CurrentUserPayload) {
    const course = await this.findOne(id, user);
    this.assertCourseWritePermission(course, user);

    return this.prisma.course.update({
      where: { id },
      data: dto,
      select: COURSE_SELECT,
    });
  }

  async remove(id: number, user?: CurrentUserPayload) {
    const course = await this.findOne(id, user);
    this.assertCourseWritePermission(course, user);

    await this.prisma.course.delete({ where: { id } });

    return { message: `Course with ID ${id} deleted successfully` };
  }
}

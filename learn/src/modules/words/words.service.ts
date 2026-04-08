import { Injectable, HttpStatus } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import { CreateWordDto } from './dtos/create-word.dto';
import { UpdateWordDto } from './dtos/update-word.dto';
import { WordFilterDto } from './dtos/word-filter.dto';
import type { Prisma } from '../../generated/prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

const WORD_SELECT = {
  id: true,
  word: true,
  pronunciation: true,
  meaning: true,
  example: true,
  exampleVi: true,
  image: true,
  audio: true,
  pos: true,
  cefr: true,
  lessonId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WordsService {
  constructor(private readonly prisma: PrismaService) {}

  private isUserRole(user?: CurrentUserPayload): boolean {
    return (user?.role ?? '').toUpperCase() === 'USER';
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

  private async getLessonForWordWrite(
    lessonId: number,
    user?: CurrentUserPayload,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        isUserCreated: true,
        createdByUserId: true,
      },
    });

    if (!lesson) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'LESSON_NOT_FOUND',
        message: `Lesson with ID ${lessonId} not found`,
      });
    }

    if (
      this.isUserRole(user) &&
      (!lesson.isUserCreated || lesson.createdByUserId !== user!.id)
    ) {
      throw new ApiException({
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: 'WORD_LESSON_FORBIDDEN',
        message: 'You can only create words in your own lesson',
      });
    }

    return lesson;
  }

  private assertWordWritePermission(
    word: {
      lesson: {
        isUserCreated: boolean;
        createdByUserId: string | null;
      } | null;
    },
    user?: CurrentUserPayload,
  ) {
    if (!this.isUserRole(user)) {
      return;
    }

    if (
      word.lesson &&
      word.lesson.isUserCreated &&
      word.lesson.createdByUserId === user!.id
    ) {
      return;
    }

    throw new ApiException({
      statusCode: HttpStatus.FORBIDDEN,
      errorCode: 'WORD_FORBIDDEN',
      message: 'You do not have permission to modify this word',
    });
  }

  async findAll(filter: WordFilterDto, user?: CurrentUserPayload) {
    const take = filter.take ?? 20;

    const where: Prisma.WordWhereInput = {};
    const lessonVisibilityWhere = this.buildLessonVisibilityWhere(user);
    const andWhere: Prisma.WordWhereInput[] = [];

    if (lessonVisibilityWhere) {
      andWhere.push({
        OR: [{ lessonId: null }, { lesson: lessonVisibilityWhere }],
      });
    }

    if (filter.search) {
      andWhere.push({
        OR: [
          { word: { contains: filter.search, mode: 'insensitive' } },
          { meaning: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filter.lessonId !== undefined) {
      where.lessonId = filter.lessonId;
    }

    if (filter.cefr) {
      where.cefr = filter.cefr;
    }

    if (filter.pos) {
      where.pos = filter.pos;
    }

    if (andWhere.length > 0) {
      where.AND = andWhere;
    }

    const orderBy: Prisma.WordOrderByWithRelationInput = {
      [filter.sortBy ?? 'word']: filter.sortOrder ?? 'asc',
    };

    const findManyArgs: Prisma.WordFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      select: WORD_SELECT,
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [words, total] = await Promise.all([
      this.prisma.word.findMany(findManyArgs),
      this.prisma.word.count({ where }),
    ]);

    const hasMore = words.length > take;
    const data = hasMore ? words.slice(0, take) : words;
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

  async findOne(id: number, user?: CurrentUserPayload) {
    const lessonVisibilityWhere = this.buildLessonVisibilityWhere(user);
    const word = await this.prisma.word.findFirst({
      where: {
        id,
        ...(lessonVisibilityWhere
          ? {
              OR: [{ lessonId: null }, { lesson: lessonVisibilityWhere }],
            }
          : {}),
      },
      select: {
        ...WORD_SELECT,
        lesson: {
          select: {
            id: true,
            title: true,
            courseId: true,
            isUserCreated: true,
            createdByUserId: true,
          },
        },
      },
    });

    if (!word) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'WORD_NOT_FOUND',
        message: `Word with ID ${id} not found`,
      });
    }

    return word;
  }

  async create(dto: CreateWordDto, user?: CurrentUserPayload) {
    await this.getLessonForWordWrite(dto.lessonId, user);

    return this.prisma.word.create({
      data: dto,
      select: WORD_SELECT,
    });
  }

  async update(id: number, dto: UpdateWordDto, user?: CurrentUserPayload) {
    const existingWord = await this.findOne(id, user);
    this.assertWordWritePermission(existingWord, user);

    if (dto.lessonId != null) {
      await this.getLessonForWordWrite(dto.lessonId, user);
    }

    return this.prisma.word.update({
      where: { id },
      data: dto,
      select: WORD_SELECT,
    });
  }

  async remove(id: number, user?: CurrentUserPayload) {
    const existingWord = await this.findOne(id, user);
    this.assertWordWritePermission(existingWord, user);

    await this.prisma.word.delete({ where: { id } });

    return { message: `Word with ID ${id} deleted successfully` };
  }
}

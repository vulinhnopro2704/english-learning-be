import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { CreateWordDto } from './dtos/create-word.dto';
import { UpdateWordDto } from './dtos/update-word.dto';
import { WordFilterDto } from './dtos/word-filter.dto';
import type { Prisma } from '../../generated/prisma/client';

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

  async findAll(filter: WordFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.WordWhereInput = {};

    if (filter.search) {
      where.OR = [
        { word: { contains: filter.search, mode: 'insensitive' } },
        { meaning: { contains: filter.search, mode: 'insensitive' } },
      ];
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

  async findOne(id: number) {
    const word = await this.prisma.word.findUnique({
      where: { id },
      select: {
        ...WORD_SELECT,
        lesson: {
          select: { id: true, title: true, courseId: true },
        },
      },
    });

    if (!word) {
      throw new NotFoundException(`Word with ID ${id} not found`);
    }

    return word;
  }

  async create(dto: CreateWordDto) {
    return this.prisma.word.create({
      data: dto,
      select: WORD_SELECT,
    });
  }

  async update(id: number, dto: UpdateWordDto) {
    await this.findOne(id);

    return this.prisma.word.update({
      where: { id },
      data: dto,
      select: WORD_SELECT,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.word.delete({ where: { id } });

    return { message: `Word with ID ${id} deleted successfully` };
  }
}

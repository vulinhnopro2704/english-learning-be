import { Injectable, HttpStatus } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import {
  UpsertVocabularyNoteDto,
  UpdateVocabularyNoteDto,
} from './dtos/vocabulary.dto';
import { CreateVocabularyFromDictionaryDto } from './dtos/create-vocabulary-from-dictionary.dto';
import { VocabularyFilterDto } from './dtos/vocabulary-filter.dto';
import type { Prisma } from '../../generated/prisma/client';

const WORD_INCLUDE = {
  word: {
    select: {
      id: true,
      word: true,
      pronunciation: true,
      meaning: true,
      example: true,
      exampleVi: true,
      pos: true,
      cefr: true,
      image: true,
      audio: true,
    },
  },
} as const;

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromDictionary(
    userId: string,
    dto: CreateVocabularyFromDictionaryDto,
  ) {
    const normalizedWord = dto.word.trim();
    if (!normalizedWord) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'INVALID_WORD',
        message: 'Word cannot be empty',
      });
    }

    const existingWord = await this.prisma.word.findFirst({
      where: {
        word: {
          equals: normalizedWord,
          mode: 'insensitive',
        },
      },
    });

    const word =
      existingWord ??
      (await this.prisma.word.create({
        data: {
          word: normalizedWord,
          pronunciation: dto.phonetic,
          meaning: dto.translation ?? dto.definition,
          example: dto.example,
          exampleVi: dto.exampleTranslation,
          audio: dto.audio,
          pos: dto.partOfSpeech,
          cefr: dto.cefrLevel,
        },
      }));

    return this.prisma.userVocabularyNote.upsert({
      where: { userId_wordId: { userId, wordId: word.id } },
      create: {
        userId,
        wordId: word.id,
        note: dto.note,
        isFavorite: dto.isFavorite ?? false,
      },
      update: {
        note: dto.note,
        isFavorite: dto.isFavorite,
      },
      include: WORD_INCLUDE,
    });
  }

  async getMyNotes(userId: string, filter: VocabularyFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.UserVocabularyNoteWhereInput = { userId };

    if (filter.isFavorite !== undefined) {
      where.isFavorite = filter.isFavorite;
    }

    if (filter.search) {
      where.word = {
        OR: [
          { word: { contains: filter.search, mode: 'insensitive' } },
          { meaning: { contains: filter.search, mode: 'insensitive' } },
        ],
      };
    }

    const orderBy: Prisma.UserVocabularyNoteOrderByWithRelationInput = {
      [filter.sortBy ?? 'createdAt']: filter.sortOrder ?? 'desc',
    };

    const findManyArgs: Prisma.UserVocabularyNoteFindManyArgs = {
      where,
      take: take + 1,
      orderBy,
      include: WORD_INCLUDE,
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [items, total] = await Promise.all([
      this.prisma.userVocabularyNote.findMany(findManyArgs),
      this.prisma.userVocabularyNote.count({ where }),
    ]);

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor =
      hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return { data, pagination: { nextCursor, hasMore, total } };
  }

  async upsertNote(userId: string, dto: UpsertVocabularyNoteDto) {
    // Verify word exists
    const word = await this.prisma.word.findUnique({
      where: { id: dto.wordId },
    });
    if (!word)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'WORD_NOT_FOUND',
        message: `Word with ID ${dto.wordId} not found`,
      });

    return this.prisma.userVocabularyNote.upsert({
      where: { userId_wordId: { userId, wordId: dto.wordId } },
      create: {
        userId,
        wordId: dto.wordId,
        note: dto.note,
        isFavorite: dto.isFavorite ?? false,
        customExample: dto.customExample,
      },
      update: {
        note: dto.note,
        isFavorite: dto.isFavorite,
        customExample: dto.customExample,
      },
      include: WORD_INCLUDE,
    });
  }

  async updateNote(
    userId: string,
    noteId: number,
    dto: UpdateVocabularyNoteDto,
  ) {
    const note = await this.prisma.userVocabularyNote.findFirst({
      where: { id: noteId, userId },
    });
    if (!note)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'VOCABULARY_NOTE_NOT_FOUND',
        message: `Note with ID ${noteId} not found`,
      });

    return this.prisma.userVocabularyNote.update({
      where: { id: noteId },
      data: dto,
      include: WORD_INCLUDE,
    });
  }

  async removeNote(userId: string, noteId: number) {
    const note = await this.prisma.userVocabularyNote.findFirst({
      where: { id: noteId, userId },
    });
    if (!note)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'VOCABULARY_NOTE_NOT_FOUND',
        message: `Note with ID ${noteId} not found`,
      });

    await this.prisma.userVocabularyNote.delete({ where: { id: noteId } });

    return { message: `Note with ID ${noteId} deleted successfully` };
  }

  async toggleFavorite(userId: string, wordId: number) {
    const existing = await this.prisma.userVocabularyNote.findUnique({
      where: { userId_wordId: { userId, wordId } },
    });

    if (existing) {
      return this.prisma.userVocabularyNote.update({
        where: { id: existing.id },
        data: { isFavorite: !existing.isFavorite },
        include: WORD_INCLUDE,
      });
    }

    // Auto-create note entry if toggle favorite on a word with no note
    const word = await this.prisma.word.findUnique({ where: { id: wordId } });
    if (!word)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'WORD_NOT_FOUND',
        message: `Word with ID ${wordId} not found`,
      });

    return this.prisma.userVocabularyNote.create({
      data: {
        userId,
        wordId,
        isFavorite: true,
      },
      include: WORD_INCLUDE,
    });
  }
}

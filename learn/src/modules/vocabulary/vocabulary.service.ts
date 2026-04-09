import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@english-learning/nest-error-handler';
import { PrismaService } from '../db/prisma.service';
import { StreakService } from '../streak/streak.service';
import {
  UpsertVocabularyNoteDto,
  UpdateVocabularyNoteDto,
} from './dtos/vocabulary.dto';
import { CreateVocabularyFromDictionaryDto } from './dtos/create-vocabulary-from-dictionary.dto';
import { VocabularyFilterDto } from './dtos/vocabulary-filter.dto';
import { RedisService } from '../redis/redis.service';
import {
  buildCacheKey,
  buildScopePattern,
  CACHE_TTL_SECONDS,
} from '../redis/cache-key.util';
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
      phoneticUs: true,
      phoneticUk: true,
      audioUs: true,
      audioUk: true,
      dictionaryMetadata: true,
      pos: true,
      cefr: true,
      image: true,
      audio: true,
      examples: {
        select: {
          id: true,
          example: true,
          exampleVi: true,
          exampleAudio: true,
          order: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class VocabularyService {
  private readonly logger = new Logger(VocabularyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly streakService: StreakService,
  ) {}

  private async invalidateRelatedCaches(userId: string) {
    await this.redisService.delByPatterns([
      buildScopePattern('vocabulary', userId),
      buildScopePattern('progress', userId),
      buildScopePattern('courses', userId),
      buildScopePattern('lessons', userId),
      buildScopePattern('words'),
      buildScopePattern('practice', userId),
      buildScopePattern('dictionary'),
    ]);
  }

  async createFromDictionary(
    userId: string,
    dto: CreateVocabularyFromDictionaryDto,
  ) {
    const normalizedWord = dto.word.trim();
    const normalizedMeaning =
      dto.translation?.trim() ||
      dto.definition?.trim() ||
      dto.definitionGpt?.trim() ||
      '';
    const normalizedPhonetic =
      dto.phoneticUs?.trim() ||
      dto.phoneticUk?.trim() ||
      dto.phonetic?.trim() ||
      '';

    if (!normalizedWord || !normalizedMeaning) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'INVALID_WORD_PAYLOAD',
        message: 'Word and meaning are required',
      });
    }

    const duplicateWhere: Prisma.WordWhereInput = {
      word: {
        equals: normalizedWord,
        mode: 'insensitive',
      },
      meaning: {
        equals: normalizedMeaning,
        mode: 'insensitive',
      },
      ...(normalizedPhonetic
        ? {
            OR: [
              {
                pronunciation: {
                  equals: normalizedPhonetic,
                  mode: 'insensitive',
                },
              },
              {
                phoneticUs: {
                  equals: normalizedPhonetic,
                  mode: 'insensitive',
                },
              },
              {
                phoneticUk: {
                  equals: normalizedPhonetic,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const existingWord = await this.prisma.word.findFirst({
      where: duplicateWhere,
    });

    const word = existingWord
      ? await this.prisma.word.update({
          where: { id: existingWord.id },
          data: {
            phoneticUs:
              existingWord.phoneticUs || dto.phoneticUs || dto.phonetic || null,
            phoneticUk: existingWord.phoneticUk || dto.phoneticUk || null,
            pronunciation:
              existingWord.pronunciation ||
              dto.phonetic ||
              dto.phoneticUs ||
              null,
            pos: existingWord.pos || dto.partOfSpeech || null,
            cefr: existingWord.cefr || dto.cefrLevel || null,
            dictionaryMetadata: {
              ...(typeof existingWord.dictionaryMetadata === 'object' &&
              existingWord.dictionaryMetadata
                ? (existingWord.dictionaryMetadata as Prisma.JsonObject)
                : {}),
              sourceProvider: dto.sourceProvider ?? 'dictionary',
              ...(dto.sourceMetadata ?? {}),
            },
          },
        })
      : await this.prisma.word.create({
          data: {
            word: normalizedWord,
            pronunciation: dto.phonetic || dto.phoneticUs || null,
            phoneticUs: dto.phoneticUs || dto.phonetic || null,
            phoneticUk: dto.phoneticUk || null,
            meaning: normalizedMeaning,
            example: dto.example,
            exampleVi: dto.exampleTranslation,
            audio: dto.audio || dto.audioUs || null,
            audioUs: dto.audioUs || dto.audio || null,
            audioUk: dto.audioUk || null,
            pos: dto.partOfSpeech,
            cefr: dto.cefrLevel,
            dictionaryMetadata: {
              sourceProvider: dto.sourceProvider ?? 'dictionary',
              ...(dto.sourceMetadata ?? {}),
            },
          },
        });

    await this.upsertWordExamples(word.id, dto);

    const syncedAudio = await this.syncWordAudios({
      wordId: word.id,
      userId,
      word: normalizedWord,
      audioUs: dto.audioUs || dto.audio,
      audioUk: dto.audioUk,
      fallbackAudioUs: word.audioUs || word.audio,
      fallbackAudioUk: word.audioUk,
    });

    await this.prisma.word.update({
      where: { id: word.id },
      data: {
        audio: syncedAudio.audioUs || word.audio || dto.audio || null,
        audioUs:
          syncedAudio.audioUs ||
          word.audioUs ||
          dto.audioUs ||
          dto.audio ||
          null,
        audioUk: syncedAudio.audioUk || word.audioUk || dto.audioUk || null,
        audioUsFileId: syncedAudio.audioUsFileId || word.audioUsFileId || null,
        audioUkFileId: syncedAudio.audioUkFileId || word.audioUkFileId || null,
      },
    });

    const note = await this.prisma.userVocabularyNote.upsert({
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

    const now = new Date();
    const progress = await this.prisma.userWordProgress.findUnique({
      where: { userId_wordId: { userId, wordId: word.id } },
      select: { id: true, nextReview: true },
    });

    if (!progress) {
      await this.prisma.userWordProgress.create({
        data: {
          userId,
          wordId: word.id,
          status: 'NEW',
          proficiency: 0,
          reviewCount: 0,
          correctCount: 0,
          nextReview: now,
        },
      });
    } else if (!progress.nextReview) {
      await this.prisma.userWordProgress.update({
        where: { id: progress.id },
        data: { nextReview: now },
      });
    }

    try {
      await this.prisma.practiceSession.create({
        data: {
          userId,
          type: 'DICTIONARY_SAVE',
          totalWords: 1,
          correctCount: 1,
          totalDurationMs: 0,
          startedAt: now,
          completedAt: now,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed creating DICTIONARY_SAVE session for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      await this.streakService.recordActivity(userId);
    } catch (error) {
      this.logger.warn(
        `Failed recording streak for user ${userId} after dictionary save: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    void this.initFsrsCard(userId, word.id);

    await this.invalidateRelatedCaches(userId);

    return note;
  }

  private async upsertWordExamples(
    wordId: number,
    dto: CreateVocabularyFromDictionaryDto,
  ) {
    const payloadExamples =
      dto.examples && dto.examples.length > 0
        ? dto.examples
        : dto.example
          ? [
              {
                example: dto.example,
                exampleVi: dto.exampleTranslation,
                order: 0,
              },
            ]
          : [];

    if (payloadExamples.length === 0) {
      return;
    }

    await Promise.all(
      payloadExamples
        .filter((item) => item.example?.trim())
        .map((item, index) =>
          this.prisma.wordExample.upsert({
            where: {
              wordId_example: {
                wordId,
                example: item.example.trim(),
              },
            },
            create: {
              wordId,
              example: item.example.trim(),
              exampleVi: item.exampleVi || null,
              exampleAudio: item.exampleAudio || null,
              order: item.order ?? index,
              source: {
                sourceProvider: dto.sourceProvider ?? 'dictionary',
                ...(dto.sourceMetadata ?? {}),
              },
            },
            update: {
              exampleVi: item.exampleVi || null,
              exampleAudio: item.exampleAudio || null,
              order: item.order ?? index,
            },
          }),
        ),
    );
  }

  private async syncWordAudios(input: {
    wordId: number;
    userId: string;
    word: string;
    audioUs?: string;
    audioUk?: string;
    fallbackAudioUs?: string | null;
    fallbackAudioUk?: string | null;
  }) {
    const storageServiceUrl =
      this.configService.get<string>('STORAGE_SERVICE_URL') ||
      'http://localhost:3003';

    if (!input.audioUs && !input.audioUk) {
      return {
        audioUs: input.fallbackAudioUs || null,
        audioUk: input.fallbackAudioUk || null,
        audioUsFileId: null as string | null,
        audioUkFileId: null as string | null,
      };
    }

    const ingest = async (audioUrl: string, accent: 'us' | 'uk') => {
      const response = await fetch(
        `${storageServiceUrl}/files/ingest-remote-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': input.userId,
          },
          body: JSON.stringify({
            sourceUrl: audioUrl,
            folder: 'words/audio',
            accent,
            word: input.word,
            metadata: {
              wordId: input.wordId,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new ApiException({
          statusCode: HttpStatus.BAD_GATEWAY,
          errorCode: 'AUDIO_INGEST_FAILED',
          message: `Failed to ingest ${accent.toUpperCase()} audio via storage service`,
        });
      }

      const payload = (await response.json()) as {
        id: string;
        secureUrl: string;
      };

      return {
        fileId: payload.id,
        secureUrl: payload.secureUrl,
      };
    };

    const usResult = input.audioUs ? await ingest(input.audioUs, 'us') : null;
    const ukResult = input.audioUk ? await ingest(input.audioUk, 'uk') : null;

    return {
      audioUs:
        usResult?.secureUrl || input.fallbackAudioUs || input.audioUs || null,
      audioUk:
        ukResult?.secureUrl || input.fallbackAudioUk || input.audioUk || null,
      audioUsFileId: usResult?.fileId || null,
      audioUkFileId: ukResult?.fileId || null,
    };
  }

  private async initFsrsCard(userId: string, wordId: number) {
    const fsrsBaseUrl = this.configService.get<string>('FSRS_AI_URL');
    if (!fsrsBaseUrl) {
      return;
    }

    try {
      const url = new URL(`${fsrsBaseUrl}/api/v1/fsrs/init-cards`);
      url.searchParams.set('user_id', userId);
      url.searchParams.append('word_ids', String(wordId));
      await fetch(url.toString(), { method: 'POST' });
    } catch (error) {
      this.logger.warn(
        `FSRS card init failed for user ${userId}, word ${wordId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getMyNotes(userId: string, filter: VocabularyFilterDto) {
    const cacheKey = buildCacheKey('vocabulary', {
      userId,
      params: {
        endpoint: 'getMyNotes',
        filter,
      },
    });

    const cached = await this.redisService.getJson<{
      data: unknown[];
      pagination: {
        nextCursor: number | null;
        hasMore: boolean;
        total: number;
      };
    }>(cacheKey);
    if (cached) {
      return cached;
    }

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

    const response = { data, pagination: { nextCursor, hasMore, total } };

    await this.redisService.setJson(
      cacheKey,
      response,
      CACHE_TTL_SECONDS.MEDIUM,
    );

    return response;
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

    const note = await this.prisma.userVocabularyNote.upsert({
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

    await this.invalidateRelatedCaches(userId);

    return note;
  }

  async updateNote(
    userId: string,
    noteId: number,
    dto: UpdateVocabularyNoteDto,
  ) {
    const existingNote = await this.prisma.userVocabularyNote.findFirst({
      where: { id: noteId, userId },
    });
    if (!existingNote)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'VOCABULARY_NOTE_NOT_FOUND',
        message: `Note with ID ${noteId} not found`,
      });

    const note = await this.prisma.userVocabularyNote.update({
      where: { id: noteId },
      data: dto,
      include: WORD_INCLUDE,
    });

    await this.invalidateRelatedCaches(userId);

    return note;
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
    await this.invalidateRelatedCaches(userId);

    return { message: `Note with ID ${noteId} deleted successfully` };
  }

  async toggleFavorite(userId: string, wordId: number) {
    const existing = await this.prisma.userVocabularyNote.findUnique({
      where: { userId_wordId: { userId, wordId } },
    });

    if (existing) {
      const note = await this.prisma.userVocabularyNote.update({
        where: { id: existing.id },
        data: { isFavorite: !existing.isFavorite },
        include: WORD_INCLUDE,
      });

      await this.invalidateRelatedCaches(userId);

      return note;
    }

    // Auto-create note entry if toggle favorite on a word with no note
    const word = await this.prisma.word.findUnique({ where: { id: wordId } });
    if (!word)
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'WORD_NOT_FOUND',
        message: `Word with ID ${wordId} not found`,
      });

    const note = await this.prisma.userVocabularyNote.create({
      data: {
        userId,
        wordId,
        isFavorite: true,
      },
      include: WORD_INCLUDE,
    });

    await this.invalidateRelatedCaches(userId);

    return note;
  }
}

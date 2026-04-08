import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { DictionarySearchDto } from './dtos/dictionary-search.dto';
import { PrismaService } from '../db/prisma.service';
import { RedisService } from '../redis/redis.service';

const MOCHI_PRIVATE_KEY = 'M0ch1M0ch1_En_$ecret_k3y';
const MOCHI_BASE_URL =
  'https://mochien-server-release.mochidemy.com/api/v5.0/words/dictionary-english';
const DICTIONARY_CACHE_TTL_SECONDS = 60 * 60 * 24;

type DictionarySentenceAudio = {
  key: string;
  trans: string | null;
  audio: string | null;
};

type DictionaryWordDetail = {
  trans: string | null;
  definition: string | null;
  definitionGpt: string | null;
  cefrLevel: string | null;
  sentenceAudio: DictionarySentenceAudio[];
};

type DictionaryEntry = {
  id: number;
  content: string;
  position: string | null;
  phoneticUs: string | null;
  phoneticUk: string | null;
  audioUs: string | null;
  audioUk: string | null;
  words: DictionaryWordDetail[];
};

type DictionarySearchResult = {
  code: number;
  msg: string | null;
  data: DictionaryEntry[];
  dataIelts: Array<{
    name: string;
    title: string;
    content: string;
  }>;
};

@Injectable()
export class DictionaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async search(query: DictionarySearchDto) {
    const cacheKey = this.buildCacheKey(query);

    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const url = new URL(MOCHI_BASE_URL);
    url.searchParams.set('key', query.word);
    url.searchParams.set('language', query.language ?? 'vi');
    url.searchParams.set('type', query.type ?? 'web');
    url.searchParams.set('definition', String(query.definition ?? 0));
    url.searchParams.set('search_ielts', String(query.searchIelts ?? 1));

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          privateKey: MOCHI_PRIVATE_KEY,
        },
      });
    } catch {
      throw new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'MOCHI_SERVICE_UNAVAILABLE',
        message: 'Failed to connect to Mochi dictionary service',
      });
    }

    if (!response.ok) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'MOCHI_UPSTREAM_ERROR',
        message: 'Mochi dictionary service returned an error',
      });
    }

    try {
      const payload = (await response.json()) as Record<string, unknown>;

      const mappedData = this.toArray(payload.data).map((item) => {
        const words = this.toArray(item.words).map((word) => ({
          trans: this.toNullableString(word.trans),
          definition: this.toNullableString(word.definition),
          definitionGpt: this.toNullableString(
            word.definitionGpt ?? word.definition_gpt,
          ),
          cefrLevel: this.toNullableString(word.cefrLevel ?? word.cefr_level),
          sentenceAudio: this.toArray(
            word.sentenceAudio ?? word.sentence_audio,
          ).map((sentence) => ({
            key: this.toString(sentence.key),
            trans: this.toNullableString(sentence.trans),
            audio: this.toNullableString(sentence.audio),
          })),
        }));

        return {
          id: this.toNumber(item.id),
          content: this.toString(item.content),
          position: this.toNullableString(item.position),
          phoneticUs: this.toNullableString(
            item.phoneticUs ?? item.phonetic_us,
          ),
          phoneticUk: this.toNullableString(
            item.phoneticUk ?? item.phonetic_uk,
          ),
          audioUs: this.toNullableString(item.audioUs ?? item.audio_us),
          audioUk: this.toNullableString(item.audioUk ?? item.audio_uk),
          words,
        };
      });

      const mappedIelts = this.toArray(payload.data_ielts).map((item) => ({
        name: this.toString(item.name),
        title: this.toString(item.title),
        content: this.toString(item.content),
      }));

      const result: DictionarySearchResult = {
        code: this.toNumber(payload.code, 200),
        msg: this.toNullableString(payload.msg),
        data: mappedData,
        dataIelts: mappedIelts,
      };

      this.enqueueBackgroundSync(mappedData);
      void this.setCachedResult(cacheKey, result);

      return result;
    } catch {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'MOCHI_INVALID_RESPONSE',
        message: 'Mochi dictionary service returned invalid response',
      });
    }
  }

  private buildCacheKey(query: DictionarySearchDto) {
    return [
      'dictionary',
      query.word.trim().toLowerCase(),
      query.language ?? 'vi',
      query.type ?? 'web',
      query.definition ?? 0,
      query.searchIelts ?? 1,
    ].join(':');
  }

  private async getCachedResult(cacheKey: string) {
    try {
      const raw = await this.redisService.get(cacheKey);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as DictionarySearchResult;
    } catch {
      return null;
    }
  }

  private async setCachedResult(
    cacheKey: string,
    result: DictionarySearchResult,
  ) {
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        DICTIONARY_CACHE_TTL_SECONDS,
      );
    } catch {
      // Redis cache failure should not affect API response
    }
  }

  private enqueueBackgroundSync(entries: DictionaryEntry[]) {
    setImmediate(() => {
      void this.syncWordsFromDictionary(entries);
    });
  }

  private async syncWordsFromDictionary(entries: DictionaryEntry[]) {
    for (const entry of entries) {
      const normalizedWord = entry.content.trim();
      if (!normalizedWord) {
        continue;
      }

      const primaryDetail = entry.words[0];
      const firstSentence = primaryDetail?.sentenceAudio?.[0];

      const meaning =
        primaryDetail?.trans?.trim() ||
        primaryDetail?.definition?.trim() ||
        primaryDetail?.definitionGpt?.trim() ||
        normalizedWord;

      const updatePayload = {
        word: normalizedWord,
        pronunciation: entry.phoneticUs ?? entry.phoneticUk,
        meaning,
        example: firstSentence?.key ?? null,
        exampleVi: firstSentence?.trans ?? null,
        audio: entry.audioUs ?? entry.audioUk,
        pos: entry.position,
        cefr: primaryDetail?.cefrLevel?.toUpperCase() ?? null,
        lessonId: null,
      };

      try {
        const existing = await this.prisma.word.findFirst({
          where: {
            word: {
              equals: normalizedWord,
              mode: 'insensitive',
            },
            lessonId: null,
            ...(entry.position
              ? {
                  pos: {
                    equals: entry.position,
                    mode: 'insensitive',
                  },
                }
              : {}),
          },
          select: { id: true },
        });

        if (!existing) {
          await this.prisma.word.create({
            data: updatePayload,
          });
          continue;
        }

        await this.prisma.word.update({
          where: { id: existing.id },
          data: updatePayload,
        });
      } catch {
        // background sync should be best-effort and must not break API
      }
    }
  }

  private toArray(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    );
  }

  private toString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  private toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toString(value);
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}

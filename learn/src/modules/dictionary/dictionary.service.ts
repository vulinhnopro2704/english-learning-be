import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import { DictionarySearchDto } from './dtos/dictionary-search.dto';
import { PrismaService } from '../db/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  buildCacheKey,
  buildScopePattern,
  CACHE_TTL_SECONDS,
} from '../redis/cache-key.util';

const MOCHI_PRIVATE_KEY = 'M0ch1M0ch1_En_$ecret_k3y';
const MOCHI_BASE_URL =
  'https://mochien-server-release.mochidemy.com/api/v5.0/words/dictionary-english';

type DictionarySentenceAudio = {
  key: string;
  trans: string | null;
  audio: string | null;
};

type DictionaryWordDetail = {
  id: number;
  wmId: number;
  trans: string | null;
  phonetic: string | null;
  position: string | null;
  picture: string | null;
  audio: string | null;
  definition: string | null;
  definitionGpt: string | null;
  cefrLevel: string | null;
  ieltsLevel: string | null;
  toeic: string | null;
  single: number | string | null;
  collo: number | string | null;
  synonym: number | string | null;
  review: number;
  sentenceAudio: DictionarySentenceAudio[];
  collocations: Array<Record<string, unknown>>;
  synonyms: Record<string, unknown> | null;
  isSaved: boolean;
};

type DictionaryPhoneme = {
  character: string;
  characterAudio: string | null;
  phonemes: string;
  phonemesAudio: string | null;
};

type DictionaryAnalyzing = {
  typeWord: string;
  countPhoneme: number;
  phonemesUs: DictionaryPhoneme[];
  phonemesUk: DictionaryPhoneme[];
};

type DictionaryPhrasalVerb = {
  id: number;
  wmId: number;
  phrasalVerbs: string;
  phoneticUk: string | null;
  phoneticUs: string | null;
  audioUk: string | null;
  audioUs: string | null;
};

type DictionaryIdiom = {
  id: number;
  wmId: number;
  idiom: string;
  audio: string | null;
  definition: string | null;
  definitionGpt: string | null;
  example: string | null;
  idiomsExAudio: string | null;
  example2: string | null;
  stressed: string | null;
  reason: string | null;
  idiomsTran: Record<string, unknown> | null;
  pivot: Record<string, unknown>;
};

type DictionaryVerbForm = {
  id: number;
  wmId: number;
  presentSimple: string | null;
  presentSimplePhonetic: string | null;
  presentSimpleAudioUs: string | null;
  presentSimpleAudioUk: string | null;
  singularVerb: string | null;
  singularVerbPhonetic: string | null;
  singularVerbAudioUs: string | null;
  singularVerbAudioUk: string | null;
  pastSimple: string | null;
  pastSimplePhonetic: string | null;
  pastSimpleAudioUs: string | null;
  pastSimpleAudioUk: string | null;
  pastParticiple: string | null;
  pastParticiplePhonetic: string | null;
  pastParticipleAudioUs: string | null;
  pastParticipleAudioUk: string | null;
  ingForm: string | null;
  ingFormPhonetic: string | null;
  ingFormAudioUs: string | null;
  ingFormAudioUk: string | null;
};

type DictionaryThesaurusItem = {
  id: number;
  wmId: number;
  position: string;
  positionContent: string;
  strongestMatch: string;
  strongMatch: string;
  weakMatch: string;
  strongestOpposite: string;
  strongOpposite: string;
  weakOpposite: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type DictionaryEntry = {
  id: number;
  content: string;
  position: string | null;
  phoneticUs: string | null;
  phoneticUk: string | null;
  audioUs: string | null;
  audioUk: string | null;
  analyzing: DictionaryAnalyzing | null;
  phrasalVerbs: DictionaryPhrasalVerb[];
  idioms: DictionaryIdiom[];
  verbForm: DictionaryVerbForm | null;
  thesaurus: DictionaryThesaurusItem[];
  isSaved: boolean;
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

  async search(query: DictionarySearchDto, userId?: string) {
    const cacheKey = this.buildCacheKey(query);

    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      return this.withSavedStatus(cachedResult, userId);
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
          id: this.toNumber(word.id),
          wmId: this.toNumber(word.wmId ?? word.wm_id),
          trans: this.toNullableString(word.trans),
          phonetic: this.toNullableString(word.phonetic),
          position: this.toNullableString(word.position),
          picture: this.toNullableString(word.picture),
          audio: this.toNullableString(word.audio),
          definition: this.toNullableString(word.definition),
          definitionGpt: this.toNullableString(
            word.definitionGpt ?? word.definition_gpt,
          ),
          cefrLevel: this.toNullableString(word.cefrLevel ?? word.cefr_level),
          ieltsLevel: this.toNullableString(
            word.ieltsLevel ?? word.ielts_level,
          ),
          toeic: this.toNullableString(word.toeic),
          single: this.toNumberish(word.single),
          collo: this.toNumberish(word.collo),
          synonym: this.toNumberish(word.synonym),
          review: this.toNumber(word.review),
          sentenceAudio: this.toArray(
            word.sentenceAudio ?? word.sentence_audio,
          ).map((sentence) => ({
            key: this.toString(sentence.key),
            trans: this.toNullableString(sentence.trans),
            audio: this.toNullableString(sentence.audio),
          })),
          collocations: this.toArray(word.collocations),
          synonyms: this.toObject(word.synonyms),
          isSaved: false,
        }));

        const rawAnalyzing = this.toObject(item.analyzing ?? item.alalyzing);
        const analyzing: DictionaryAnalyzing | null = rawAnalyzing
          ? {
              typeWord: this.toString(
                rawAnalyzing.typeWord ?? rawAnalyzing.type_word,
              ),
              countPhoneme: this.toNumber(
                rawAnalyzing.countPhoneme ?? rawAnalyzing.count_phoneme,
              ),
              phonemesUs: this.toArray(
                rawAnalyzing.phonemesUs ?? rawAnalyzing.phonemes_us,
              ).map((phoneme) => ({
                character: this.toString(phoneme.character),
                characterAudio: this.toNullableString(
                  phoneme.characterAudio ?? phoneme.character_audio,
                ),
                phonemes: this.toString(phoneme.phonemes),
                phonemesAudio: this.toNullableString(
                  phoneme.phonemesAudio ?? phoneme.phonemes_audio,
                ),
              })),
              phonemesUk: this.toArray(
                rawAnalyzing.phonemesUk ?? rawAnalyzing.phonemes_uk,
              ).map((phoneme) => ({
                character: this.toString(phoneme.character),
                characterAudio: this.toNullableString(
                  phoneme.characterAudio ?? phoneme.character_audio,
                ),
                phonemes: this.toString(phoneme.phonemes),
                phonemesAudio: this.toNullableString(
                  phoneme.phonemesAudio ?? phoneme.phonemes_audio,
                ),
              })),
            }
          : null;

        const phrasalVerbs = this.toArray(
          item.phrasalVerbs ?? item.phrasal_verb,
        ).map((phrasalVerb) => ({
          id: this.toNumber(phrasalVerb.id),
          wmId: this.toNumber(phrasalVerb.wmId ?? phrasalVerb.wm_id),
          phrasalVerbs: this.toString(
            phrasalVerb.phrasalVerbs ?? phrasalVerb.phrasal_verbs,
          ),
          phoneticUk: this.toNullableString(
            phrasalVerb.phoneticUk ?? phrasalVerb.phonetic_uk,
          ),
          phoneticUs: this.toNullableString(
            phrasalVerb.phoneticUs ?? phrasalVerb.phonetic_us,
          ),
          audioUk: this.toNullableString(
            phrasalVerb.audioUk ?? phrasalVerb.audio_uk,
          ),
          audioUs: this.toNullableString(
            phrasalVerb.audioUs ?? phrasalVerb.audio_us,
          ),
        }));

        const idioms = this.toArray(item.idioms).map((idiom) => ({
          id: this.toNumber(idiom.id),
          wmId: this.toNumber(idiom.wmId ?? idiom.wm_id),
          idiom: this.toString(idiom.idiom),
          audio: this.toNullableString(idiom.audio),
          definition: this.toNullableString(idiom.definition),
          definitionGpt: this.toNullableString(
            idiom.definitionGpt ?? idiom.definition_gpt,
          ),
          example: this.toNullableString(idiom.example),
          idiomsExAudio: this.toNullableString(
            idiom.idiomsExAudio ?? idiom.idioms_ex_audio,
          ),
          example2: this.toNullableString(idiom.example2),
          stressed: this.toNullableString(idiom.stressed),
          reason: this.toNullableString(idiom.reason),
          idiomsTran: this.toObject(idiom.idiomsTran ?? idiom.idioms_tran),
          pivot: this.toObject(idiom.pivot) ?? {},
        }));

        const rawVerbForm = this.toObject(item.verbForm ?? item.verb_form);
        const verbForm: DictionaryVerbForm | null = rawVerbForm
          ? {
              id: this.toNumber(rawVerbForm.id),
              wmId: this.toNumber(rawVerbForm.wmId ?? rawVerbForm.wm_id),
              presentSimple: this.toNullableString(
                rawVerbForm.presentSimple ?? rawVerbForm.present_simple,
              ),
              presentSimplePhonetic: this.toNullableString(
                rawVerbForm.presentSimplePhonetic ??
                  rawVerbForm.present_simple_phonetic,
              ),
              presentSimpleAudioUs: this.toNullableString(
                rawVerbForm.presentSimpleAudioUs ??
                  rawVerbForm.present_simple_audio_us,
              ),
              presentSimpleAudioUk: this.toNullableString(
                rawVerbForm.presentSimpleAudioUk ??
                  rawVerbForm.present_simple_audio_uk,
              ),
              singularVerb: this.toNullableString(
                rawVerbForm.singularVerb ?? rawVerbForm.singular_verb,
              ),
              singularVerbPhonetic: this.toNullableString(
                rawVerbForm.singularVerbPhonetic ??
                  rawVerbForm.singular_verb_phonetic,
              ),
              singularVerbAudioUs: this.toNullableString(
                rawVerbForm.singularVerbAudioUs ??
                  rawVerbForm.singular_verb_audio_us,
              ),
              singularVerbAudioUk: this.toNullableString(
                rawVerbForm.singularVerbAudioUk ??
                  rawVerbForm.singular_verb_audio_uk,
              ),
              pastSimple: this.toNullableString(
                rawVerbForm.pastSimple ?? rawVerbForm.past_simple,
              ),
              pastSimplePhonetic: this.toNullableString(
                rawVerbForm.pastSimplePhonetic ??
                  rawVerbForm.past_simple_phonetic,
              ),
              pastSimpleAudioUs: this.toNullableString(
                rawVerbForm.pastSimpleAudioUs ??
                  rawVerbForm.past_simple_audio_us,
              ),
              pastSimpleAudioUk: this.toNullableString(
                rawVerbForm.pastSimpleAudioUk ??
                  rawVerbForm.past_simple_audio_uk,
              ),
              pastParticiple: this.toNullableString(
                rawVerbForm.pastParticiple ?? rawVerbForm.past_participle,
              ),
              pastParticiplePhonetic: this.toNullableString(
                rawVerbForm.pastParticiplePhonetic ??
                  rawVerbForm.past_participle_phonetic,
              ),
              pastParticipleAudioUs: this.toNullableString(
                rawVerbForm.pastParticipleAudioUs ??
                  rawVerbForm.past_participle_audio_us,
              ),
              pastParticipleAudioUk: this.toNullableString(
                rawVerbForm.pastParticipleAudioUk ??
                  rawVerbForm.past_participle_audio_uk,
              ),
              ingForm: this.toNullableString(
                rawVerbForm.ingForm ?? rawVerbForm.ing_form,
              ),
              ingFormPhonetic: this.toNullableString(
                rawVerbForm.ingFormPhonetic ?? rawVerbForm.ing_form_phonetic,
              ),
              ingFormAudioUs: this.toNullableString(
                rawVerbForm.ingFormAudioUs ?? rawVerbForm.ing_form_audio_us,
              ),
              ingFormAudioUk: this.toNullableString(
                rawVerbForm.ingFormAudioUk ?? rawVerbForm.ing_form_audio_uk,
              ),
            }
          : null;

        const thesaurus = this.toArray(item.thesaurus).map((thesaurusItem) => ({
          id: this.toNumber(thesaurusItem.id),
          wmId: this.toNumber(thesaurusItem.wmId ?? thesaurusItem.wm_id),
          position: this.toString(thesaurusItem.position),
          positionContent: this.toString(
            thesaurusItem.positionContent ?? thesaurusItem.position_content,
          ),
          strongestMatch: this.toString(
            thesaurusItem.strongestMatch ?? thesaurusItem.strongest_match,
          ),
          strongMatch: this.toString(
            thesaurusItem.strongMatch ?? thesaurusItem.strong_match,
          ),
          weakMatch: this.toString(
            thesaurusItem.weakMatch ?? thesaurusItem.weak_match,
          ),
          strongestOpposite: this.toString(
            thesaurusItem.strongestOpposite ?? thesaurusItem.strongest_opposite,
          ),
          strongOpposite: this.toString(
            thesaurusItem.strongOpposite ?? thesaurusItem.strong_opposite,
          ),
          weakOpposite: this.toString(
            thesaurusItem.weakOpposite ?? thesaurusItem.weak_opposite,
          ),
          createdAt: this.toNullableString(
            thesaurusItem.createdAt ?? thesaurusItem.created_at,
          ),
          updatedAt: this.toNullableString(
            thesaurusItem.updatedAt ?? thesaurusItem.updated_at,
          ),
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
          analyzing,
          phrasalVerbs,
          idioms,
          verbForm,
          thesaurus,
          isSaved: false,
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

      return this.withSavedStatus(result, userId);
    } catch {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'MOCHI_INVALID_RESPONSE',
        message: 'Mochi dictionary service returned invalid response',
      });
    }
  }

  private buildCacheKey(query: DictionarySearchDto) {
    return buildCacheKey('dictionary', {
      params: {
        endpoint: 'search',
        word: query.word.trim().toLowerCase(),
        language: query.language ?? 'vi',
        type: query.type ?? 'web',
        definition: query.definition ?? 0,
        searchIelts: query.searchIelts ?? 1,
      },
    });
  }

  private async getCachedResult(cacheKey: string) {
    return this.redisService.getJson<DictionarySearchResult>(cacheKey);
  }

  private async setCachedResult(
    cacheKey: string,
    result: DictionarySearchResult,
  ) {
    await this.redisService.setJson(cacheKey, result, CACHE_TTL_SECONDS.LONG);
  }

  private async invalidateRelatedCaches() {
    await this.redisService.delByPatterns([
      buildScopePattern('dictionary'),
      buildScopePattern('words'),
      buildScopePattern('lessons'),
      buildScopePattern('courses'),
      buildScopePattern('progress'),
      buildScopePattern('vocabulary'),
      buildScopePattern('practice'),
    ]);
  }

  private enqueueBackgroundSync(entries: DictionaryEntry[]) {
    setImmediate(() => {
      void this.syncWordsFromDictionary(entries);
    });
  }

  private async syncWordsFromDictionary(entries: DictionaryEntry[]) {
    let hasInsertedNewWord = false;

    for (const entry of entries) {
      if (!Number.isInteger(entry.id) || entry.id <= 0) {
        continue;
      }

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
        const existingByExternalId = await this.prisma.word.findFirst({
          where: {
            sourceProvider: 'mochi',
            externalDictionaryId: entry.id,
          },
          select: { id: true },
        });

        if (existingByExternalId) {
          continue;
        }

        const existingByWord = await this.prisma.word.findFirst({
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

        if (existingByWord) {
          continue;
        }

        await this.prisma.word.create({
          data: {
            sourceProvider: 'mochi',
            externalDictionaryId: entry.id,
            ...updatePayload,
            dictionaryMetadata: {
              sourceProvider: 'mochi',
              externalDictionaryId: entry.id,
            },
          },
        });
        hasInsertedNewWord = true;
      } catch {
        // background sync should be best-effort and must not break API
      }
    }

    if (hasInsertedNewWord) {
      await this.invalidateRelatedCaches();
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

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value === null || value === undefined) {
      return '';
    }

    return '';
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

  private toNumberish(value: unknown): number | string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return value;
    }

    return this.toString(value);
  }

  private toObject(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private async withSavedStatus(
    result: DictionarySearchResult,
    userId?: string,
  ): Promise<DictionarySearchResult> {
    if (!userId) {
      return {
        ...result,
        data: result.data.map((entry) => ({
          ...entry,
          isSaved: false,
          words: entry.words.map((word) => ({ ...word, isSaved: false })),
        })),
      };
    }

    const detailExternalIds = result.data
      .flatMap((entry) => entry.words.map((word) => word.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const entryExternalIds = result.data
      .map((entry) => entry.id)
      .filter((id) => Number.isInteger(id) && id > 0);

    const externalIds = Array.from(
      new Set([...detailExternalIds, ...entryExternalIds]),
    );

    if (externalIds.length === 0) {
      return {
        ...result,
        data: result.data.map((entry) => ({
          ...entry,
          isSaved: false,
          words: entry.words.map((word) => ({ ...word, isSaved: false })),
        })),
      };
    }

    const savedWords = await this.prisma.word.findMany({
      where: {
        sourceProvider: 'mochi',
        externalDictionaryId: { in: externalIds },
        vocabularyNotes: {
          some: {
            userId,
          },
        },
      },
      select: {
        externalDictionaryId: true,
      },
    });

    const savedExternalIdSet = new Set(
      savedWords
        .map((word) => word.externalDictionaryId)
        .filter((id): id is number => typeof id === 'number'),
    );

    return {
      ...result,
      data: result.data.map((entry) => ({
        ...entry,
        words: entry.words.map((word) => ({
          ...word,
          isSaved:
            savedExternalIdSet.has(word.id) || savedExternalIdSet.has(entry.id),
        })),
        isSaved:
          savedExternalIdSet.has(entry.id) ||
          entry.words.some((word) => savedExternalIdSet.has(word.id)),
      })),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../ollama/ollama.service';
import {
  GenerateListeningContentDto,
  SegmentInputDto,
  GeneratedVocabularyItemDto,
  GeneratedQuizQuestionDto,
  GeneratedListeningLessonResponseDto,
} from './dtos/listening-ai.dto';

const MOCHI_PRIVATE_KEY = 'M0ch1M0ch1_En_$ecret_k3y';
const MOCHI_BASE_URL =
  'https://mochien-server-release.mochidemy.com/api/v5.0/words/dictionary-english';

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
  'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
  'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
  'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were',
]);

interface MochiWordResult {
  externalDictionaryId?: number;
  word: string;
  partOfSpeech?: string;
  phonetic?: string;
  meaningVi: string;
  audioUrl?: string;
  example?: string;
  exampleVi?: string;
}

@Injectable()
export class ListeningAiService {
  private readonly logger = new Logger(ListeningAiService.name);

  constructor(private readonly ollamaService: OllamaService) {}

  /**
   * Main pipeline to generate 3-step dynamic listening content.
   */
  async generateListeningContent(
    dto: GenerateListeningContentDto,
  ): Promise<GeneratedListeningLessonResponseDto> {
    const { segments, difficulty = 'medium', targetVocabCount = 12, targetQuizCount = 4 } = dto;

    this.logger.log(
      `[ListeningAI] Starting content generation — segments=${segments.length} difficulty=${difficulty} targetVocab=${targetVocabCount} targetQuiz=${targetQuizCount}`,
    );

    // Run Stage 1 (Vocab) and Stage 2 (Quizzes) concurrently
    const [vocabularyList, quizQuestions] = await Promise.all([
      this.extractVocabulary(segments, difficulty, targetVocabCount),
      this.generateQuizQuestions(segments, difficulty, targetQuizCount),
    ]);

    this.logger.log(
      `[ListeningAI] Content generation completed — vocabCount=${vocabularyList.length} quizCount=${quizQuestions.length}`,
    );

    return {
      vocabularyList,
      quizQuestions,
    };
  }

  /**
   * Stage 1: Extract 10-15 key vocabulary words from transcript chunks and enrich with Mochi Dictionary.
   */
  async extractVocabulary(
    segments: SegmentInputDto[],
    difficulty: string = 'medium',
    targetCount: number = 12,
  ): Promise<GeneratedVocabularyItemDto[]> {
    if (!segments || segments.length === 0) {
      return [];
    }

    const chunks = this.chunkSegments(segments, 400);
    const cefrTarget =
      difficulty === 'easy' ? 'A2 to B1' : difficulty === 'hard' ? 'B2 to C1' : 'B1 to B2';

    // Extract candidate words from each chunk
    const candidatePromises = chunks.map(async (chunk, idx) => {
      const chunkText = chunk.map((s) => s.text).join(' ');
      const prompt = `
You are an expert English lexicographer and ESL teacher.
Analyze the following English transcript section and extract 5 to 7 high-value academic or topic-specific vocabulary words or idiomatic collocations suitable for ${cefrTarget} learners.

Transcript Section:
"${chunkText}"

Rules:
1. ONLY pick single words or 2-word collocations that genuinely appear in the transcript section.
2. DO NOT pick simple everyday stopwords (e.g. they, make, good, look).
3. Return ONLY a valid JSON object with the format:
{
  "words": [
    {
      "word": "lowercase word or collocation",
      "context_sentence": "sentence containing the word from the transcript"
    }
  ]
}
`;
      try {
        const res = await this.ollamaService.chat({
          modelProfile: 'chat',
          messages: [{ role: 'user', content: prompt }],
          json: true,
          temperature: 0.3,
        });

        const parsed = this.parseJsonSafe<{
          words: Array<{ word: string; context_sentence?: string }>;
        }>(res.content);

        return parsed?.words || [];
      } catch (err) {
        this.logger.warn(
          `[ListeningAI] Vocab extraction failed for chunk ${idx}: ${(err as Error).message}`,
        );
        return [];
      }
    });

    const candidateLists = await Promise.all(candidatePromises);
    const flattenedCandidates = candidateLists.flat();

    // Deduplicate candidates preserving context sentence
    const uniqueWordMap = new Map<string, string>();
    for (const item of flattenedCandidates) {
      const cleanWord = item.word?.trim().toLowerCase();
      if (
        cleanWord &&
        cleanWord.length >= 3 &&
        !STOP_WORDS.has(cleanWord) &&
        !uniqueWordMap.has(cleanWord)
      ) {
        uniqueWordMap.set(cleanWord, item.context_sentence || '');
      }
    }

    // If candidate list is small, extract potential words by length & frequency heuristic
    if (uniqueWordMap.size < targetCount) {
      const fullText = segments.map((s) => s.text).join(' ');
      const matches = fullText.match(/\b[a-zA-Z]{5,}\b/g) || [];
      for (const w of matches) {
        const lower = w.toLowerCase();
        if (!STOP_WORDS.has(lower) && !uniqueWordMap.has(lower)) {
          // find sentence
          const seg = segments.find((s) => s.text.toLowerCase().includes(lower));
          uniqueWordMap.set(lower, seg ? seg.text : '');
          if (uniqueWordMap.size >= targetCount + 5) break;
        }
      }
    }

    const selectedWords = Array.from(uniqueWordMap.entries()).slice(0, targetCount);

    // Enrich each word with standard Mochi Dictionary data
    const enrichedPromises = selectedWords.map(async ([word, contextSentence], index) => {
      const mochiData = await this.lookupMochiDictionary(word);

      if (mochiData) {
        return {
          id: index + 1,
          word: mochiData.word,
          partOfSpeech: mochiData.partOfSpeech || 'n',
          phonetic: mochiData.phonetic || '',
          meaningVi: mochiData.meaningVi,
          example: contextSentence || mochiData.example || '',
          exampleVi: mochiData.exampleVi || '',
          audioUrl: mochiData.audioUrl || null,
          externalDictionaryId: mochiData.externalDictionaryId || null,
        };
      }

      // If word not found in Mochi dictionary, generate accurate definition via LLM
      const fallbackItem = await this.generateSingleVocabDefinition(word, contextSentence);
      return {
        id: index + 1,
        ...fallbackItem,
      };
    });

    return Promise.all(enrichedPromises);
  }

  /**
   * Stage 2: Generate 3-5 high quality comprehension quiz questions based on chronological checkpoints.
   */
  async generateQuizQuestions(
    segments: SegmentInputDto[],
    difficulty: string = 'medium',
    targetCount: number = 4,
  ): Promise<GeneratedQuizQuestionDto[]> {
    if (!segments || segments.length === 0) {
      return [];
    }

    // Select checkpoint indices across the timeline
    const checkpoints = this.selectCheckpoints(segments, targetCount);

    const quizPromises = checkpoints.map(async (checkpoint, qIdx) => {
      const windowSegments = this.getSegmentWindow(segments, checkpoint.segmentIndex, 6);
      const windowStart = windowSegments[0]?.start ?? checkpoint.timestamp;
      const windowEnd = windowSegments[windowSegments.length - 1]?.end ?? (windowStart + 15);

      const formattedLines = windowSegments
        .map((s) => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: "${s.text}"`)
        .join('\n');
      const timestamp = checkpoint.timestamp;

      const prompt = `
You are an expert English teacher creating listening comprehension multiple-choice questions for IELTS/TOEFL practice.
Target Difficulty: ${difficulty}

Timestamped Transcript Section (around ${Math.floor(timestamp)}s):
${formattedLines}

Requirements:
1. Create 1 deep comprehension or key takeaway multiple-choice question based strictly on what is stated or implied in the section above.
2. Provide 4 answer options: 1 correct option and 3 plausible, well-crafted distractors.
3. Provide a clear explanation in Vietnamese explaining why the correct option is right based on the speaker's words.
4. Specify "correct_answer_index" as 0, 1, 2, or 3.
5. Specify "start_time" and "end_time" (float numbers in seconds) marking the exact sentence(s) that provide the clue/answer for this question (must be within ${windowStart.toFixed(1)}s and ${windowEnd.toFixed(1)}s).

Return ONLY a valid JSON object with format:
{
  "question": "Question text in English",
  "options": [
    "Option 1",
    "Option 2",
    "Option 3",
    "Option 4"
  ],
  "correct_answer_index": 0,
  "explanation": "Giải thích chi tiết bằng tiếng Việt...",
  "start_time": ${windowStart.toFixed(1)},
  "end_time": ${windowEnd.toFixed(1)},
  "segment_timestamp": ${timestamp}
}
`;

      try {
        const res = await this.ollamaService.chat({
          modelProfile: 'chat',
          messages: [{ role: 'user', content: prompt }],
          json: true,
          temperature: 0.4,
        });

        const parsed = this.parseJsonSafe<{
          question: string;
          options: string[];
          correct_answer_index: number;
          explanation: string;
          start_time?: number;
          end_time?: number;
          segment_timestamp?: number;
        }>(res.content);

        if (!parsed || !parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 2) {
          throw new Error('Invalid quiz response structure from LLM');
        }

        // Ensure 4 options
        const options = parsed.options.slice(0, 4);
        while (options.length < 4) {
          options.push(`Alternative perspective on the topic discussed at ${Math.floor(timestamp)}s`);
        }

        let correctIndex = typeof parsed.correct_answer_index === 'number'
          ? Math.max(0, Math.min(3, parsed.correct_answer_index))
          : 0;

        // Distribute correct answer index dynamically across questions (0, 1, 2, 3)
        const desiredIndex = qIdx % 4;
        if (correctIndex !== desiredIndex && options.length === 4) {
          const correctVal = options[correctIndex];
          const swapVal = options[desiredIndex];
          options[desiredIndex] = correctVal;
          options[correctIndex] = swapVal;
          correctIndex = desiredIndex;
        }

        const validStartTime =
          typeof parsed.start_time === 'number' && parsed.start_time >= 0
            ? parsed.start_time
            : windowStart;
        const validEndTime =
          typeof parsed.end_time === 'number' && parsed.end_time > validStartTime
            ? parsed.end_time
            : windowEnd;

        return {
          id: qIdx + 1,
          question: parsed.question,
          options,
          correctAnswerIndex: correctIndex,
          explanation: parsed.explanation || 'Đáp án chính xác được rút ra từ lời nói của người nói trong đoạn video.',
          segmentTimestamp: validStartTime,
          startTime: Number(validStartTime.toFixed(1)),
          endTime: Number(validEndTime.toFixed(1)),
        };
      } catch (err) {
        this.logger.warn(
          `[ListeningAI] Quiz generation failed for checkpoint ${qIdx}: ${(err as Error).message}`,
        );
        return {
          id: qIdx + 1,
          question: `What is the key idea discussed around ${Math.floor(timestamp)}s in the audio?`,
          options: [
            `Understanding the main concept: "${windowSegments[0]?.text.slice(0, 50) || 'Main takeaway'}..."`,
            'Ignoring the detailed steps and relying on intuition alone',
            'Comparing completely unrelated topics without context',
            'Stopping practice immediately after starting',
          ],
          correctAnswerIndex: 0,
          explanation: 'Ý chính được người nói đề cập trực tiếp trong đoạn nghe này.',
          segmentTimestamp: windowStart,
          startTime: Number(windowStart.toFixed(1)),
          endTime: Number(windowEnd.toFixed(1)),
        };
      }
    });

    return Promise.all(quizPromises);
  }

  /**
   * Look up standard word details from Mochi Dictionary API.
   */
  async lookupMochiDictionary(word: string): Promise<MochiWordResult | null> {
    const cleanWord = word.trim().toLowerCase();
    const url = new URL(MOCHI_BASE_URL);
    url.searchParams.set('key', cleanWord);
    url.searchParams.set('language', 'vi');
    url.searchParams.set('type', 'web');
    url.searchParams.set('definition', '1');
    url.searchParams.set('search_ielts', '1');

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          privateKey: MOCHI_PRIVATE_KEY,
        },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as any;
      if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) {
        return null;
      }

      const entry = payload.data[0];
      const wordDetail = entry?.words?.[0] || entry;

      const meaningVi = wordDetail?.trans || wordDetail?.definition || `Nghĩa của từ ${cleanWord}`;
      const phonetic = entry?.phoneticUs || entry?.phoneticUk || wordDetail?.phonetic || '';
      const audioUrl = entry?.audioUs || entry?.audioUk || wordDetail?.audio || null;
      const partOfSpeech = entry?.position || wordDetail?.position || 'n';
      const externalDictionaryId = wordDetail?.id || entry?.id || null;

      // Extract example if present in Mochi
      let example = '';
      let exampleVi = '';
      if (Array.isArray(wordDetail?.sentenceAudio) && wordDetail.sentenceAudio.length > 0) {
        example = wordDetail.sentenceAudio[0]?.key || '';
        exampleVi = wordDetail.sentenceAudio[0]?.trans || '';
      }

      return {
        word: entry.content || cleanWord,
        partOfSpeech,
        phonetic,
        meaningVi,
        audioUrl,
        externalDictionaryId,
        example,
        exampleVi,
      };
    } catch (err) {
      this.logger.debug(
        `[ListeningAI] Mochi dictionary lookup failed for "${cleanWord}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Helper to generate phonetic and Vietnamese translation for words not in Mochi Dictionary.
   */
  private async generateSingleVocabDefinition(
    word: string,
    contextSentence: string,
  ): Promise<Omit<GeneratedVocabularyItemDto, 'id'>> {
    const prompt = `
Provide the accurate IPA phonetic transcription, part of speech (n, v, adj, adv), Vietnamese translation, and translated example for this English word: "${word}".
Context sentence: "${contextSentence || word}"

Return ONLY a JSON object:
{
  "word": "${word}",
  "part_of_speech": "n",
  "phonetic": "/.../",
  "meaning_vi": "Nghĩa tiếng Việt ngắn gọn và chính xác",
  "example": "${contextSentence || `Example with ${word}`}",
  "example_vi": "Dịch câu ví dụ sang tiếng Việt"
}
`;
    try {
      const res = await this.ollamaService.chat({
        modelProfile: 'chat',
        messages: [{ role: 'user', content: prompt }],
        json: true,
        temperature: 0.2,
      });

      const parsed = this.parseJsonSafe<any>(res.content);
      return {
        word: parsed?.word || word,
        partOfSpeech: parsed?.part_of_speech || 'word',
        phonetic: parsed?.phonetic || `/${word}/`,
        meaningVi: parsed?.meaning_vi || `Từ vựng: ${word}`,
        example: parsed?.example || contextSentence || '',
        exampleVi: parsed?.example_vi || '',
        audioUrl: null,
        externalDictionaryId: null,
      };
    } catch {
      return {
        word,
        partOfSpeech: 'word',
        phonetic: `/${word}/`,
        meaningVi: `Từ vựng: ${word}`,
        example: contextSentence || '',
        exampleVi: '',
        audioUrl: null,
        externalDictionaryId: null,
      };
    }
  }

  /**
   * Group segments into chunks of ~targetWordCount words.
   */
  private chunkSegments(segments: SegmentInputDto[], targetWordCount = 400): SegmentInputDto[][] {
    const chunks: SegmentInputDto[][] = [];
    let currentChunk: SegmentInputDto[] = [];
    let currentWordCount = 0;

    for (const seg of segments) {
      const wordCount = seg.text.split(/\s+/).length;
      currentChunk.push(seg);
      currentWordCount += wordCount;

      if (currentWordCount >= targetWordCount) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentWordCount = 0;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [segments];
  }

  /**
   * Select evenly distributed checkpoint indices across segments.
   */
  private selectCheckpoints(
    segments: SegmentInputDto[],
    count: number,
  ): Array<{ segmentIndex: number; timestamp: number }> {
    if (segments.length <= count) {
      return segments.map((s, idx) => ({
        segmentIndex: idx,
        timestamp: s.start,
      }));
    }

    const step = (segments.length - 1) / (count + 1);
    const checkpoints: Array<{ segmentIndex: number; timestamp: number }> = [];

    for (let i = 1; i <= count; i++) {
      const idx = Math.min(segments.length - 1, Math.round(i * step));
      checkpoints.push({
        segmentIndex: idx,
        timestamp: segments[idx].start,
      });
    }

    return checkpoints;
  }

  /**
   * Get a local window of segments around a target index.
   */
  private getSegmentWindow(
    segments: SegmentInputDto[],
    centerIdx: number,
    radius = 5,
  ): SegmentInputDto[] {
    const start = Math.max(0, centerIdx - radius);
    const end = Math.min(segments.length, centerIdx + radius + 1);
    return segments.slice(start, end);
  }

  private parseJsonSafe<T>(input: string): T | null {
    if (!input) return null;
    const sanitized = input
      .replace(/^```json\s*/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      return JSON.parse(sanitized) as T;
    } catch {
      return null;
    }
  }
}

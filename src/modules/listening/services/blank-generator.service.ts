import { Injectable } from '@nestjs/common';
import type { BlankItemDto, TranscriptSegmentDto } from '../dtos';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'after',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'shall',
  'this', 'that', 'these', 'those', 'it', 'its', 'he', 'him', 'his', 'she',
  'her', 'hers', 'they', 'them', 'their', 'theirs', 'we', 'us', 'our', 'ours',
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours',
]);

/**
 * Service to generate Cloze (fill-in-the-blank) exercises from transcript sentences.
 */
@Injectable()
export class BlankGeneratorService {
  /**
   * Masks target keywords in transcript segments based on difficulty and priority vocabulary.
   */
  generateBlanks(
    segments: Array<{ id: number; start: number; end: number; duration: number; text: string }>,
    difficulty = 'medium',
    targetVocabulary?: string[],
  ): TranscriptSegmentDto[] {
    const targetRatio = difficulty === 'easy' ? 0.2 : difficulty === 'medium' ? 0.3 : 0.4;
    const minLength = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 3 : 2;

    const targetVocabSet = new Set(
      (targetVocabulary || []).map((v) => v.toLowerCase().trim()).filter(Boolean),
    );

    return segments.map((seg) => {
      const words = seg.text.split(/\s+/).filter(Boolean);
      const priorityIndices: number[] = [];
      const otherIndices: number[] = [];

      for (let i = 0; i < words.length; i++) {
        const cleanWord = words[i].replace(/[^\w]/g, '').toLowerCase();
        if (cleanWord.length >= minLength && !STOP_WORDS.has(cleanWord)) {
          if (targetVocabSet.has(cleanWord)) {
            priorityIndices.push(i);
          } else {
            otherIndices.push(i);
          }
        }
      }

      const targetCount = Math.max(1, Math.floor(words.length * targetRatio));
      const combined = [...priorityIndices, ...otherIndices.filter((idx) => !priorityIndices.includes(idx))];
      const selectedIndices = combined.slice(0, targetCount).sort((a, b) => a - b);

      const maskedWords = [...words];
      const blanks: BlankItemDto[] = [];

      selectedIndices.forEach((wordPos, blankIdx) => {
        const originalToken = words[wordPos];
        const match = originalToken.match(/^([^\w]*)([\w]+)([^\w]*)$/);
        if (!match) return;

        const [, prefix, targetWord, suffix] = match;
        const hint = `${targetWord[0]}${'_'.repeat(targetWord.length - 1)} (${targetWord.length} letters)`;

        maskedWords[wordPos] = `${prefix}_____${suffix}`;
        blanks.push({
          index: blankIdx,
          originalWord: targetWord,
          hint,
        });
      });

      return {
        id: seg.id,
        start: seg.start,
        end: seg.end,
        duration: seg.duration,
        text: seg.text,
        maskedText: maskedWords.join(' '),
        blanks,
      };
    });
  }
}

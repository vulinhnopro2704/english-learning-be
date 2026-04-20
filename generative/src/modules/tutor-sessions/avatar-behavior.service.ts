import { Injectable } from '@nestjs/common';

interface LipSyncCue {
  start: number;
  end: number;
  value: string;
}

interface AvatarBehavior {
  facialExpression: string;
  animation: string;
  lipSync: {
    mouthCues: LipSyncCue[];
  };
}

const FACIAL_EXPRESSION_BY_EMOTION: Record<string, string> = {
  NEUTRAL: 'default',
  SMILE: 'smile',
  THINKING: 'thinking',
  ENCOURAGING: 'smile',
  CELEBRATE: 'happy',
  CORRECTIVE_SOFT: 'concerned',
};

const ANIMATION_BY_STATE: Record<string, string> = {
  IDLE: 'Idle',
  LISTENING: 'Listening',
  THINKING: 'Thinking',
  TALKING: 'Talking',
  GESTURE_EXPLAIN: 'Talking',
  GESTURE_PRAISE: 'Talking',
};

@Injectable()
export class AvatarBehaviorService {
  createAvatarBehavior(input: {
    text: string;
    emotionState: string;
    animationState: string;
  }): AvatarBehavior {
    return {
      facialExpression:
        FACIAL_EXPRESSION_BY_EMOTION[input.emotionState] ?? 'default',
      animation: ANIMATION_BY_STATE[input.animationState] ?? 'Talking',
      lipSync: {
        mouthCues: this.buildMouthCues(input.text),
      },
    };
  }

  private buildMouthCues(text: string): LipSyncCue[] {
    const words = text
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (words.length === 0) {
      return [{ start: 0, end: 0.1, value: 'X' }];
    }

    const estimatedDurationSec = Math.max(1.2, words.length * 0.24);
    const step = estimatedDurationSec / words.length;

    return words.map((word, index) => {
      const start = Number((index * step).toFixed(3));
      const end = Number(Math.max(start + 0.06, (index + 1) * step).toFixed(3));

      return {
        start,
        end,
        value: this.inferViseme(word),
      };
    });
  }

  private inferViseme(word: string): string {
    const normalized = word.toLowerCase();

    if (/[bpmy]/.test(normalized)) {
      return 'A';
    }

    if (/[fv]/.test(normalized)) {
      return 'G';
    }

    if (/[ou]/.test(normalized)) {
      return 'E';
    }

    if (/[i]/.test(normalized)) {
      return 'C';
    }

    if (/[ae]/.test(normalized)) {
      return 'D';
    }

    return 'X';
  }
}

import { Injectable } from '@nestjs/common';

interface AvatarBehavior {
  facialExpression: string;
  animation: string;
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
    emotionState: string;
    animationState: string;
  }): AvatarBehavior {
    return {
      facialExpression:
        FACIAL_EXPRESSION_BY_EMOTION[input.emotionState] ?? 'default',
      animation: ANIMATION_BY_STATE[input.animationState] ?? 'Talking',
    };
  }
}

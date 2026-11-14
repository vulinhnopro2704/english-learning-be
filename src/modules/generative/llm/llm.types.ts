export interface TutorCorrection {
  hasError: boolean;
  correctedVersion: string;
  shortReason: string;
}

export interface TutorLlmResponse {
  tutorText: string;
  emotionState: string;
  animationState: string;
  correction: TutorCorrection;
}

export interface GenerateTutorResponseInput {
  userInput: string;
  cefrLevel: string;
  focusTopics: string[];
  recentTurns: Array<{
    userInput: string;
    tutorText: string;
  }>;
}

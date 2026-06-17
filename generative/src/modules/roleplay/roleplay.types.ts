export interface TaskEvaluation {
  task_1_completed: boolean;
  task_2_completed: boolean;
  task_3_completed: boolean;
}

export interface RoleplayLlmResponse {
  ai_spoken_response: string;
  task_evaluation: TaskEvaluation;
  grammar_feedback: string | null;
  scenario_completed: boolean;
}

export interface StartRoleplayResult {
  sessionId: string;
  ai_first_message: string;
  audio?: {
    url: string | null;
    mimeType: string;
    provider: string;
    status: 'completed' | 'skipped' | 'failed';
    source: string;
  } | null;
}

export interface ChatRoleplayResult {
  ai_spoken_response: string;
  task_evaluation: TaskEvaluation;
  grammar_feedback: string | null;
  scenario_completed: boolean;
  audio?: {
    url: string | null;
    mimeType: string;
    provider: string;
    status: 'completed' | 'skipped' | 'failed';
    source: string;
  } | null;
}

export interface ChatVoiceRoleplayResult {
  user_spoken_transcript: string;
  ai_spoken_response: string;
  task_evaluation: TaskEvaluation;
  grammar_feedback: string | null;
  scenario_completed: boolean;
  audio?: {
    url: string | null;
    mimeType: string;
    provider: string;
    status: 'completed' | 'skipped' | 'failed';
    source: string;
  } | null;
}

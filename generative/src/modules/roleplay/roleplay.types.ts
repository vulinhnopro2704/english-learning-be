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
}

export interface ChatRoleplayResult {
  ai_spoken_response: string;
  task_evaluation: TaskEvaluation;
  grammar_feedback: string | null;
  scenario_completed: boolean;
}

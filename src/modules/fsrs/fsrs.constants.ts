/**
 * Auto-grading response time thresholds (in milliseconds) per exercise type.
 */
export interface ExerciseThreshold {
  easyMaxMs: number;
  hardMinMs: number;
}

export const GRADE_THRESHOLDS: Record<string, ExerciseThreshold> = {
  FLASHCARD: { easyMaxMs: 3000, hardMinMs: 10000 },
  FLIP: { easyMaxMs: 3000, hardMinMs: 10000 },
  MULTI_CHOICE: { easyMaxMs: 3000, hardMinMs: 8000 },
  MULTIPLE_CHOICE: { easyMaxMs: 3000, hardMinMs: 8000 },
  LISTEN_FILL: { easyMaxMs: 5000, hardMinMs: 15000 },
  DICTATION: { easyMaxMs: 8000, hardMinMs: 20000 },
  FILL_BLANK: { easyMaxMs: 5000, hardMinMs: 15000 },
  MEANING_LOOKUP: { easyMaxMs: 4000, hardMinMs: 12000 },
  SPEED_CHALLENGE: { easyMaxMs: 2000, hardMinMs: 6000 },
  WORD_PUZZLE: { easyMaxMs: 5000, hardMinMs: 15000 },
  MATCHING_PAIRS: { easyMaxMs: 6000, hardMinMs: 18000 },
  STREAK_CHALLENGE: { easyMaxMs: 2000, hardMinMs: 5000 },
  PRONUNCIATION: { easyMaxMs: 5000, hardMinMs: 15000 },
};

export const DEFAULT_THRESHOLD: ExerciseThreshold = {
  easyMaxMs: 3000,
  hardMinMs: 10000,
};

/**
 * Default FSRS v5 / v6 parameters (21 weights).
 */
export const DEFAULT_FSRS_PARAMETERS: number[] = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034,
  0.6567, 0.2078, 0.2185,
];

export const FSRS_TRAINING_POLICY = {
  MIN_VALID_LOGS: 20,
  MIN_DAYS_SINCE_LAST: 3,
  MIN_IMPROVEMENT_PCT: 0.02,
} as const;

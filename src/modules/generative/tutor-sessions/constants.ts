export const TUTOR_SESSION_TTL_SECONDS = 24 * 60 * 60;
export const TUTOR_IDEMPOTENCY_TTL_SECONDS = 10 * 60;
export const TUTOR_STT_CACHE_TTL_SECONDS = 24 * 60 * 60;
export const TUTOR_TURNS_LIMIT = 20;

export const buildTutorSessionKey = (sessionId: string) =>
  `tutor:session:${sessionId}`;

export const buildTutorIdempotencyKey = (
  sessionId: string,
  clientTurnId: string,
) => `tutor:turn:${sessionId}:${clientTurnId}`;

export const buildTutorSttCacheKey = (audioFingerprint: string) =>
  `tutor:stt:${audioFingerprint}`;

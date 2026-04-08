export const CACHE_TTL_SECONDS = {
  SHORT: 60,
  MEDIUM: 60 * 5,
  LONG: 60 * 60 * 24,
} as const;

export type LearnCacheScope =
  | 'courses'
  | 'lessons'
  | 'words'
  | 'vocabulary'
  | 'progress'
  | 'practice'
  | 'streak'
  | 'dictionary';

const CACHE_NAMESPACE = 'learn:v1';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce(
        (acc, key) => {
          const nextValue = (value as Record<string, unknown>)[key];
          if (nextValue !== undefined) {
            acc[key] = sortValue(nextValue);
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );
  }

  return value;
}

export function buildCacheKey(
  scope: LearnCacheScope,
  options?: {
    userId?: string;
    params?: Record<string, unknown>;
  },
): string {
  const userSegment = options?.userId?.trim() || 'public';
  const serializedParams = encodeURIComponent(
    JSON.stringify(sortValue(options?.params ?? {})),
  );

  return `${CACHE_NAMESPACE}:${scope}:u:${userSegment}:q:${serializedParams}`;
}

export function buildScopePattern(
  scope: LearnCacheScope,
  userId?: string,
): string {
  if (userId?.trim()) {
    return `${CACHE_NAMESPACE}:${scope}:u:${userId}:*`;
  }

  return `${CACHE_NAMESPACE}:${scope}:*`;
}

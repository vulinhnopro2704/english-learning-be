import { DEFAULT_BODY_MAX, DEFAULT_PREVIEW_LENGTH } from './constants';
import type { RedactOptions, SanitizedBody } from './types';

const MAX_DEPTH = 8;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

const maskString = (value: string, previewLength: number): string => {
  const len = value.length;
  if (len === 0) return '[redacted len=0]';
  const head = value.slice(0, Math.min(previewLength, len));
  const tail = value.slice(Math.max(len - previewLength, previewLength));
  return `[redacted len=${len} preview=${head}...${tail}]`;
};

const shouldRedact = (key: string, redactKeys: Set<string>): boolean =>
  redactKeys.has(key.toLowerCase());

const cloneAndRedact = (value: unknown, key: string, opts: RedactOptions, depth = 0): unknown => {
  if (depth > MAX_DEPTH) {
    return '[truncated-depth]';
  }

  const redactSet = new Set(opts.redactKeys.map((k) => k.toLowerCase()));

  if (typeof value === 'string') {
    return shouldRedact(key, redactSet) ? maskString(value, opts.previewLength) : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return value as unknown;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[buffer len=${value.length}]`;
  }

  if (Array.isArray(value)) {
    return value.map((item, idx) => cloneAndRedact(item, key || String(idx), opts, depth + 1));
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [childKey, childVal] of Object.entries(value)) {
      out[childKey] = cloneAndRedact(childVal, childKey, opts, depth + 1);
    }
    return out;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return '[unserializable]';
  }
};

const serialize = (
  value: unknown,
  bodyMax: number,
): { printable: unknown; length: number; truncated: boolean } => {
  try {
    const json = JSON.stringify(value);
    if (json == null) {
      return { printable: value, length: 0, truncated: false };
    }
    const length = json.length;
    if (bodyMax > 0 && length > bodyMax) {
      return {
        printable: `${json.slice(0, bodyMax)}...[truncated ${length - bodyMax} chars]`,
        length,
        truncated: true,
      };
    }
    return { printable: value, length, truncated: false };
  } catch {
    return { printable: '[unserializable]', length: 0, truncated: false };
  }
};

export const sanitizeBody = (body: unknown, options?: Partial<RedactOptions>): SanitizedBody => {
  const opts: RedactOptions = {
    redactKeys: options?.redactKeys ?? [],
    previewLength: options?.previewLength ?? DEFAULT_PREVIEW_LENGTH,
    bodyMax: options?.bodyMax ?? DEFAULT_BODY_MAX,
  };

  const cloned = cloneAndRedact(body, '', opts, 0);
  const { printable, length, truncated } = serialize(cloned, opts.bodyMax ?? DEFAULT_BODY_MAX);

  return {
    value: printable,
    length,
    truncated,
  };
};

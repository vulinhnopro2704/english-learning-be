import type { Request } from 'express';
import { TRACE_ID_HEADER, DEFAULT_REDACT_KEYS } from './constants.js';
import { AppLogger } from './app-logger.js';
import { createRequestLoggerMiddleware } from './request-logger.middleware.js';
import { sanitizeBody } from './redactor.js';
import type { LoggerOptions, RequestLoggerOptions, SanitizedBody } from './types.js';

export {
  AppLogger,
  createRequestLoggerMiddleware,
  sanitizeBody,
  TRACE_ID_HEADER,
  DEFAULT_REDACT_KEYS,
};

export type { LoggerOptions, RequestLoggerOptions, SanitizedBody };

export const getTraceId = (req: Request): string | undefined => {
  const trace = req.header(TRACE_ID_HEADER) || (req as any).traceId;
  return trace ? String(trace) : undefined;
};

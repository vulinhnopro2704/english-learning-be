import type { Request } from 'express';
import { TRACE_ID_HEADER, DEFAULT_REDACT_KEYS } from './constants';
import { AppLogger } from './app-logger';
import { createRequestLoggerMiddleware } from './request-logger.middleware';
import { sanitizeBody } from './redactor';
import type { LoggerOptions, RequestLoggerOptions, SanitizedBody } from './types';

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

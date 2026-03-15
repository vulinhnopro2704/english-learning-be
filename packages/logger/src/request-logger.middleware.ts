import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_BODY_MAX, DEFAULT_REDACT_KEYS, TRACE_ID_HEADER } from './constants';
import { sanitizeBody } from './redactor';
import type { RequestLoggerOptions } from './types';
import { AppLogger } from './app-logger';

const getClientIp = (req: Request): string => {
  const forwarded = req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (req.ip || req.socket.remoteAddress || 'unknown') as string;
};

const levelForStatus = (status: number): 'log' | 'warn' | 'error' => {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'log';
};

const ensureTraceId = (req: Request, res: Response, headerKey: string): string => {
  const existing = req.header(headerKey) || req.headers[headerKey] || '';
  const traceId = existing ? String(existing) : uuidv4();
  (req as any).traceId = traceId;
  res.setHeader(headerKey, traceId);
  // expose to downstream
  req.headers[headerKey] = traceId;
  return traceId;
};

const sanitizeMaybe = (body: unknown, opts: RequestLoggerOptions) => {
  const redactionKeys = opts.redactKeys ?? DEFAULT_REDACT_KEYS;
  const bodyMax = opts.bodyMax ?? DEFAULT_BODY_MAX;
  return sanitizeBody(body, {
    redactKeys: redactionKeys,
    previewLength: 3,
    bodyMax,
  });
};

export const createRequestLoggerMiddleware = (options: RequestLoggerOptions = {}) => {
  const logger = options.logger ?? new AppLogger();
  const headerKey = options.headerTraceKey ?? TRACE_ID_HEADER;

  return (req: Request, res: Response, next: NextFunction): void => {
    const traceId = ensureTraceId(req, res, headerKey);
    const start = process.hrtime.bigint();

    const requestBody =
      options.logRequestBody === false ? undefined : sanitizeMaybe(req.body, options);

    let responseBody: unknown;
    const originalSend = res.send.bind(res);
    res.send = ((body?: any) => {
      responseBody = body;
      return originalSend(body);
    }) as Response['send'];

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationMs = Number(durationNs) / 1_000_000;
      const status = res.statusCode;

      const sanitizedResponse =
        options.logResponseBody === false ? undefined : sanitizeMaybe(responseBody, options);

      const payload = {
        traceId,
        method: req.method,
        path: req.originalUrl || req.url,
        status,
        durationMs: Number(durationMs.toFixed(2)),
        ip: getClientIp(req),
        user: {
          id: req.header('x-user-id'),
          email: req.header('x-user-email'),
          role: req.header('x-user-role'),
          jti: req.header('x-user-jti'),
        },
        userAgent: req.header('user-agent'),
        referer: req.header('referer'),
        request: requestBody
          ? {
              body: requestBody.value,
              length: requestBody.length,
              truncated: requestBody.truncated,
              contentType: req.header('content-type'),
            }
          : undefined,
        response: sanitizedResponse
          ? {
              body: sanitizedResponse.value,
              length: sanitizedResponse.length,
              truncated: sanitizedResponse.truncated,
              contentType: res.getHeader('content-type'),
            }
          : undefined,
      };

      const level = levelForStatus(status);
      if (level === 'error' && (logger as any).error) {
        (logger as any).error(payload, undefined, 'RequestLogger');
      } else if (level === 'warn' && (logger as any).warn) {
        (logger as any).warn(payload, 'RequestLogger');
      } else if ((logger as any).log) {
        (logger as any).log(payload, 'RequestLogger');
      }
    });

    next();
  };
};

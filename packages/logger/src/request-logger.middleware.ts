import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TRACE_ID_HEADER } from './constants';
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

const getPathWithoutQuery = (req: Request): string => {
  const path = req.originalUrl || req.url || '/';
  const [pathname] = path.split('?');
  return pathname || '/';
};

export const createRequestLoggerMiddleware = (options: RequestLoggerOptions = {}) => {
  const logger = options.logger ?? new AppLogger();
  const headerKey = options.headerTraceKey ?? TRACE_ID_HEADER;

  return (req: Request, res: Response, next: NextFunction): void => {
    const traceId = ensureTraceId(req, res, headerKey);
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationMs = Number(durationNs) / 1_000_000;
      const status = res.statusCode;
      const duration = Number(durationMs.toFixed(2));
      const method = req.method;
      const path = getPathWithoutQuery(req);
      const userId = req.header('x-user-id') || 'anonymous';
      const ip = getClientIp(req);

      const payload = `${method} ${path} -> ${status} (${duration}ms) trace=${traceId} user=${userId} ip=${ip}`;

      const level = levelForStatus(status);
      if (level === 'error' && (logger as any).error) {
        (logger as any).error(payload, undefined, 'HTTP');
      } else if (level === 'warn' && (logger as any).warn) {
        (logger as any).warn(payload, 'HTTP');
      } else if ((logger as any).log) {
        (logger as any).log(payload, 'HTTP');
      }
    });

    next();
  };
};

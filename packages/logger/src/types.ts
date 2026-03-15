import type { LoggerService } from '@nestjs/common';

export interface LoggerOptions {
  level?: string;
  dir?: string;
  filename?: string;
  maxSize?: string | number;
  maxFiles?: string | number;
}

export interface RedactOptions {
  redactKeys: string[];
  previewLength: number;
  bodyMax?: number;
}

export interface SanitizedBody {
  value: unknown;
  length: number;
  truncated: boolean;
}

export interface RequestLoggerOptions {
  logger?: LoggerService;
  redactKeys?: string[];
  headerTraceKey?: string;
  bodyMax?: number;
  logRequestBody?: boolean;
  logResponseBody?: boolean;
}

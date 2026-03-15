import { Injectable, LoggerService } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { LoggerOptions } from './types';

const timestamp = (): string => dayjs().format('YYYY/MM/DD HH:mm:ss');

const toMessage = (payload: unknown): string => {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const resolveOptions = (options?: LoggerOptions) => {
  const dir = options?.dir ?? process.env.LOGGER_DIR ?? 'logs';
  const filename = options?.filename ?? process.env.LOGGER_FILENAME ?? 'app-%DATE%.log';
  const maxSize = options?.maxSize ?? process.env.LOGGER_MAX_SIZE ?? '10m';
  const maxFiles = options?.maxFiles ?? process.env.LOGGER_MAX_FILES ?? '14d';
  const level = options?.level ?? process.env.LOGGER_LEVEL ?? 'info';
  return { dir, filename, maxSize, maxFiles, level };
};

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(options?: LoggerOptions) {
    const { dir, filename, maxFiles, maxSize, level } = resolveOptions(options);

    fs.mkdirSync(path.resolve(dir), { recursive: true });

    this.logger = createLogger({
      level,
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ context, message, level: lvl }) => {
              const app = chalk.green('[Nest]');
              const ctx = context ? chalk.yellow(`[${context}]`) : '';
              return `${app} - ${timestamp()} ${lvl} ${ctx} ${message}`;
            }),
          ),
        }),
        new DailyRotateFile({
          dirname: path.resolve(dir),
          filename,
          datePattern: 'YYYY-MM-DD',
          level,
          maxFiles,
          maxSize,
          zippedArchive: true,
          format: format.combine(format.timestamp(), format.json()),
        }),
      ],
    });
  }

  log(message: unknown, context?: string) {
    this.logger.log('info', toMessage(message), { context, time: timestamp() });
  }

  error(message: unknown, trace?: string, context?: string) {
    const payload = trace ? `${toMessage(message)} | trace=${trace}` : toMessage(message);
    this.logger.log('error', payload, { context, time: timestamp() });
  }

  warn(message: unknown, context?: string) {
    this.logger.log('warn', toMessage(message), { context, time: timestamp() });
  }

  debug(message: unknown, context?: string) {
    this.logger.log('debug', toMessage(message), { context, time: timestamp() });
  }

  verbose(message: unknown, context?: string) {
    this.logger.log('verbose', toMessage(message), { context, time: timestamp() });
  }
}

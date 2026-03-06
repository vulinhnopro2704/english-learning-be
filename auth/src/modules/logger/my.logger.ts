import { LoggerService } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import { createLogger, Logger, format, transports } from 'winston';
import 'winston-daily-rotate-file';

export class MyLogger implements LoggerService {
  private logger: Logger;
  constructor() {
    this.logger = createLogger({
      level: 'info',
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(
              ({
                context,
                message,
                level,
                time,
              }: {
                context: string;
                message: string;
                level: string;
                time: string;
              }) => {
                const strApp = chalk.green('[Nest]');
                const strContext = chalk.yellow(`[${context}]`);
                return `${strApp} - ${time} ${level} ${strContext} ${message}`;
              },
            ),
          ),
        }),
        new transports.DailyRotateFile({
          format: format.combine(format.json(), format.timestamp()),
          level: 'info',
          dirname: 'log-rotate',
          filename: 'demo-%DATE%.log',
          datePattern: 'YYYY-MM-DD HH-mm',
          zippedArchive: true,
          maxSize: 1024,
          maxFiles: '14d',
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    const time = dayjs(Date.now()).format('YYYY/MM/DD HH:mm:ss');
    this.logger.log('info', message, { context, time });
  }
  error(message: string, context?: string) {
    const time = dayjs(Date.now()).format('YYYY/MM/DD HH:mm:ss');
    this.logger.log('error', message, { context, time });
  }
  warn(message: string, context?: string) {
    const time = dayjs(Date.now()).format('YYYY/MM/DD HH:mm:ss');
    this.logger.log('warn', message, { context, time });
  }
  debug?(message: string, context?: string) {
    const time = dayjs(Date.now()).format('YYYY/MM/DD HH:mm:ss');
    this.logger.log('debug', message, { context, time });
  }
  verbose?(message: string, context?: string) {
    const time = dayjs(Date.now()).format('YYYY/MM/DD HH:mm:ss');
    this.logger.log('verbose', message, { context, time });
  }
  fatal?(message: string, context?: string) {
    const time = dayjs(Date.now()).format('YYYY/MM/DD HH:mm:ss');
    this.logger.log('fatal', message, { context, time });
  }
}

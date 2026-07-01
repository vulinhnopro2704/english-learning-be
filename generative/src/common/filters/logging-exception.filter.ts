import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from '@english-learning/nest-error-handler';

@Catch()
export class LoggingExceptionFilter extends GlobalExceptionFilter {
  private readonly filterLogger = new Logger('ExceptionFilter');

  override catch(exception: unknown, host: ArgumentsHost): void {
    this.filterLogger.error(
      `Unhandled Exception: ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    super.catch(exception, host);
  }
}

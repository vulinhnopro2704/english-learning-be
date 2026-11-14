import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  DEFAULT_ERROR_CODE_BY_STATUS,
  createApiErrorResponse,
  type ApiErrorResponse,
  type ApiFieldError,
} from '../types/api.types';

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = this.resolveStatusCode(exception);
    const traceId = (request?.headers['x-trace-id'] as string) || (request as any)?.traceId;
    const payload = this.normalizeException(exception, statusCode, traceId);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request?.method}] ${request?.url} -> ${statusCode} Error: ${payload.message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${request?.method}] ${request?.url} -> ${statusCode} ${payload.errorCode}: ${payload.message}`);
    }

    response.status(statusCode).json(payload);
  }

  private resolveStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private normalizeException(
    exception: unknown,
    statusCode: number,
    traceId?: string,
  ): ApiErrorResponse {
    if (exception instanceof HttpException) {
      const rawResponse = exception.getResponse();

      if (typeof rawResponse === 'object' && rawResponse !== null) {
        const resObj = rawResponse as Record<string, unknown>;
        const errorCode =
          (resObj.errorCode as string) ||
          DEFAULT_ERROR_CODE_BY_STATUS[statusCode] ||
          'UNKNOWN_ERROR';
        const message =
          (resObj.message as string) ||
          (Array.isArray(resObj.message) ? resObj.message[0] : exception.message);
        const errors = (resObj.errors as ApiFieldError[]) || undefined;

        return createApiErrorResponse({
          statusCode,
          errorCode,
          message: typeof message === 'string' ? message : 'Request failed',
          errors,
          traceId,
        });
      }

      return createApiErrorResponse({
        statusCode,
        errorCode: DEFAULT_ERROR_CODE_BY_STATUS[statusCode] || 'UNKNOWN_ERROR',
        message: typeof rawResponse === 'string' ? rawResponse : exception.message,
        traceId,
      });
    }

    const message =
      exception instanceof Error && exception.message
        ? exception.message
        : 'Internal server error';

    return createApiErrorResponse({
      statusCode,
      errorCode: DEFAULT_ERROR_CODE_BY_STATUS[statusCode] || 'INTERNAL_SERVER_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : message,
      traceId,
    });
  }
}

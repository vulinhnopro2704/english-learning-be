import { HttpException, HttpStatus } from '@nestjs/common';
import { createApiErrorResponse, type ApiFieldError } from '../types/api.types';

export interface ApiExceptionInput {
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: ApiFieldError[];
  cause?: Error;
}

/**
 * Standard Application Exception thrown throughout the application.
 * Automatically wraps into standardized ApiErrorResponse.
 */
export class ApiException extends HttpException {
  constructor(input: ApiExceptionInput) {
    super(
      createApiErrorResponse({
        statusCode: input.statusCode,
        errorCode: input.errorCode,
        message: input.message,
        errors: input.errors,
      }),
      input.statusCode,
      input.cause ? { cause: input.cause } : undefined,
    );
  }

  static badRequest(message: string, errorCode = 'BAD_REQUEST', errors?: ApiFieldError[]): ApiException {
    return new ApiException({ statusCode: HttpStatus.BAD_REQUEST, errorCode, message, errors });
  }

  static unauthorized(message = 'Unauthorized', errorCode = 'UNAUTHORIZED'): ApiException {
    return new ApiException({ statusCode: HttpStatus.UNAUTHORIZED, errorCode, message });
  }

  static forbidden(message = 'Forbidden', errorCode = 'FORBIDDEN'): ApiException {
    return new ApiException({ statusCode: HttpStatus.FORBIDDEN, errorCode, message });
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND'): ApiException {
    return new ApiException({ statusCode: HttpStatus.NOT_FOUND, errorCode, message });
  }

  static conflict(message: string, errorCode = 'CONFLICT'): ApiException {
    return new ApiException({ statusCode: HttpStatus.CONFLICT, errorCode, message });
  }

  static internal(message = 'Internal server error', errorCode = 'INTERNAL_SERVER_ERROR', cause?: Error): ApiException {
    return new ApiException({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, errorCode, message, cause });
  }
}

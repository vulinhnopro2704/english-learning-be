import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  ValidationPipe,
  type ValidationPipeOptions,
} from '@nestjs/common';
import { getTraceId } from '@english-learning/logger';
import {
  DEFAULT_ERROR_CODE_BY_STATUS,
  createApiErrorResponse,
  type ApiErrorResponse,
  type ApiFieldError,
} from '@english-learning/api-error-types';
import type { Request, Response } from 'express';
import type { ValidationError } from 'class-validator';

export interface ApiExceptionInput {
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: ApiFieldError[];
  cause?: Error;
}

export interface ApiValidationPipeOptions
  extends Omit<ValidationPipeOptions, 'exceptionFactory'> {
  statusCode?: number;
  errorCode?: string;
  message?: string;
}

export interface SetupApiErrorHandlingOptions {
  validation?: ApiValidationPipeOptions;
}

interface NormalizedExceptionPayload {
  errorCode: string;
  message: string;
  errors?: ApiFieldError[];
}

interface NestAppLike {
  useGlobalFilters(...filters: ExceptionFilter[]): unknown;
  useGlobalPipes(...pipes: ValidationPipe[]): unknown;
}

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
}

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = this.resolveStatusCode(exception);
    const traceId = request ? getTraceId(request) : undefined;
    const payload = this.normalizeException(exception, statusCode, traceId);

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
      const normalized = this.normalizeHttpExceptionResponse(
        rawResponse,
        statusCode,
        exception.message,
      );

      return createApiErrorResponse({
        statusCode,
        errorCode: normalized.errorCode,
        message: normalized.message,
        errors: normalized.errors,
        traceId,
      });
    }

    const message =
      statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Internal server error'
        : exception instanceof Error && exception.message
          ? exception.message
          : 'Request failed';

    return createApiErrorResponse({
      statusCode,
      errorCode: DEFAULT_ERROR_CODE_BY_STATUS[statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message,
      traceId,
    });
  }

  private normalizeHttpExceptionResponse(
    response: unknown,
    statusCode: number,
    fallbackMessage: string,
  ): NormalizedExceptionPayload {
    if (typeof response === 'string') {
      return {
        errorCode: this.defaultErrorCode(statusCode),
        message: response,
      };
    }

    if (this.isObject(response)) {
      const errorCode = this.readString(response.errorCode) ?? this.defaultErrorCode(statusCode);
      const errors = this.readFieldErrors(response.errors);
      const message = this.resolveMessage(response, fallbackMessage, errors, statusCode);

      return {
        errorCode,
        message,
        ...(errors && errors.length > 0 ? { errors } : {}),
      };
    }

    return {
      errorCode: this.defaultErrorCode(statusCode),
      message: fallbackMessage || 'Request failed',
    };
  }

  private resolveMessage(
    response: Record<string, unknown>,
    fallbackMessage: string,
    errors: ApiFieldError[] | undefined,
    statusCode: number,
  ): string {
    const directMessage = this.readString(response.message);
    if (directMessage) {
      return directMessage;
    }

    const firstArrayMessage = Array.isArray(response.message)
      ? response.message.find((item): item is string => typeof item === 'string')
      : undefined;
    if (firstArrayMessage) {
      return firstArrayMessage;
    }

    if (errors && errors.length > 0) {
      return statusCode === HttpStatus.UNPROCESSABLE_ENTITY
        ? 'Validation failed'
        : errors[0].message;
    }

    return fallbackMessage || 'Request failed';
  }

  private readFieldErrors(value: unknown): ApiFieldError[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const errors = value
      .map((item) => {
        if (!this.isObject(item)) {
          return null;
        }

        const field = this.readString(item.field);
        const message = this.readString(item.message);
        if (!field || !message) {
          return null;
        }

        return { field, message };
      })
      .filter((item): item is ApiFieldError => item !== null);

    return errors.length > 0 ? errors : undefined;
  }

  private defaultErrorCode(statusCode: number): string {
    return DEFAULT_ERROR_CODE_BY_STATUS[statusCode] ?? 'UNKNOWN_ERROR';
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : undefined;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}

export function createApiValidationPipe(
  options: ApiValidationPipeOptions = {},
): ValidationPipe {
  const {
    statusCode = HttpStatus.UNPROCESSABLE_ENTITY,
    errorCode = 'VALIDATION_ERROR',
    message = 'Validation failed',
    transformOptions,
    ...validationPipeOptions
  } = options;

  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
      ...transformOptions,
    },
    ...validationPipeOptions,
    errorHttpStatusCode: statusCode,
    exceptionFactory: (validationErrors: ValidationError[] = []) => {
      const errors = flattenValidationErrors(validationErrors);

      return new ApiException({
        statusCode,
        errorCode,
        message,
        errors,
      });
    },
  });
}

export function setupApiErrorHandling(
  app: NestAppLike,
  options: SetupApiErrorHandlingOptions = {},
): void {
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(createApiValidationPipe(options.validation));
}

export function flattenValidationErrors(
  validationErrors: ValidationError[],
): ApiFieldError[] {
  const output: ApiFieldError[] = [];
  const seen = new Set<string>();

  const visit = (error: ValidationError, parentPath?: string) => {
    const fieldPath = buildFieldPath(parentPath, error.property);

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        const dedupeKey = `${fieldPath}::${message}`;
        if (fieldPath && !seen.has(dedupeKey)) {
          output.push({ field: fieldPath, message });
          seen.add(dedupeKey);
        }
      }
    }

    for (const child of error.children ?? []) {
      visit(child, fieldPath);
    }
  };

  for (const validationError of validationErrors) {
    visit(validationError);
  }

  return output;
}

function buildFieldPath(parentPath: string | undefined, property: string): string {
  if (!property) {
    return parentPath ?? '';
  }

  const segment = /^\d+$/.test(property) ? `[${property}]` : property;
  if (!parentPath) {
    return segment;
  }

  return segment.startsWith('[') ? `${parentPath}${segment}` : `${parentPath}.${segment}`;
}

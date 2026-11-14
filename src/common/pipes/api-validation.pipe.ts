import {
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import { ApiException } from '../exceptions/api.exception';
import type { ApiFieldError } from '../types/api.types';

/**
 * Creates a global ValidationPipe that produces structured, clean field errors
 * conforming to ApiException / ApiErrorResponse.
 */
export function createApiValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    exceptionFactory: (validationErrors: ValidationError[] = []) => {
      const errors = flattenValidationErrors(validationErrors);
      return new ApiException({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        errorCode: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors,
      });
    },
  });
}

function flattenValidationErrors(validationErrors: ValidationError[]): ApiFieldError[] {
  const output: ApiFieldError[] = [];
  const seen = new Set<string>();

  const visit = (error: ValidationError, parentPath?: string) => {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        const dedupeKey = `${fieldPath}::${message}`;
        if (!seen.has(dedupeKey)) {
          output.push({ field: fieldPath, message });
          seen.add(dedupeKey);
        }
      }
    }

    if (error.children && error.children.length > 0) {
      for (const child of error.children) {
        visit(child, fieldPath);
      }
    }
  };

  for (const error of validationErrors) {
    visit(error);
  }

  return output;
}

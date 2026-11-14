/**
 * Field-level validation error structure.
 */
export interface ApiFieldError {
  field: string;
  message: string;
}

/**
 * Standardized API Error Response returned across all endpoints.
 */
export interface ApiErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: ApiFieldError[];
  timestamp: string;
  traceId?: string;
}

/**
 * Authenticated user payload extracted from validated JWT token.
 */
export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  jti: string;
  name?: string | null;
  gender?: string | null;
  hobbies?: string[];
  funFact?: string | null;
}

/**
 * Default error codes mapped from HTTP status codes.
 */
export const DEFAULT_ERROR_CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Helper to construct a standardized ApiErrorResponse.
 */
export function createApiErrorResponse(input: {
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: ApiFieldError[];
  timestamp?: string;
  traceId?: string;
}): ApiErrorResponse {
  return {
    statusCode: input.statusCode,
    errorCode: input.errorCode,
    message: input.message,
    ...(input.errors && input.errors.length > 0 ? { errors: input.errors } : {}),
    timestamp: input.timestamp ?? new Date().toISOString(),
    ...(input.traceId ? { traceId: input.traceId } : {}),
  };
}

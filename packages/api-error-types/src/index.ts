export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: ApiFieldError[];
  timestamp: string;
  traceId?: string;
}

export interface CreateApiErrorResponseInput {
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: ApiFieldError[];
  timestamp?: string;
  traceId?: string;
}

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

export function createApiErrorResponse(
  input: CreateApiErrorResponseInput,
): ApiErrorResponse {
  return {
    statusCode: input.statusCode,
    errorCode: input.errorCode,
    message: input.message,
    ...(input.errors && input.errors.length > 0 ? { errors: input.errors } : {}),
    timestamp: input.timestamp ?? new Date().toISOString(),
    ...(input.traceId ? { traceId: input.traceId } : {}),
  };
}

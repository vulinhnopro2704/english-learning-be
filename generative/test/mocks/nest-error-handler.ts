interface ApiExceptionInput {
  statusCode: number;
  errorCode: string;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  traceId?: string;
}

export class ApiException extends Error {
  private readonly response: ApiExceptionInput;

  constructor(input: ApiExceptionInput) {
    super(input.message);
    this.response = input;
  }

  getResponse() {
    return this.response;
  }

  getStatus() {
    return this.response.statusCode;
  }
}

export const setupApiErrorHandling = () => undefined;

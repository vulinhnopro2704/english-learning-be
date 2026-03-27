import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiProperty,
  ApiResponse,
  DocumentBuilder,
  SwaggerModule,
  getSchemaPath,
} from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type {
  ApiErrorResponse,
  ApiFieldError,
} from '@english-learning/api-error-types';

export interface ApiDocsTag {
  name: string;
  description?: string;
}

export interface ApiDocsOptions {
  title: string;
  description: string;
  version?: string;
  tags?: ApiDocsTag[];
  enableBearerAuth?: boolean;
  enableCookieAuth?: boolean;
  cookieAuthName?: string;
  enabled?: boolean;
  swaggerPath?: string;
  scalarTheme?: string;
}

export interface ApiStandardErrorResponsesOptions {
  statuses?: number[];
}

export interface ApiEntityResponseOptions {
  description: string;
  type: Type<unknown>;
}

export interface ApiCursorPaginatedResponseOptions {
  description: string;
  itemType: Type<unknown>;
  includeTotal?: boolean;
  includeLimit?: boolean;
}

interface NestHttpAdapterLike {
  getInstance(): {
    use(path: string, handler: unknown): void;
  };
}

interface NestAppLike {
  use(path: string, handler: unknown): void;
  getHttpAdapter(): NestHttpAdapterLike;
}

const DEFAULT_SWAGGER_VERSION = '1.0';
const DEFAULT_SWAGGER_PATH = 'api-docs';
const DEFAULT_SCALAR_THEME = 'kepler';

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Resource not found',
  409: 'Conflict',
  422: 'Validation error',
  429: 'Too many requests',
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
};

const ERROR_CODES: Record<number, string> = {
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

export class ApiFieldErrorDto implements ApiFieldError {
  @ApiProperty({ example: 'items[0].price' })
  field!: string;

  @ApiProperty({ example: 'price must not be less than 0' })
  message!: string;
}

export class ApiErrorResponseDto implements ApiErrorResponse {
  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  errorCode!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({
    type: [ApiFieldErrorDto],
    required: false,
    example: [
      { field: 'profile.age', message: 'age must not be less than 18' },
      { field: 'items[0].name', message: 'name should not be empty' },
    ],
  })
  errors?: ApiFieldErrorDto[];

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  timestamp!: string;

  @ApiProperty({ example: 'req_7f3d0b84c2d9', required: false })
  traceId?: string;
}

export class CursorPaginationMetaDto {
  @ApiProperty({ example: 'cursor_123', nullable: true })
  nextCursor!: string | number | null;

  @ApiProperty({ example: true })
  hasMore!: boolean;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' })
  message!: string;
}

export function createApiDocsConfig(options: ApiDocsOptions) {
  const builder = new DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE ?? options.title)
    .setDescription(options.description)
    .setVersion(options.version ?? DEFAULT_SWAGGER_VERSION);

  if (options.enableBearerAuth ?? true) {
    builder.addBearerAuth();
  }

  if (options.enableCookieAuth ?? false) {
    builder.addCookieAuth(options.cookieAuthName ?? 'access_token');
  }

  for (const tag of options.tags ?? []) {
    builder.addTag(tag.name, tag.description);
  }

  return builder.build();
}

export function setupApiDocs(app: NestAppLike, options: ApiDocsOptions): void {
  const enabled =
    options.enabled ?? (process.env.SWAGGER_ENABLED ?? 'true') === 'true';
  if (!enabled) {
    return;
  }

  const swaggerPath =
    options.swaggerPath ?? process.env.SWAGGER_PATH ?? DEFAULT_SWAGGER_PATH;
  const scalarTheme = options.scalarTheme ?? DEFAULT_SCALAR_THEME;
  const config = createApiDocsConfig(options);
  const document = SwaggerModule.createDocument(app as never, config, {
    extraModels: [ApiErrorResponseDto, ApiFieldErrorDto],
  });

  SwaggerModule.setup(`${swaggerPath}/swagger`, app as never, document);
  app.use(
    `/${swaggerPath}`,
    apiReference({
      content: document,
      theme: scalarTheme,
    }),
  );
}

export function ApiStandardErrorResponses(
  options: ApiStandardErrorResponsesOptions = {},
) {
  const statuses = options.statuses ?? [400, 401, 403, 404, 409, 422, 500];

  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto, ApiFieldErrorDto),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status] ?? 'Error response',
        schema: {
          allOf: [{ $ref: getSchemaPath(ApiErrorResponseDto) }],
          example: createErrorExample(status),
        },
      }),
    ),
  );
}

export function ApiOkEntityResponse(options: ApiEntityResponseOptions) {
  return applyDecorators(
    ApiExtraModels(options.type),
    ApiOkResponse({
      description: options.description,
      schema: { $ref: getSchemaPath(options.type) },
    }),
  );
}

export function ApiCreatedEntityResponse(options: ApiEntityResponseOptions) {
  return applyDecorators(
    ApiExtraModels(options.type),
    ApiCreatedResponse({
      description: options.description,
      schema: { $ref: getSchemaPath(options.type) },
    }),
  );
}

export function ApiMessageResponse(description: string) {
  return applyDecorators(
    ApiExtraModels(MessageResponseDto),
    ApiOkResponse({
      description,
      schema: { $ref: getSchemaPath(MessageResponseDto) },
    }),
  );
}

export function ApiCursorPaginatedResponse(
  options: ApiCursorPaginatedResponseOptions,
) {
  return applyDecorators(
    ApiExtraModels(options.itemType, CursorPaginationMetaDto),
    ApiOkResponse({
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(options.itemType) },
          },
          pagination: {
            type: 'object',
            properties: {
              nextCursor: {
                anyOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'null' },
                ],
                example: 'cursor_123',
              },
              hasMore: { type: 'boolean', example: true },
              ...(options.includeTotal
                ? { total: { type: 'number', example: 42 } }
                : {}),
              ...(options.includeLimit
                ? { limit: { type: 'number', example: 20 } }
                : {}),
            },
            required: [
              'nextCursor',
              'hasMore',
              ...(options.includeTotal ? ['total'] : []),
              ...(options.includeLimit ? ['limit'] : []),
            ],
          },
        },
        required: ['data', 'pagination'],
      },
    }),
  );
}

function createErrorExample(status: number): ApiErrorResponse {
  const base: ApiErrorResponse = {
    statusCode: status,
    errorCode: ERROR_CODES[status] ?? 'UNKNOWN_ERROR',
    message: ERROR_DESCRIPTIONS[status] ?? 'Request failed',
    timestamp: '2026-03-27T14:22:31.123Z',
    traceId: 'req_7f3d0b84c2d9',
  };

  if (status === 422) {
    base.message = 'Validation failed';
    base.errors = [
      {
        field: 'profile.age',
        message: 'age must not be less than 18',
      },
      {
        field: 'items[0].name',
        message: 'name should not be empty',
      },
    ];
  }

  return base;
}

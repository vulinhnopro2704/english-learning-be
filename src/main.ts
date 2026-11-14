import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { createApiValidationPipe } from './common/pipes/api-validation.pipe';
import { setupApiDocs } from './common/docs/api-docs';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Enable graceful shutdown hooks (for Prisma, Redis, etc.)
  app.enableShutdownHooks();

  // Cookie parsing for JWT HTTP-only cookies
  app.use(cookieParser());

  // CORS Configuration
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in development
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-user-id',
      'x-trace-id',
    ],
  });

  // Route compatibility middleware: maps legacy paths to /api/v1
  app.use((req: any, _res: any, next: () => void) => {
    if (
      !req.url.startsWith('/api/v1') &&
      !req.url.startsWith('/health') &&
      !req.url.startsWith('/api-docs')
    ) {
      if (req.url.startsWith('/fsrs-ai/api/v1/')) {
        req.url = req.url.replace('/fsrs-ai/api/v1/', '/api/v1/');
      } else {
        req.url = '/api/v1' + req.url;
      }
    }
    next();
  });

  // Global API Routing Prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'api-docs', 'api-docs/(.*)'],
  });

  // Global Validation Pipe with structured exception factory
  app.useGlobalPipes(createApiValidationPipe());

  // OpenAPI Swagger + Scalar Interactive API Documentation
  setupApiDocs(app, {
    path: 'api-docs',
    title: 'English Learning Monolith API',
    version: '2.0.0',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Monolith Server running at http://localhost:${port}/api/v1`);
  logger.log(`API Documentation available at http://localhost:${port}/api-docs`);
  logger.log(`Health check probe at http://localhost:${port}/health`);
}

void bootstrap();

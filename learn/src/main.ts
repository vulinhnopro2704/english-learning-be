import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import {
  AppLogger,
  createRequestLoggerMiddleware,
} from '@english-learning/logger';
import { setupApiDocs } from '@english-learning/nest-api-docs';
import { setupApiErrorHandling } from '@english-learning/nest-error-handler';
import { LearnModule } from './app.module';

async function bootstrap() {
  const appLogger = new AppLogger();
  const app = await NestFactory.create(LearnModule, {
    bufferLogs: true,
    logger: appLogger,
  });
  app.useLogger(appLogger);

  // Cookie parser (JWT tokens in HTTP-only cookies)
  app.use(cookieParser());

  app.use(
    createRequestLoggerMiddleware({
      logger: appLogger,
    }),
  );

  setupApiErrorHandling(app);

  // CORS with credentials
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  const swaggerEnabled = (process.env.SWAGGER_ENABLED ?? 'true') === 'true';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api-docs';
  setupApiDocs(app, {
    title: 'Learn API',
    description: 'English Learning Platform — Learning & Progress',
    tags: [
      { name: 'courses', description: 'Course management endpoints' },
      { name: 'lessons', description: 'Lesson management endpoints' },
      { name: 'progress', description: 'Progress tracking endpoints' },
      { name: 'streak', description: 'Streak tracking endpoints' },
      { name: 'vocabulary', description: 'Vocabulary management endpoints' },
      { name: 'words', description: 'Word management endpoints' },
    ],
    enableBearerAuth: true,
    enableCookieAuth: true,
    enabled: swaggerEnabled,
    swaggerPath,
  });

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  appLogger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  if (swaggerEnabled) {
    appLogger.log(
      `API Docs (Scalar): http://localhost:${port}/${swaggerPath}`,
      'Bootstrap',
    );
    appLogger.log(
      `Swagger UI: http://localhost:${port}/${swaggerPath}/swagger`,
      'Bootstrap',
    );
  }
}
bootstrap();

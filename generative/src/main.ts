import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import {
  AppLogger,
  createRequestLoggerMiddleware,
} from '@english-learning/logger';
import { setupApiDocs } from '@english-learning/nest-api-docs';
import { setupApiErrorHandling } from '@english-learning/nest-error-handler';
import { AppModule } from './app.module';

async function bootstrap() {
  const appLogger = new AppLogger();
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
  });
  app.useLogger(appLogger);

  app.use(cookieParser());
  app.use(
    createRequestLoggerMiddleware({
      logger: appLogger,
    }),
  );

  setupApiErrorHandling(app);

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
    title: 'Generative API',
    description: 'English Learning Platform — 3D AI English Tutor',
    tags: [
      { name: 'health', description: 'Health check endpoints' },
      { name: 'tutor-sessions', description: '3D AI Tutor session endpoints' },
    ],
    enableBearerAuth: true,
    enableCookieAuth: true,
    enabled: swaggerEnabled,
    swaggerPath,
  });

  const port = process.env.PORT ?? 3005;
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
void bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});

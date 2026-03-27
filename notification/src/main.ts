import { NestFactory } from '@nestjs/core';
import {
  AppLogger,
  createRequestLoggerMiddleware,
} from '@english-learning/logger';
import { setupApiDocs } from '@english-learning/nest-api-docs';
import { setupApiErrorHandling } from '@english-learning/nest-error-handler';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const appLogger = new AppLogger();
  const app = await NestFactory.create(AppModule, { logger: appLogger });
  app.useLogger(appLogger);

  app.use(cookieParser());

  app.use(
    createRequestLoggerMiddleware({
      logger: appLogger,
      bodyMax: Number(process.env.LOGGER_BODY_MAX ?? '0'),
    }),
  );

  setupApiErrorHandling(app);
  setupApiDocs(app, {
    title: 'Notification API',
    description: 'English Learning Platform — Notification Service',
    tags: [{ name: 'notification', description: 'Notification endpoints' }],
    enabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
    swaggerPath: process.env.SWAGGER_PATH ?? 'api-docs',
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

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
    }),
  );

  setupApiErrorHandling(app);
  const swaggerEnabled = (process.env.SWAGGER_ENABLED ?? 'true') === 'true';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api-docs';
  setupApiDocs(app, {
    title: 'Notification API',
    description: 'English Learning Platform — Notification Service',
    tags: [{ name: 'notification', description: 'Notification endpoints' }],
    enabled: swaggerEnabled,
    swaggerPath,
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  appLogger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
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

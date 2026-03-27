import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: appLogger,
  });
  app.useLogger(appLogger);

  app.use(cookieParser());
  app.use(
    createRequestLoggerMiddleware({
      logger: appLogger,
      bodyMax: Number(process.env.LOGGER_BODY_MAX ?? '0'),
    }),
  );

  app.setGlobalPrefix('v1');
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
    title: 'Storage API',
    description: 'English Learning Platform — Storage Service',
    tags: [{ name: 'files', description: 'File upload and retrieval endpoints' }],
    enableBearerAuth: true,
    enabled: swaggerEnabled,
    swaggerPath,
  });

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  if (swaggerEnabled) {
    console.log(`📚 API Docs (Scalar):  http://localhost:${port}/${swaggerPath}`);
    console.log(
      `📋 Swagger UI:         http://localhost:${port}/${swaggerPath}/swagger`,
    );
  }
}
bootstrap();

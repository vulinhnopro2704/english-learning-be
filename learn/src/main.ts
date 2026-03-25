import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import {
  AppLogger,
  createRequestLoggerMiddleware,
} from '@english-learning/logger';
import { LearnModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

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
      bodyMax: Number(process.env.LOGGER_BODY_MAX ?? '0'),
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

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

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(process.env.SWAGGER_TITLE ?? 'Learn API')
      .setDescription('English Learning Platform — Learning & Progress')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access_token')
      .addTag('courses', 'Course management endpoints')
      .addTag('lessons', 'Lesson management endpoints')
      .addTag('progress', 'Progress tracking endpoints')
      .addTag('streak', 'Streak tracking endpoints')
      .addTag('vocabulary', 'Vocabulary management endpoints')
      .addTag('words', 'Word management endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup(`${swaggerPath}/swagger`, app, document);

    app.use(
      `/${swaggerPath}`,
      apiReference({
        content: document,
        theme: 'kepler',
      }),
    );
  }

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(
      `📚 API Docs (Scalar):  http://localhost:${port}/${swaggerPath}`,
    );
    console.log(
      `📋 Swagger UI:         http://localhost:${port}/${swaggerPath}/swagger`,
    );
  }
}
bootstrap();

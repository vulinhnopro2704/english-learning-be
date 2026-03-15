import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import {
  AppLogger,
  createRequestLoggerMiddleware,
} from '@english-learning/logger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const appLogger = new AppLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: appLogger,
  });
  app.useLogger(appLogger);

  // Cookie parser
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
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });

  const swaggerEnabled = (process.env.SWAGGER_ENABLED ?? 'true') === 'true';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api-docs';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(process.env.SWAGGER_TITLE ?? 'Auth API')
      .setDescription(
        'English Learning Platform — Authentication & User Management',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access_token')
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
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

  const port = process.env.PORT || 3001;
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

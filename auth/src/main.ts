import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MyLogger } from './modules/logger/my.logger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new MyLogger(),
  });

  // Cookie parser
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
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

  // ── Swagger / OpenAPI ───────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Auth API')
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

  // Classic Swagger UI (fallback)
  SwaggerModule.setup('api-docs/swagger', app, document);

  // Scalar UI — modern API reference
  app.use(
    '/api-docs',
    apiReference({
      content: document,
      theme: 'kepler',
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`📚 API Docs (Scalar):  http://localhost:${port}/api-docs`);
  console.log(
    `📋 Swagger UI:         http://localhost:${port}/api-docs/swagger`,
  );
}
bootstrap();

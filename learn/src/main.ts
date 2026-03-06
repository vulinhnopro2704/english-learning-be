import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { LearnModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const app = await NestFactory.create(LearnModule, { bufferLogs: true });

  // Cookie parser (JWT tokens in HTTP-only cookies)
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
    .setTitle('Learn API')
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

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`📚 API Docs (Scalar):  http://localhost:${port}/api-docs`);
  console.log(
    `📋 Swagger UI:         http://localhost:${port}/api-docs/swagger`,
  );
}
bootstrap();

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

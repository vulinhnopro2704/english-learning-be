import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { LearnModule } from './app.module';

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

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
}
bootstrap();

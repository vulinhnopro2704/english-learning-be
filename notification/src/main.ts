import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  AppLogger,
  createRequestLoggerMiddleware,
} from '@english-learning/logger';
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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

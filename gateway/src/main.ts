import { NestFactory } from '@nestjs/core';
import {
  AppLogger,
  createRequestLoggerMiddleware,
} from '@english-learning/logger';
import { setupApiDocs } from '@english-learning/nest-api-docs';
import { setupApiErrorHandling } from '@english-learning/nest-error-handler';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { GatewayProxyService } from './proxy/gateway-proxy.service';

async function bootstrap() {
  const appLogger = new AppLogger();
  const app = await NestFactory.create(AppModule, { logger: appLogger });
  app.useLogger(appLogger);

  app.use(cookieParser());
  // Ensure payloads survive the proxy by parsing JSON/urlencoded bodies up front
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(
    createRequestLoggerMiddleware({
      logger: appLogger,
      bodyMax: Number(process.env.LOGGER_BODY_MAX ?? '0'),
    }),
  );

  setupApiErrorHandling(app);

  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxy);

  const swaggerEnabled = (process.env.SWAGGER_ENABLED ?? 'true') === 'true';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api-docs';

  setupApiDocs(app, {
    title: 'API Gateway',
    description: 'English Learning Platform — API Gateway',
    enableBearerAuth: true,
    enabled: swaggerEnabled,
    swaggerPath,
  });

  if (swaggerEnabled) {
    expressApp.get('/', (_req, res) => {
      res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Docs Navigation</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; margin: 2rem; line-height: 1.5; }
      h1 { margin-bottom: 1rem; }
      ul { padding-left: 1.25rem; }
      li { margin-bottom: 0.5rem; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <h1>API Documentation</h1>
    <ul>
      <li><a href="/${swaggerPath}">Gateway Scalar UI</a></li>
      <li><a href="/${swaggerPath}/swagger">Gateway Swagger UI</a></li>
      <li><a href="/auth/api-docs">Auth Scalar UI</a></li>
      <li><a href="/auth/api-docs/swagger">Auth Swagger UI</a></li>
      <li><a href="/learn/api-docs">Learn Scalar UI</a></li>
      <li><a href="/learn/api-docs/swagger">Learn Swagger UI</a></li>
      <li><a href="/fsrs-ai/api-docs">FSRS-AI Swagger UI</a></li>
      <li><a href="/fsrs-ai/api-docs/redoc">FSRS-AI ReDoc</a></li>
    </ul>
  </body>
</html>`);
    });
  }

  const gatewayProxyService = app.get(GatewayProxyService);
  expressApp.use((req, res, next) =>
    gatewayProxyService.handle(req, res, next),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

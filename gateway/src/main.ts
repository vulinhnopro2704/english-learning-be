import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { GatewayProxyService } from './proxy/gateway-proxy.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  // Ensure payloads survive the proxy by parsing JSON/urlencoded bodies up front
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxy);

  const swaggerEnabled = (process.env.SWAGGER_ENABLED ?? 'true') === 'true';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api-docs';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(process.env.SWAGGER_TITLE ?? 'API Gateway')
      .setDescription('English Learning Platform — API Gateway')
      .setVersion('1.0')
      .addBearerAuth()
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

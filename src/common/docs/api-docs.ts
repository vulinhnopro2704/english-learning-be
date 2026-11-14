import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export interface ApiDocsOptions {
  title?: string;
  description?: string;
  version?: string;
  path?: string;
  enabled?: boolean;
}

/**
 * Sets up OpenAPI / Swagger schema and Scalar Interactive API Docs at `/api-docs`.
 */
export function setupApiDocs(app: INestApplication, options: ApiDocsOptions = {}): void {
  const isEnabled = options.enabled ?? (process.env.SWAGGER_ENABLED ?? 'true') === 'true';
  if (!isEnabled) {
    return;
  }

  const path = (options.path ?? process.env.SWAGGER_PATH ?? 'api-docs').replace(/^\/+/, '');
  const title = options.title ?? process.env.SWAGGER_TITLE ?? 'English Learning Platform API';
  const description =
    options.description ??
    'Unified NestJS 12 Modular Monolith Backend for English Learning (Auth, Learn, FSRS, Listening, Generative, Storage)';
  const version = options.version ?? '1.0.0';

  const config = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter your JWT access token',
    })
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'Cookie access token',
    })
    .addTag('Auth', 'Authentication, OAuth, registration, session management')
    .addTag('Users', 'User profile, account details')
    .addTag('Courses', 'Course discovery, course details, enrollment')
    .addTag('Lessons', 'Lesson content, vocabulary listing, completion')
    .addTag('Words', 'Word search, dictionary, pronunciations, audio')
    .addTag('Practice', 'Practice sessions, FSRS review submission, due words')
    .addTag('FSRS', 'Spaced repetition scheduling, model optimization, memory analytics')
    .addTag('Listening', 'YouTube transcript extraction, Cloze generation, listening practice')
    .addTag('Generative', 'AI tutor, speech generation, roleplay conversations')
    .addTag('Storage', 'Cloudinary file upload, signed URLs, audio ingestion')
    .addTag('Health', 'System health and status probes')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(`${path}/swagger`, app, document);

  app.use(
    `/${path}`,
    apiReference({
      content: document,
      theme: 'kepler',
    }),
  );
}

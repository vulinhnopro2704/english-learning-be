# @english-learning/logger

Shared logger and HTTP request/response logging middleware for the English Learning platform (NestJS services).

## Features

- Winston-based `AppLogger` with console + daily rotate file output (JSON), configurable via env.
- Request/response middleware with trace ID (UUID v4) propagation and status-based log levels.
- Body logging with redaction for sensitive keys (password/token/cookies) and optional size cap.
- Trace ID header `x-trace-id` added to responses and forwarded through the gateway.

## Usage (Nest bootstrap)

```ts
import { AppLogger, createRequestLoggerMiddleware } from '@english-learning/logger';

async function bootstrap() {
  const appLogger = new AppLogger();
  const app = await NestFactory.create(AppModule, { logger: appLogger });
  app.useLogger(appLogger);

  app.use(
    createRequestLoggerMiddleware({
      logger: appLogger,
      bodyMax: Number(process.env.LOGGER_BODY_MAX ?? '0'),
    }),
  );
}
```

## Config (env)

- `LOGGER_LEVEL` (default `info`)
- `LOGGER_DIR` (default `logs`)
- `LOGGER_FILENAME` (default `app-%DATE%.log`)
- `LOGGER_MAX_SIZE` (default `10m`)
- `LOGGER_MAX_FILES` (default `14d`)
- `LOGGER_BODY_MAX` (default `0` unlimited) — truncate logged body when set.
- `LOGGER_REDACT_KEYS` (comma list, default: password, token, access_token, refresh_token, cookie, cookies)

Body redaction: password/token/cookie fields are logged as `[redacted len=NN preview=abc...xyz]` (first 3 + last 3 chars, plus size). Binary buffers log as `[buffer len=N]`.

## Publish

1. Build: `pnpm install` then `pnpm --dir packages/logger build`
2. (Optional) Pack: `pnpm --dir packages/logger pack`
3. Publish to registry: `npm publish --access public` (or set `publishConfig.registry` for a private registry)

## Local linking in this monorepo

- Each service depends on `"@english-learning/logger": "file:../packages/logger"`.
- After changes, run `pnpm install` inside each service folder so pnpm links the local package and pulls the built `dist` output.

## Notes

- Trace ID header: `x-trace-id` is generated if absent and forwarded downstream.
- Middleware logs request/response bodies; set `LOGGER_BODY_MAX` to cap size if payloads are large.
- Validation errors remain 422; middleware logs once per request with the corresponding trace ID.

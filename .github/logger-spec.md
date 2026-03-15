# Spec: @english-learning/logger

## Overview

Shared Nest-compatible logger package providing:

- Winston-based LoggerService (console + daily-rotating JSON file).
- Request/response logging middleware with per-request traceId (UUID v4) and redaction.
- Redaction helpers for sensitive fields.
  Target services: Gateway, Auth, Learn, Notification.

## Functional Requirements

- Log each HTTP request/response with: traceId, method, path, status, duration ms, client IP, user identifiers (x-user-id/email/role/jti), user-agent, referer.
- Log full request and response bodies; for password/token/cookies log only size and first3/last3 chars.
- Add traceId header to outbound responses; propagate incoming x-trace-id if present, otherwise generate.
- Gateway forwards x-trace-id to downstream services.
- Handle errors (including thrown exceptions) and log stacktrace with traceId.
- Validation failures (422) logged once per request.

## Non-Functional Requirements

- Outputs: console (colorized similar to current MyLogger) and JSON file in logs with daily rotation.
- Config via env (defaults in parentheses):
  - LOGGER_LEVEL (info)
  - LOGGER_DIR (logs)
  - LOGGER_FILENAME (app-%DATE%.log)
  - LOGGER_MAX_SIZE (10m)
  - LOGGER_MAX_FILES (14d)
  - LOGGER_BODY_MAX (0 = unlimited; cap bytes when set)
  - LOGGER_REDACT_KEYS (password,token,access_token,refresh_token,cookie,cookies)
- Performance: middleware uses response finish event; avoid buffering beyond LOGGER_BODY_MAX.
- Types: TypeScript typings for logger service, middleware options, and redaction helpers.

## API Design

- LoggerModule (Nest): imports/exports logger provider; injectable via Nest Logger token.
- createLogger(options?): returns configured Winston logger; respects env defaults.
- LoggerService implementation: supports log/error/warn/debug/verbose; console format matches existing MyLogger prefix ([Nest] time level [context] message).
- requestLoggingMiddleware(options?): Express middleware for Nest that:
  - Sets/propagates traceId (UUID v4 default).
  - Records start time; on response finish logs request/response summary plus bodies (redaction + size cap).
  - Attaches traceId to res.locals and response header x-trace-id.
- redact(value, key, opts): utility to mask configured keys (first3/last3 + size), applied to nested objects.

## Integration Requirements

- Gateway: set app logger to shared LoggerModule in bootstrap; apply middleware globally before proxy; forward x-trace-id to upstream and include in proxy logs.
- Auth/Learn/Notification: set app logger to shared logger in main bootstrap; apply middleware globally; replace duplicated logger implementations; existing feature logs include traceId in context if available.
- Logging directory: use logs/ (configurable via env).

## Validation/Testing

- Unit: redaction utility masks keys; middleware assigns traceId and logs status/duration; logger service writes to console/file.
- Integration/manual: send requests via gateway to Auth/Learn/Notification; verify logs contain traceId and redacted bodies; confirm 422 validation errors logged once; check rotated files under logs.
- Publishing: package.json with name @english-learning/logger, main/types/build outputs, files list; npm publish to target registry.

## Publishing Notes

- package.json: name @english-learning/logger, version, main (dist/index.js), types (dist/index.d.ts), files (dist/\*_/_), publishConfig.registry if private.
- Build command (pnpm build) outputs to dist before npm publish.
- Exclude logs/dist from git as appropriate; include README/changelog for package usage.

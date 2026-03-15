# Plan: Shared Logger & Request/Response Logging

Goal: Provide a reusable logging package (`@english-learning/logger`) and middleware so Gateway, Auth, Learn, and Notification emit consistent request/response logs with trace IDs, redaction, and rotation.

Scope

- In-scope: shared Nest-compatible logger (Winston), request/response middleware with traceId, integration in Gateway/Auth/Learn/Notification.
- Out-of-scope: centralized log shipping (ELK/CloudWatch), FastAPI fsrs-ai integration, security scanning.

User Choices (confirmed)

- Package: @english-learning/logger; publish to npm/private registry.
- Log directory: logs.
- Body logging: log full request/response; for password/token/cookies only log size plus first 3 and last 3 chars.
- Trace ID: UUID v4.

Work Plan

1. Build shared logger package:
   - Export LoggerService implementation, LoggerModule, and createLogger factory.
   - Winston console (colorized) + daily-rotate JSON file transport; configurable via env.
2. Add shared request/response middleware:
   - Generate traceId (UUID v4), attach to req/res and response headers.
   - Log method, path, status, duration, traceId, IP, user headers (x-user-id/email/role/jti), request/response bodies with redaction rules.
3. Add redaction utility:
   - Mask password/token/cookies fields; log only size and first3/last3 chars.
   - Provide optional body size cap env to avoid huge logs.
4. Gateway integration:
   - Use shared LoggerModule as app logger.
   - Register middleware before proxy; forward traceId header downstream.
   - Ensure proxy error logs include traceId.
5. Auth integration:
   - Replace local MyLogger wiring with shared logger.
   - Register middleware globally; reuse traceId in auth event logs.
6. Learn integration:
   - Add shared logger dependency; set as app logger; register middleware globally.
7. Notification integration:
   - Same as Learn.
8. Config/Docs:
   - Env defaults (level, dir=logs, filename pattern, rotation retention/size caps, body size cap toggle).
   - Publish instructions for npm/private registry.
9. Verification:
   - Requests through gateway to each service show method/path/status/duration/traceId and 422 validation errors logged once.
   - Logs rotate to logs directory; console remains colorized.

Risks/Notes

- Large body logging: cap via env to avoid massive payload logs.
- Sensitive fields must respect redaction utility.
- Keep middleware idempotent to avoid double logging.

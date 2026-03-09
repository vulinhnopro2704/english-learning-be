## Plan: NestJS API Gateway with HTTP Internal Services (DRAFT)

This plan implements a single public entrypoint via API Gateway, keeps `auth` and `learn` as HTTP services on the internal Docker network, and centralizes JWT verification, Redis-backed revocation/rate limiting, and IP blacklist enforcement at the gateway. It applies your updated direction: keep HTTP for backend services (no TCP-only migration), gateway-only JWT verification with Redis revocation check, global per-IP `100 req/min`, trusted forwarded IP handling, and auth required for all learn routes. Deployment and compose will be updated so only `api-gateway` and `redis` are externally exposed, while service-to-service traffic stays on Docker DNS over the shared bridge network.

**Steps**

1. Build gateway foundation modules and config in [gateway/src/app.module.ts](gateway/src/app.module.ts) and [gateway/src/main.ts](gateway/src/main.ts): add `ConfigModule`, Redis provider, trusted proxy extraction, global security middleware, and request pipeline for auth/rate-limit/blacklist/sanitization.
2. Add gateway security components in new files under [gateway/src](gateway/src): JWT verifier (signature + exp), Redis revocation checker (compatible with auth blacklist key format), global per-IP limiter (`100/60s`), IP blacklist guard/service, and header sanitizer that strips client-supplied identity/sensitive headers before forwarding.
3. Replace gateway scaffold controller with HTTP reverse-proxy routing to internal services over Docker DNS (`auth`, `learn`): forward method/path/query/body, attach trusted headers (`x-user-id`, `x-user-role`), and remove sensitive inbound headers before forwarding.
4. Keep `auth` and `learn` HTTP APIs intact; remove host port exposure in compose so they are internal-only and reachable only from gateway container.
5. Move trust boundary to gateway: in `auth` and `learn`, replace JWT guard/decorator dependence with trusted-header extraction where needed for internal business logic.
6. Preserve authentication behavior requirements: all learn routes require valid JWT at gateway before forwarding.
7. Keep Swagger available with explicit configuration flags: maintain Swagger in backend services for internal debugging, and add Swagger docs in gateway for public API contract. Use dedicated runtime flags (for example `SWAGGER_ENABLED`, `SWAGGER_PATH`, optional `SWAGGER_TITLE`) so Swagger can be enabled in dev/deploy-dev and disabled in stricter environments when needed, without relying on `NODE_ENV`.
8. Update dependency manifests for required packages in [gateway/package.json](gateway/package.json), [auth/package.json](auth/package.json), and [learn/package.json](learn/package.json) (HTTP proxy client, Redis client, gateway security libs as needed).
9. Update container topology in [docker-compose.yml](docker-compose.yml): add `api-gateway`, remove host port exposure for `auth`/`learn`, keep internal DNS names (`auth`, `learn`, `redis`), and keep only gateway + redis published.
10. Update deployment automation in [.github/workflows/deploy.yml](.github/workflows/deploy.yml): build/push gateway image, include gateway env generation, and ensure runtime env includes internal HTTP upstream URLs, JWT/Redis/rate-limit/blacklist settings, and Swagger config flags for dev deployment.
11. Update operational docs in [DEPLOYMENT.md](DEPLOYMENT.md) and service READMEs ([gateway/README.md](gateway/README.md), [auth/README.md](auth/README.md), [learn/README.md](learn/README.md)) to reflect gateway-first architecture, internal HTTP comms, and configurable Swagger behavior (enabled in dev).

**Verification**

- Dependency and type checks per service: install + build for `gateway`, `auth`, `learn`.
- Compose validation: `docker compose config` and startup verification that only gateway/redis expose host ports.
- Functional smoke tests through gateway only:
  - Auth lifecycle: register/login/refresh/logout.
  - Learn endpoints (now all JWT-protected) with valid/expired/tampered tokens.
  - Header trust: spoofed incoming `x-user-*` headers are ignored/overwritten.
  - Rate limit: >100 requests/min from same IP returns throttled response.
  - IP blacklist: blocked IP denied before forwarding.
- Swagger checks: gateway docs endpoint is available when `SWAGGER_ENABLED=true`; auth/learn docs remain accessible internally when their Swagger flags are enabled. Validate toggle behavior per service using dedicated Swagger flags (not `NODE_ENV`).
- Internal isolation check: direct host access to auth/learn ports fails while gateway routes succeed.

**Decisions**

- Service mode: keep HTTP `auth`/`learn` behind gateway (no TCP-only migration).
- JWT validation: gateway-only, including Redis revocation.
- Rate limit: global per-IP `100 req/min` in Redis.
- IP source: trust forwarded IP from known proxy chain.
- Learn auth policy: require JWT for all learn routes.
- Swagger policy: keep Swagger enabled for development deployment, controlled via dedicated Swagger flags and independent from `NODE_ENV`.

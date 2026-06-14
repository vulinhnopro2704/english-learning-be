# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1) Quick map

- Monorepo services: `auth/`, `learn/`, `storage/`, `gateway/`, `fsrs-ai/`, `generative/`.
- Public entry: `gateway` (routes `/api/*` to backend services, `/fsrs-ai/*` to FSRS-AI upstream).
- FSRS integration lives mainly in `learn` + `fsrs-ai`.
- `notification/` is a scaffold, not yet active.

## 2) FSRS-AI quick context (high priority)

- Service dir: `fsrs-ai/` (FastAPI + SQLAlchemy + `fsrs[optimizer]`).
- App entry: `fsrs-ai/app/main.py`.
- Routers: `fsrs-ai/app/routers/review.py`, `optimize.py`, `helper.py`, `report.py`.
- Core logic: `fsrs-ai/app/services/fsrs_service.py`, `optimizer_service.py`, `report_service.py`.
- DB models: `fsrs-ai/app/models.py` (schema `fsrs`): `card_memory_state`, `review_log`, `fsrs_config`.
- Migrations: `alembic/` + `alembic.ini`.
- Important docs: `fsrs-ai/PLAN.md` (authoritative plan), `fsrs-ai/SPEC_FSRS_V6_OPTIMIZATION.md` (API + policy contract), `fsrs-ai/README.md`.

## 3) Current API surface (FSRS-AI)

- `GET /api/v1/fsrs/due?user_id=<uuid>&limit=<1..200>`
- `POST /api/v1/fsrs/review`
- `POST /api/v1/fsrs/review/bulk`
- `POST /api/v1/fsrs/init-cards?user_id=<uuid>&word_ids=1&word_ids=2`
- `GET /api/v1/fsrs/stats?user_id=<uuid>`
- `POST /api/v1/fsrs/optimize`
- `POST /api/v1/fsrs/optimize/rollback`
- `POST /api/v1/fsrs/helper/reschedule`
- `GET /api/v1/fsrs/insights`
- `GET /api/v1/fsrs/report/daily`
- `GET /api/v1/fsrs/recommendations`
- `GET /api/v1/fsrs/cards/risk`
- Health: `GET /health`, Docs: `/api-docs` (or `/fsrs-ai/api-docs` via gateway)
- Gateway forwards `x-user-id` after JWT validation; FSRS query endpoints resolve user from header.

## 4) Learn service integration points

- Due words proxy + hydrate word data: `learn/src/modules/practice/practice.service.ts` -> `getDueWords()`
- Submit FSRS practice: `learn/src/modules/practice/practice.service.ts` -> `submitFSRS()` calls `POST /api/v1/fsrs/review/bulk`
- Init cards when completing lesson: `learn/src/modules/lessons/lessons.service.ts` -> `completeLesson()` calls `POST /api/v1/fsrs/init-cards`

## 5) Learn service modules

`learn/src/modules/`: `courses`, `lessons`, `words`, `vocabulary`, `progress`, `streak`, `dictionary`, `practice`, `redis`, `db`, `auth`.
- Prisma schema: `learn/prisma/schema.prisma`.
- Redis cache namespace: `learn:v1`, key format `learn:v1:<scope>:u:<user-or-public>:q:<serialized-params>`.
- TTLs: SHORT=60s, MEDIUM=5min, LONG=24h. Mutate APIs invalidate cache by scope.

## 6) Auth service modules

`auth/src/modules/`: `auth` (login/register/JWT/OAuth), `users`, `redis`, `db`.
- Prisma schema: `auth/prisma/schema.prisma`.
- JWT access/refresh tokens, Google OAuth, email verification, password reset via Resend.

## 7) Storage service modules

`storage/src/modules/`: `files` (upload via Cloudinary, signed URLs, ingest audio), `cloudinary`, `prisma`, `health`, `common/auth`.
- Prisma schema: `storage/prisma/schema.prisma`.
- Auth: trusted-headers guard (from gateway).

## 8) Generative service modules

`generative/src/modules/`: `llm`, `tutor-sessions`, `tts`, `ollama`, `roleplay`, `redis`, `db`, `health`.
- Prisma schema: `generative/prisma/schema.prisma`.
- Uses Ollama API for LLM, ElevenLabs for TTS/STT.

## 9) Gateway

`gateway/src/`: `proxy/gateway-proxy.service.ts` (HTTP reverse proxy to upstream services), `redis/redis.service.ts`.
- JWT verification + Redis revocation check + per-IP rate limiting (100 req/min) + IP blacklist at gateway.
- All learn routes require valid JWT at gateway before forwarding.
- Services communicate via internal Docker DNS over HTTP (no TCP-only).

## 10) Shared packages

`packages/`:
- `logger/` - Winston-based request logger middleware + app logger
- `api-error-types/` - Shared error type definitions
- `nest-error-handler/` - Global NestJS exception filter
- `nest-api-docs/` - Scalar API docs setup

## 11) Commands per service

Each NestJS service (`auth/`, `learn/`, `storage/`, `gateway/`, `generative/`, `notification/`):
```bash
cd <service>
npm run build          # Nest build
npm run format         # Prettier --write
npm run lint           # ESLint --fix
npm run test           # Jest
npm run test:watch     # Jest --watch
npm run test:cov       # Jest --coverage
npm run test:e2e       # Jest e2e config
npm run start:dev      # Nest start --watch
npm run start:prod     # node dist/src/main.js
```

Prisma (auth, learn, storage, generative):
```bash
npx prisma generate    # Generate client
npx prisma migrate dev # Dev migration
npx prisma migrate deploy # Prod migration
```

FSRS-AI:
```bash
cd fsrs-ai
pip install -r requirements.txt
alembic upgrade head   # Run migrations
uvicorn app.main:app --host 0.0.0.0 --port 3004  # Run locally
```

## 12) Docker / local dev

```bash
docker compose up -d        # Start all services
docker compose ps           # Check status
docker compose logs -f <service>  # View logs
docker compose restart <service>  # Restart a service
```

Ports: gateway=3000, auth=3001, learn=3002, storage=3003, fsrs-ai=3004, generative=3005.

## 13) CI/CD

- Trigger: push to `main` (path-filtered per service).
- Each service builds a Docker image, pushes to GHCR.
- Deploy step: SSH to VPS, download docker-compose.yml + create .env files, pull images, `docker compose up -d`.
- Partial success: services that fail to build keep their current image; gateway always restarted last.

## 14) Important caveats

- `fsrs-ai/.env` contains DB URL; never commit secrets.
- Bulk review loops item-by-item, commits per item via `review_card()`.
- Optimizer requires >=10 valid logs with `log_data` JSON from py-fsrs.
- New optimizer policy defaults are env-driven (min logs, cooldown days, improvement threshold).
- Prettier config: single quotes, semicolons, trailing commas, 100char width, 2-space indent, LF line endings.

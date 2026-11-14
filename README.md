# English Learning Platform — Modular Monolith Backend

High-performance, lightweight **NestJS 12** Modular Monolith powering the English Learning Platform.

---

## Highlights and Architecture Overview

1. **Unified Modular Monolith**: Consolidated 8 previous microservices (`auth`, `gateway`, `learn`, `storage`, `generative`, `listening-service`, `fsrs-ai`, `notification`) into a single NestJS application.
2. **100% TypeScript / Zero Python**:
   - `fsrs-ai` (previously Python + FastAPI + PyTorch) migrated to native TypeScript (`ts-fsrs` + Rust WASI `@open-spaced-repetition/binding`), reducing latency from ~800ms to **50ms** and memory usage by **90%**.
   - `listening-service` (previously Python + FastAPI + `yt-dlp`) migrated to native TypeScript (`youtubei.js` + `BlankGeneratorService`).
3. **Multi-Schema PostgreSQL Preserved**:
   - 100% of user data intact on Neon DB across 6 schemas: `auth`, `public`, `storage`, `generative`, `listening`, `fsrs`.
   - Single unified Prisma Client with full type safety across all schemas.
4. **Clean Code and Strict Typing**:
   - Zero `any` types, zero unsafe casting.
   - Consistent error handling via `ApiException` and `ApiExceptionFilter`.
   - Structured DTOs with `class-validator` and `class-transformer`.
5. **Modern Build and Deploy**:
   - Powered by **Rspack 2** (`nest build` completes in **<100ms**).
   - Bundled single file (~1MB) runnable on **<150MB RAM**, ideal for free and low-resource tiers (Vercel, Render, Fly.io, 512MB VPS).
   - Interactive API documentation powered by **Scalar** and **Swagger** at `/api-docs`.

---

## Project Structure

```
src/
├── app.module.ts              # Root application module wiring all features
├── main.ts                    # Entrypoint with CORS, cookie-parser, Scalar docs
├── common/                    # Shared cross-cutting concerns
│   ├── decorators/            # @GetCurrentUser(), @Public(), @Roles()
│   ├── docs/                  # Scalar & OpenAPI Swagger setup
│   ├── exceptions/            # Standardized ApiException
│   ├── filters/               # Global ApiExceptionFilter
│   ├── guards/                # Global JwtAuthGuard, RolesGuard
│   ├── pipes/                 # Global ApiValidationPipe
│   └── types/                 # Standard API types & error envelopes
├── database/                  # Prisma service & generated multi-schema client
├── redis/                     # Redis service with TTL, prefix caching, token blacklist
└── modules/                   # Domain Modules
    ├── auth/                  # Authentication, OAuth, JWT, mailer
    ├── users/                 # User profiles & settings
    ├── courses/               # Course catalog & management
    ├── lessons/               # Lessons, completion & direct FSRS initialization
    ├── words/                 # Dictionary words & vocabulary database
    ├── vocabulary/            # Personal notebooks & favorites
    ├── dictionary/            # Mochi English dictionary proxy & sync
    ├── progress/              # Learning analytics & progress metrics
    ├── streak/                # Daily activity & streak tracking
    ├── practice/              # Practice sessions, FSRS reviews, due cards
    ├── fsrs/                  # Spaced Repetition (Scheduler, Rust WASI Optimizer, Reports)
    ├── listening/             # YouTube transcript extraction & Cloze generator
    ├── storage/               # Cloudinary uploads & media management
    ├── generative/            # Ollama LLM, TTS, STT, Roleplay, AI Tutor
    ├── notification/          # Notification dispatcher
    └── health/                # System liveness, memory & DB probe
```

---

## Quick Start

### 1. Prerequisites
- **Node.js**: `v22+`
- **pnpm**: `v10+` or `v12+`
- **PostgreSQL**: Neon DB connection string or local PostgreSQL (with multi-schema support)
- **Redis**: Local instance or cloud provider (e.g. Upstash)

### 2. Installation
```bash
pnpm install
```

### 3. Generate Prisma Client
```bash
pnpm prisma:generate
```

### 4. Configure Environment
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 5. Run Development Server
```bash
pnpm dev
```
The server will start at `http://localhost:3000`.

- **API Base**: `http://localhost:3000/api/v1`
- **Interactive Scalar Docs**: `http://localhost:3000/api-docs`
- **Swagger UI**: `http://localhost:3000/api-docs/swagger`
- **Health Check**: `http://localhost:3000/health`

---

## Testing & Quality Assurance

```bash
# Run unit & integration test suite
pnpm test

# Run TypeScript type check
pnpm exec tsc --noEmit

# Production bundle build
pnpm build
```

---

## Documentation References

- `MIGRATION_ENV_SECRETS.md`: Complete specification of obsolete and active environment variables.
- `DATABASE_MIGRATION_GUIDE.md`: Multi-schema architecture details and live data integrity proof.
- `DEPLOYMENT.md`: Step-by-step production deployment guides for Docker, Render, and Vercel.

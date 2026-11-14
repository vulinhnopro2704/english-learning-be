# CLAUDE.md

This file provides guidance to Claude Code and AI agents working with this repository.

## 1. Project Overview

- **Architecture**: NestJS 12 (v12.5.0) Modular Monolith
- **Compiler**: Rspack 2 (`nest-cli.json` with `@nestjs/cli`)
- **Package Manager**: pnpm (v12+)
- **Test Runner**: Vitest (v5.1+)
- **ORM**: Prisma 7 (Multi-Schema PostgreSQL on Neon)
- **Cache**: Redis (ioredis) with scope-based invalidation & JWT blacklist
- **Spaced Repetition**: Pure TypeScript `ts-fsrs` + Rust WASI optimizer (`@open-spaced-repetition/binding`)
- **Listening**: `youtubei.js` transcript extraction + TypeScript Cloze generator
- **API Documentation**: Scalar UI & Swagger UI at `/api-docs`

---

## 2. Directory Structure

- `src/main.ts`: Application bootstrap with CORS, cookie-parser, and global prefix `/api/v1`
- `src/app.module.ts`: Root module wiring 16 domain modules, global guards, and filter
- `src/common/`: Global cross-cutting concerns:
  - `exceptions/api.exception.ts`: Standardized error envelope
  - `filters/api-exception.filter.ts`: Global exception filter
  - `pipes/api-validation.pipe.ts`: Structured validation pipe
  - `guards/`: `JwtAuthGuard`, `RolesGuard`
  - `decorators/`: `@GetCurrentUser()`, `@Public()`, `@Roles()`
  - `docs/api-docs.ts`: Scalar and Swagger setup
- `src/database/`: `PrismaService` and multi-schema client
- `src/redis/`: Global `RedisService`
- `src/modules/`: Domain modules:
  - `auth`, `users`, `courses`, `lessons`, `words`, `vocabulary`, `dictionary`, `progress`, `streak`, `practice`, `fsrs`, `listening`, `storage`, `generative`, `notification`, `health`

---

## 3. Essential Commands

```bash
# Install dependencies
pnpm install

# Generate Prisma client for all 6 schemas
pnpm prisma:generate

# Start in development mode
pnpm dev

# Type check
pnpm exec tsc --noEmit

# Run Vitest test suite
pnpm test

# Build production bundle (Rspack, <100ms)
pnpm build

# Start production server
pnpm start:prod
```

---

## 4. Coding Standards & Conventions

1. **Strict Typing**:
   - Zero `any` types. Always declare strongly-typed DTOs or interfaces.
   - Avoid unsafe type casting (`as unknown as ...`).
2. **Standardized Error Handling**:
   - Throw `ApiException` from `src/common/exceptions/api.exception.ts` with `statusCode`, `errorCode`, and `message`.
3. **Authentication & Authorization**:
   - `JwtAuthGuard` is globally applied.
   - Mark open endpoints with `@Public()`.
   - Access authenticated user via `@GetCurrentUser() user: CurrentUser` or `@GetCurrentUser('id') userId: string`.
   - Restrict roles using `@UseGuards(RolesGuard)` and `@Roles('ADMIN', 'CONTENT_CREATOR')`.
4. **Caching & Invalidation**:
   - Use `this.redisService.buildCacheKey(scope, options)` and `this.redisService.buildScopePattern(scope)`.
   - Mutating operations must invalidate related cache patterns.

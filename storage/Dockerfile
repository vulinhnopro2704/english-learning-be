# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY packages/logger ./packages/logger
WORKDIR /app/packages/logger
RUN pnpm install --frozen-lockfile
RUN pnpm build

WORKDIR /app
COPY storage/package.json storage/pnpm-lock.yaml ./storage/
WORKDIR /app/storage
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/storage/node_modules ./storage/node_modules
COPY storage ./storage
COPY --from=deps /app/packages/logger ./packages/logger

WORKDIR /app/storage
RUN npx prisma generate
RUN pnpm build
RUN pnpm prune --prod

# ── Stage 3: Production ───────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pm2
WORKDIR /app

COPY --from=builder /app/storage/dist ./dist
COPY --from=builder /app/storage/node_modules ./node_modules
COPY --from=builder /app/storage/package.json ./
COPY --from=builder /app/storage/ecosystem.config.cjs ./

ARG PORT=3003
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["pm2-runtime", "ecosystem.config.cjs"]

# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY learn/package.json learn/pnpm-lock.yaml ./learn/
COPY packages/logger ./packages/logger
WORKDIR /app/learn
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/learn/node_modules ./learn/node_modules
COPY learn ./learn
COPY packages/logger ./packages/logger
WORKDIR /app/learn
RUN npx prisma generate
RUN pnpm build
RUN pnpm prune --prod

# ── Stage 3: Production ───────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pm2
WORKDIR /app

COPY --from=builder /app/learn/dist ./dist
COPY --from=builder /app/learn/node_modules ./node_modules
COPY --from=builder /app/learn/package.json ./
COPY --from=builder /app/learn/ecosystem.config.cjs ./

ARG PORT=3002
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["pm2-runtime", "ecosystem.config.cjs"]

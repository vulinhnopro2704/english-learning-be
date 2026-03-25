# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY packages/logger ./packages/logger
WORKDIR /app/packages/logger
RUN pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app
COPY auth/package.json auth/pnpm-lock.yaml ./auth/
WORKDIR /app/auth
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/auth/node_modules ./auth/node_modules
COPY auth ./auth
COPY packages/logger ./packages/logger
WORKDIR /app/auth
RUN npx prisma generate
RUN pnpm build
RUN pnpm prune --prod

# ── Stage 3: Production ───────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pm2
WORKDIR /app

COPY --from=builder /app/auth/dist ./dist
COPY --from=builder /app/auth/node_modules ./node_modules
COPY --from=builder /app/auth/package.json ./
COPY --from=builder /app/auth/ecosystem.config.cjs ./

ARG PORT=3001
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["pm2-runtime", "ecosystem.config.cjs"]

# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN pnpm build
RUN pnpm prune --prod

# ── Stage 3: Production ───────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pm2
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY ecosystem.config.cjs ./

ARG PORT=3002
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["pm2-runtime", "ecosystem.config.cjs"]

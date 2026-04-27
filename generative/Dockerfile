# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY generative/package.json generative/pnpm-lock.yaml ./generative/
WORKDIR /app/generative
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/generative/node_modules ./generative/node_modules
COPY generative ./generative
WORKDIR /app/generative
RUN npx prisma generate
RUN pnpm build
RUN pnpm prune --prod

# ── Stage 3: Production ───────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pm2
WORKDIR /app

COPY --from=builder /app/generative/dist ./dist
COPY --from=builder /app/generative/node_modules ./node_modules
COPY --from=builder /app/generative/package.json ./
COPY --from=builder /app/generative/ecosystem.config.cjs ./

ARG PORT=3005
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["pm2-runtime", "ecosystem.config.cjs"]

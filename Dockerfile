# ── STAGE 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN pnpm prisma:generate

# Copy source code and build configs
COPY tsconfig.json nest-cli.json ./
COPY src ./src

# Build production bundle with Rspack
RUN pnpm build

# Prune devDependencies to keep image light
RUN pnpm prune --prod

# ── STAGE 2: Lightweight Production Runtime ─────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Install minimal system dependencies for native modules if needed
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built application and production dependencies
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

USER appuser

EXPOSE 3000

# Use dumb-init to properly handle UNIX signals and process reaping
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main.js"]

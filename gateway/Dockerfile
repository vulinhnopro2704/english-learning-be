FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY gateway/package.json gateway/pnpm-lock.yaml ./gateway/
COPY packages/logger ./packages/logger
WORKDIR /app/gateway
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/gateway/node_modules ./gateway/node_modules
COPY gateway ./gateway
COPY packages/logger ./packages/logger
WORKDIR /app/gateway
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/gateway/dist ./dist
COPY --from=builder /app/gateway/node_modules ./node_modules
COPY --from=builder /app/gateway/package.json ./

ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["node", "dist/src/main.js"]

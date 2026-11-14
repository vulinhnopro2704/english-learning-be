# Deployment Guide: NestJS 12 Modular Monolith

This document provides step-by-step instructions for deploying the NestJS Modular Monolith to lightweight hosting providers (Render, Fly.io, Railway, VPS, or serverless environments).

---

## 1. System Requirements and Performance Profile

| Metric | Value |
|---|---|
| **Architecture** | Modular Monolith (Single Node.js runtime process) |
| **Production Bundle Size** | ~1.04 MB (bundled and minified via Rspack) |
| **Runtime Memory (RAM)** | < 150 MB (compatible with 512MB RAM free/entry tiers) |
| **Cold Start Time** | < 1.0 second |
| **Database** | Neon PostgreSQL (Serverless connection pool) |
| **Cache Layer** | Redis (Local Docker instance or Upstash Serverless Redis) |

---

## 2. Docker Deployment (VPS / Render / Fly.io)

### Docker Compose
Run the entire production stack (API server and Redis) with a single command:
```bash
docker compose up -d --build
```

### Direct Multi-Stage Dockerfile Build
```bash
# Build production image
docker build -t english-learning-api:latest .

# Run container
docker run -d \
  --name english-learning-api \
  -p 3000:3000 \
  --env-file .env \
  english-learning-api:latest
```

---

## 3. Cloud Platform Deployment (Render / Railway)

1. Create a new **Web Service** and connect this repository.
2. Configure build and startup commands:
   - **Environment**: Node.js
   - **Build Command**: `corepack enable && pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm build`
   - **Start Command**: `node dist/main.js`
3. Supply required environment variables defined in `MIGRATION_ENV_SECRETS.md`.

---

## 4. Serverless Deployment (Vercel)

The bundled standalone entrypoint can run directly on Vercel Serverless Functions:
1. Provide `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/main.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/main.js"
    }
  ]
}
```
2. Configure environment variables in the Vercel dashboard.

---

## 5. Health Monitoring and Operational Endpoints

- **Health Check Probe**: `GET /health`
  - Validates Neon Database connectivity (`SELECT 1`)
  - Validates Redis connectivity
  - Reports process memory statistics (`rssMb`, `heapUsedMb`)
- **API Documentation**:
  - Interactive Scalar UI: `GET /api-docs`
  - Swagger UI: `GET /api-docs/swagger`

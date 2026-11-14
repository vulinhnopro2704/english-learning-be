# Environment Configuration and Secrets Reference Guide

This document specifies all environment variables and secrets to deprecate or remove following the consolidation of 8 microservices into a single NestJS Modular Monolith, along with the active variables required for local development and production deployments.

---

## 1. Deprecated and Obsolete Variables (Safe to Delete)

Because the system now runs in a single process using in-memory dependency injection, all internal service ports, HTTP proxy hops, and legacy gateway routing configurations have been eliminated. Remove the following variables from `.env`, container definitions, and GitHub Actions Secrets:

### 1.1. Internal Upstream URLs and Network Hops
| Variable Name | Former Purpose | Reason for Removal |
|---|---|---|
| `AUTH_UPSTREAM_URL` | Gateway proxy to Auth (`http://auth:3001`) | No gateway or inter-service HTTP hops |
| `LEARN_UPSTREAM_URL` | Gateway proxy to Learn (`http://learn:3002`) | No gateway or inter-service HTTP hops |
| `STORAGE_UPSTREAM_URL` | Gateway proxy to Storage (`http://storage:3003`) | No gateway or inter-service HTTP hops |
| `FSRS_AI_UPSTREAM_URL` | Gateway proxy to FSRS-AI (`http://fsrs-ai:3004`) | FSRS engine runs in-process via TypeScript |
| `GENERATIVE_UPSTREAM_URL` | Gateway proxy to Generative (`http://generative:3005`) | No gateway or inter-service HTTP hops |
| `LISTENING_UPSTREAM_URL` | Gateway proxy to Listening (`http://listening:3006`) | Listening engine runs in-process via TypeScript |
| `FSRS_AI_URL` | Learn HTTP client calling Python FSRS service | `FsrsSchedulerService` is injected directly |
| `STORAGE_SERVICE_URL` | Learn calling Storage Service for uploads | `StorageService` is injected directly |

### 1.2. Microservice Internal Ports
| Variable Name | Former Port | Reason for Removal |
|---|---|---|
| `API_GATEWAY_PORT` | Gateway port (`3000`) | Replaced by single `PORT` variable |
| `AUTH_PORT` | Auth Service port (`3001`) | Single unified server process |
| `LEARN_PORT` | Learn Service port (`3002`) | Single unified server process |
| `STORAGE_PORT` | Storage Service port (`3003`) | Single unified server process |
| `FSRS_PORT` | Python FSRS port (`3004`) | Python runtime removed entirely |
| `GENERATIVE_PORT` | Generative Service port (`3005`) | Single unified server process |
| `LISTENING_PORT` | Python Listening port (`3006`) | Python runtime removed entirely |
| `NOTIFICATION_PORT` | Notification Service port | Single unified server process |

### 1.3. Legacy Gateway Proxy and Header Injection
| Variable Name | Former Purpose | Replacement in Monolith |
|---|---|---|
| `GATEWAY_SWAGGER_ENABLED` | Gateway Swagger toggle | `SWAGGER_ENABLED` |
| `GATEWAY_SWAGGER_PATH` | Gateway Swagger path | `SWAGGER_PATH` |
| `GATEWAY_SWAGGER_TITLE` | Gateway Swagger title | `SWAGGER_TITLE` |
| `RATE_LIMIT_MAX` | Gateway rate limit threshold | Managed by `@nestjs/throttler` |
| `RATE_LIMIT_WINDOW_SEC` | Gateway rate limit window | Managed by `@nestjs/throttler` |
| `TRUST_X_FORWARDED_FOR` | Header injection between gateway and services | Monolith handles user context internally |
| `TRUST_PROXY` | Proxy trust setting | Monolith handles direct connection or reverse proxy |

### 1.4. Legacy Multi-Image Registry Secrets (GitHub Actions)
| Secret Name | Reason for Removal |
|---|---|
| `GATEWAY_IMAGE` | Gateway container image no longer built |
| `AUTH_IMAGE` | Auth container image no longer built |
| `LEARN_IMAGE` | Learn container image no longer built |
| `STORAGE_IMAGE` | Storage container image no longer built |
| `FSRS_AI_IMAGE` | FSRS Python image no longer built |
| `GENERATIVE_IMAGE` | Generative container image no longer built |
| `LISTENING_IMAGE` | Listening Python image no longer built |
| `NOTIFICATION_IMAGE` | Notification container image no longer built |

---

## 2. Active Variables for the Modular Monolith

Only a single `.env` file at the repository root is required (refer to `.env.example`):

### 2.1. Core Application Settings (Required)
| Variable Name | Example Value | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listening port for the monolith server |
| `NODE_ENV` | `production` or `development` | Node runtime environment |
| `DATABASE_URL` | `postgresql://.../neondb?sslmode=require` | Neon PostgreSQL pooled connection string across all 6 schemas |
| `REDIS_URL` | `redis://localhost:6379` or `rediss://...` | Redis cache and token blacklist instance (Local Docker or Upstash) |
| `JWT_ACCESS_SECRET` | `<random_secret_string>` | Secret key used to sign Access Tokens |
| `JWT_REFRESH_SECRET` | `<random_secret_string>` | Secret key used to sign Refresh Tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifespan |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifespan |
| `CORS_ORIGIN` | `http://localhost:5173,https://yourfrontend.com` | Comma-separated list of allowed frontend origins |
| `APP_PUBLIC_BASE_URL` | `http://localhost:5173` | Web frontend callback URL for authentication |
| `MOBILE_AUTH_REDIRECT_URL`| `app://auth/callback` | Deep link URL scheme for mobile clients |

### 2.2. OAuth 2.0 (Google Authentication)
| Variable Name | Example Value | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | Google Cloud Console OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Google Cloud Console OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/api/v1/auth/google/callback` | Authorized redirect URI configured in Google Console |

### 2.3. Media and AI Services (Optional based on features)
| Variable Name | Example Value | Description |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | `<cloud_name>` | Cloudinary account cloud name for media asset uploads |
| `CLOUDINARY_API_KEY` | `<api_key>` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | `<api_secret>` | Cloudinary API Secret |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama host address for AI tutor and roleplay generation |
| `ELEVENLABS_API_KEY` | `<elevenlabs_key>` | API key for text-to-speech audio generation |

### 2.4. Interactive API Documentation
| Variable Name | Example Value | Description |
|---|---|---|
| `SWAGGER_ENABLED` | `true` | Enables OpenAPI and Scalar documentation |
| `SWAGGER_PATH` | `api-docs` | Path to access interactive documentation |

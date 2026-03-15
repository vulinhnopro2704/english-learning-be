# 🚀 Deployment Guide — English Learning BE

## Architecture Overview

```
Push to main ──► GitHub Actions
                     │
               ┌─────┴──────┐
               ▼             ▼
        Build Gateway  Build Auth   Build Learn
             Image        Image        Image
                  │           │            │
                  ▼           ▼            ▼
           Push to GHCR Push to GHCR  Push to GHCR
                  └───────────┬───────────┘
                     ▼
              SSH into VPS
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
     Create .env   Pull       Docker
      from GH     Images    Compose Up
     Secrets                    │
          ┌─────────────────────┤
          ▼          ▼          ▼
           api-gateway     redis
                :3000        :6379
                     │
      ┌────────┴────────┐
      ▼                 ▼
 auth-service      learn-service
  (internal)        (internal)
      :3001             :3002
      │                  │
      └──────────┬───────┘
                         ▼
            Neon PostgreSQL (Cloud)
```

### Tech Stack

| Component       | Technology                       |
| --------------- | -------------------------------- |
| Runtime         | Node.js 22 (Alpine)              |
| Process Manager | PM2 (pm2-runtime)                |
| Container       | Docker + Docker Compose          |
| CI/CD           | GitHub Actions                   |
| Registry        | GitHub Container Registry (GHCR) |
| Database        | Neon PostgreSQL (Cloud)          |
| Cache           | Redis 7 (Docker container)       |

### Port Assignments

| Service | Default Port |
| ------- | ------------ |
| Gateway | 3000         |
| Auth    | 3001         |
| Learn   | 3002         |
| FSRS-AI | 3003         |

> Tất cả port đều cấu hình qua environment variables.

---

## GitHub Secrets cần thiết

### 🔑 SSH & VPS

| Secret        | Mô tả                                                  | Ví dụ                                    |
| ------------- | ------------------------------------------------------ | ---------------------------------------- |
| `VPS_HOST`    | IP address hoặc hostname của VPS                       | `203.0.113.10`                           |
| `VPS_USER`    | SSH username                                           | `deploy`                                 |
| `VPS_SSH_KEY` | SSH private key (nội dung file `~/.ssh/id_ed25519`)    | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_PORT`    | SSH port                                               | `22`                                     |
| `GHCR_PAT`    | GitHub Personal Access Token với quyền `read:packages` | `ghp_xxxx...`                            |

### 🔐 Auth Service

| Secret                   | Mô tả                          | Ví dụ                                            |
| ------------------------ | ------------------------------ | ------------------------------------------------ |
| `AUTH_DATABASE_URL`      | PostgreSQL connection string   | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_ACCESS_SECRET`      | JWT access token secret key    | `your-secret-key-here`                           |
| `JWT_REFRESH_SECRET`     | JWT refresh token secret key   | `your-secret-key-here`                           |
| `JWT_ACCESS_EXPIRATION`  | JWT access token time-to-live  | `1h`                                             |
| `JWT_REFRESH_EXPIRATION` | JWT refresh token time-to-live | `7d`                                             |
| `AUTH_PORT`              | Port cho Auth service          | `3001`                                           |

### 🚪 API Gateway

| Secret                    | Mô tả                                      | Ví dụ             |
| ------------------------- | ------------------------------------------ | ----------------- |
| `API_GATEWAY_PORT`        | Port public cho gateway                    | `3000`            |
| `RATE_LIMIT_MAX`          | Số request tối đa / cửa sổ                 | `100`             |
| `RATE_LIMIT_WINDOW_SEC`   | Kích thước cửa sổ rate limit (giây)        | `60`              |
| `TRUST_X_FORWARDED_FOR`   | Có đọc IP từ `X-Forwarded-For` hay không   | `true`            |
| `TRUST_PROXY`             | Cấu hình trusted proxy cho Express         | `loopback`        |
| `IP_BLACKLIST`            | Danh sách IP chặn, phân tách bằng dấu phẩy | `1.2.3.4,5.6.7.8` |
| `GATEWAY_SWAGGER_ENABLED` | Bật/tắt docs của gateway                   | `true`            |
| `GATEWAY_SWAGGER_PATH`    | Path docs gateway                          | `api-docs`        |
| `GATEWAY_SWAGGER_TITLE`   | Tiêu đề docs gateway                       | `API Gateway`     |

### 📚 Learn Service

| Secret               | Mô tả                        | Ví dụ                                            |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| `LEARN_DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `LEARN_PORT`         | Port cho Learn service       | `3002`                                           |

### 🤖 FSRS-AI Service

| Secret                 | Mô tả                                                        | Ví dụ                                                |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `FSRS_AI_DATABASE_URL` | PostgreSQL connection string (asyncpg format cho SQLAlchemy) | `postgresql+asyncpg://user:pass@host/db?ssl=require` |
| `FSRS_AI_PORT`         | Port cho FSRS-AI service                                     | `3003`                                               |

### 🌐 Shared

| Secret           | Mô tả                              | Ví dụ                       |
| ---------------- | ---------------------------------- | --------------------------- |
| `CORS_ORIGIN`    | Allowed CORS origin (frontend URL) | `https://your-frontend.com` |
| `REDIS_PASSWORD` | Redis password                     | `a-strong-password`         |
| `REDIS_PORT`     | Redis port trên VPS                | `6379`                      |

### 📘 Swagger cho Auth/Learn (tuỳ chọn, cho môi trường dev)

| Secret                  | Mô tả                  | Mặc định    |
| ----------------------- | ---------------------- | ----------- |
| `AUTH_SWAGGER_ENABLED`  | Bật/tắt docs auth      | `true`      |
| `AUTH_SWAGGER_PATH`     | Path docs auth nội bộ  | `api-docs`  |
| `AUTH_SWAGGER_TITLE`    | Tiêu đề docs auth      | `Auth API`  |
| `LEARN_SWAGGER_ENABLED` | Bật/tắt docs learn     | `true`      |
| `LEARN_SWAGGER_PATH`    | Path docs learn nội bộ | `api-docs`  |
| `LEARN_SWAGGER_TITLE`   | Tiêu đề docs learn     | `Learn API` |

---

## Cách thiết lập

### 1. Tạo GitHub Personal Access Token (PAT)

1. Vào **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Tạo token mới với quyền: `read:packages`
3. Copy token → thêm vào GitHub Secrets với tên `GHCR_PAT`

### 2. Thêm GitHub Secrets

1. Vào **repo → Settings → Secrets and variables → Actions**
2. Click **New repository secret** cho từng secret ở bảng trên

### 3. Set up VPS

```bash
# SSH vào VPS
ssh deploy@your-vps-ip

# Cài Docker (nếu chưa có)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Tạo thư mục deploy
mkdir -p /home/deploy/english-learning-be

# Clone repo (lần đầu)
cd /home/deploy/english-learning-be
git clone https://github.com/vulinhnopro2704/english-learning-be.git .

# Login GHCR (dùng PAT)
echo "YOUR_GHCR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 4. Deploy tự động

Push code lên branch `main` → GitHub Actions tự động:

1. Build Docker images cho gateway, auth và learn
2. Push images lên GHCR
3. SSH vào VPS → tạo `.env` files → pull images → `docker compose up`

---

## Cấu trúc dự án

```
english-learning-be/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD
├── auth/
│   ├── Dockerfile              # Multi-stage build
│   ├── .dockerignore
│   ├── ecosystem.config.cjs    # PM2 config
│   ├── prisma/
│   ├── src/
│   └── package.json
├── learn/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── ecosystem.config.cjs
│   ├── prisma/
│   ├── src/
│   └── package.json
├── gateway/
├── notification/                # (sẽ thêm sau)
├── storage/                     # (sẽ thêm sau)
├── docker-compose.yml           # Orchestrate all services
├── DEPLOYMENT.md                # Tài liệu này
└── .gitignore
```

---

## Các lệnh hữu ích trên VPS

```bash
cd /home/deploy/english-learning-be

# Xem status tất cả container
docker compose ps

# Xem logs
docker compose logs -f api-gateway # Gateway logs
docker compose logs -f auth        # Auth service logs
docker compose logs -f learn       # Learn service logs
docker compose logs -f redis       # Redis logs

# Restart 1 service
docker compose restart api-gateway
docker compose restart auth

# Rebuild & deploy lại 1 service
docker compose pull api-gateway
docker compose up -d api-gateway
docker compose pull auth
docker compose up -d auth

# Rebuild tất cả
docker compose pull
docker compose up -d --remove-orphans

# Xem PM2 processes bên trong container
docker exec auth-service pm2 list
docker exec learn-service pm2 list

# Xem PM2 logs
docker exec auth-service pm2 logs

# Dọn dẹp Docker images cũ
docker image prune -f
```

---

## Thêm service mới

Khi cần deploy thêm service (VD: `gateway`, `notification`):

1. **Tạo Dockerfile** trong thư mục service (copy template từ `auth/Dockerfile`)
2. **Tạo `ecosystem.config.cjs`** (đổi name và port)
3. **Tạo `.dockerignore`** (copy từ `auth/.dockerignore`)
4. **Thêm service vào `docker-compose.yml`**
5. **Thêm build job** vào `.github/workflows/deploy.yml`
6. **Thêm GitHub Secrets** cho service mới
7. **Cập nhật script deploy** trong workflow để tạo `.env` cho service mới

---

## Troubleshooting

| Vấn đề                    | Giải pháp                                                      |
| ------------------------- | -------------------------------------------------------------- |
| Container không start     | `docker compose logs <service>` xem lỗi                        |
| GHCR pull bị 401          | Kiểm tra `GHCR_PAT` đã có quyền `read:packages`                |
| Port bị chiếm             | Đổi port trong GitHub Secrets → redeploy                       |
| Redis connection refused  | Kiểm tra `REDIS_PASSWORD` khớp giữa root `.env` và `auth/.env` |
| Database connection error | Kiểm tra `DATABASE_URL` đúng và Neon cho phép IP của VPS       |
| PM2 memory limit          | Sửa `max_memory_restart` trong `ecosystem.config.cjs`          |

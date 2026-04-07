# syntax=docker/dockerfile:1.4

# ── Stage 1: Build ──────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /build

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ── Stage 2: Production ────────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy only app code (exclude dev files via .dockerignore)
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"]

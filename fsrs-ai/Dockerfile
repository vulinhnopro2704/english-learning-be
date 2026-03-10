# ── Stage 1: Build ──────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

# ── Stage 2: Production ────────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

# Copy only Python packages
COPY --from=builder /build/deps /usr/local/lib/python3.12/site-packages

# Copy only app code (exclude dev files via .dockerignore)
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

ENV PORT=8000
EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT

# ── Stage 1: Build ──────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Production ────────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

COPY --from=builder /install /usr/local
COPY . .

# Remove docs files from production image
RUN rm -f Idea.md Library.md MathTheory.md

ENV PORT=8000
EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT

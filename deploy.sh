#!/usr/bin/env bash
set -eo pipefail

echo "=================================================="
echo "🚀 English Learning Microservices Deployment"
echo "=================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ACTION="${1:-up}"

case "$ACTION" in
  build)
    echo "🔨 Rebuilding services without cache (clean build)..."
    docker compose build --no-cache fsrs-ai listening
    docker compose up -d --force-recreate
    ;;
  down)
    echo "🛑 Stopping all containers and cleaning networks..."
    docker compose down --remove-orphans
    ;;
  restart)
    echo "🔄 Recreating containers and applying network configuration..."
    docker compose down
    docker compose up -d --force-recreate
    ;;
  pull)
    echo "📥 Pulling latest prebuilt images from GHCR..."
    docker compose pull
    docker compose up -d --force-recreate
    ;;
  up|*)
    echo "📦 Building and starting all microservices..."
    docker compose up -d --build --force-recreate
    ;;
esac

echo ""
echo "🔍 Checking status of services..."
docker compose ps

echo ""
echo "✅ Deployment step finished!"

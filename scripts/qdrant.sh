#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="web-agent-qdrant"
VOLUME_NAME="web-agent-qdrant-data"
PORT="${QDRANT_PORT:-6333}"
IMAGE="qdrant/qdrant:latest"

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Qdrant is already running on port ${PORT}"
  exit 0
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Starting existing Qdrant container..."
  docker start "${CONTAINER_NAME}"
else
  echo "Creating Qdrant container..."
  docker volume create "${VOLUME_NAME}" 2>/dev/null || true
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -p "${PORT}:6333" \
    -v "${VOLUME_NAME}:/qdrant/storage" \
    "${IMAGE}"
fi

echo "Qdrant running at http://localhost:${PORT}"

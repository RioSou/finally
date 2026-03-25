#!/usr/bin/env bash
set -e

CONTAINER_NAME="finally"

echo "Stopping FinAlly..."

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
    echo "Container '$CONTAINER_NAME' stopped and removed."
    echo "Data volume 'finally-data' preserved (your portfolio data is safe)."
else
    echo "Container '$CONTAINER_NAME' is not running."
fi

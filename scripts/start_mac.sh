#!/usr/bin/env bash
set -e

IMAGE_NAME="finally"
CONTAINER_NAME="finally"
PORT=8000
VOLUME_NAME="finally-data"
ENV_FILE=".env"

# Move to project root (parent of scripts/)
cd "$(dirname "$0")/.."

# Check for .env file
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    echo "Copy .env.example to .env and fill in your API keys:"
    echo "  cp .env.example .env"
    exit 1
fi

# Build image if --build flag passed or image doesn't exist
if [ "$1" = "--build" ] || [ -z "$(docker images -q $IMAGE_NAME 2>/dev/null)" ]; then
    echo "Building Docker image '$IMAGE_NAME'..."
    docker build -t "$IMAGE_NAME" .
fi

# Stop and remove existing container if running
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping existing container '$CONTAINER_NAME'..."
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

# Run the container
echo "Starting FinAlly..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -v "$VOLUME_NAME":/app/db \
    -p "$PORT":"$PORT" \
    --env-file "$ENV_FILE" \
    "$IMAGE_NAME"

# Wait for health check (max 30 seconds)
echo "Waiting for server to be ready..."
for i in $(seq 1 30); do
    if curl -s "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
        echo "FinAlly is running at http://localhost:$PORT"
        # Open browser if 'open' command is available (macOS)
        if command -v open >/dev/null 2>&1; then
            open "http://localhost:$PORT"
        fi
        exit 0
    fi
    sleep 1
done

echo "Warning: Server did not respond within 30 seconds."
echo "Check logs with: docker logs $CONTAINER_NAME"
exit 1

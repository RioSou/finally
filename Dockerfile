# Stage 1: Build Next.js static export
FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


# Stage 2: Python runtime with FastAPI
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy backend project files and install dependencies (without project itself)
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --no-dev --frozen --no-install-project

# Copy backend source code
COPY backend/ ./

# Install the project itself now that source is available
RUN uv sync --no-dev --frozen

# Copy frontend static export from Stage 1
COPY --from=frontend-builder /frontend/out ./static

# Create db directory for SQLite volume mount
RUN mkdir -p /app/db

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

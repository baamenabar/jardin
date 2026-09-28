# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python Backend Runtime
# ==========================================
FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgeos-c1v5 \
    && rm -rf /var/lib/apt/lists/*

# Install uv for lightning fast, reproducible dependency installs
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy backend dependencies
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv pip install --system --no-cache fastapi "uvicorn[standard]" sqlmodel astral shapely pydantic pydantic-settings httpx python-multipart pillow

# Copy backend code
COPY backend/app ./app

# Copy compiled frontend from Stage 1 directly into static dist directory
COPY --from=frontend-builder /build/dist /frontend/dist

# Persistent data directory for SQLite & media
VOLUME /data
ENV DATABASE_URL=sqlite:////data/garden.db
ENV MEDIA_DIR=/data/media

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

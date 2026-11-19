# BUILD_FROM must be declared before the first FROM to be usable in the second stage
ARG BUILD_FROM
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

FROM ${BUILD_FROM}
WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/homebackup ./homebackup
RUN pip install --no-cache-dir .
COPY --from=ui /ui/dist ./static
ENV HOMEBACKUP_STATIC=/app/static
CMD ["python3", "-m", "uvicorn", "homebackup.main:app", "--host", "0.0.0.0", "--port", "8099"]

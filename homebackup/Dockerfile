# BUILD_FROM must be declared before the first FROM to be usable in the second stage
ARG BUILD_FROM
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

FROM ${BUILD_FROM}
# the only programs HomeBackup runs: mount/umount/blkid (util-linux), rsync, df/find (busybox), cifs/nfs helpers
RUN apk add --no-cache rsync util-linux cifs-utils nfs-utils
WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/homebackup ./homebackup
RUN pip install --no-cache-dir .
COPY --from=ui /ui/dist ./static
ENV HOMEBACKUP_STATIC=/app/static
CMD ["python3", "-m", "uvicorn", "homebackup.main:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8099"]

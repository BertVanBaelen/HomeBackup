# Base image lives here (build.yaml is deprecated). Multi-arch: the Supervisor picks amd64 or arm64.
# BUILD_FROM must be declared before the first FROM to be usable in the second stage.
ARG BUILD_FROM=ghcr.io/home-assistant/base-python:3.12-alpine3.24
# glibc image: the frontend's native build tools (TypeScript, Vite, Tailwind) ship glibc binaries for amd64 and arm64.
# Built natively per architecture by the Supervisor (no cross-build platform flags needed).
FROM node:22-bookworm-slim AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

FROM ${BUILD_FROM}
# the only programs HomeBackup runs. BusyBox's df and blkid lack the options used (df --output, blkid -o export),
# so the GNU/util-linux versions are installed; cifs-utils and nfs-utils provide the share mount helpers.
RUN apk add --no-cache rsync coreutils util-linux blkid mount umount findutils cifs-utils nfs-utils
WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/homebackup ./homebackup
RUN pip install --no-cache-dir .
COPY --from=ui /ui/dist ./static
ENV HOMEBACKUP_STATIC=/app/static
CMD ["python3", "-m", "uvicorn", "homebackup.main:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8099"]

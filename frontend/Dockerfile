# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (cached layer when only source changes)
COPY frontend/package*.json ./
RUN npm ci

# Copy source — explicit paths, full repo is the Docker build context
COPY frontend/angular.json       ./
COPY frontend/tsconfig*.json     ./
COPY frontend/ngsw-config.json   ./
COPY frontend/src                ./src

RUN npm run build

# ─── Serve stage ──────────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Angular 17 new builder outputs to dist/<name>/browser/
COPY --from=builder /app/dist/waypoint/browser /usr/share/nginx/html

# nginx template (envsubst applied at runtime)
COPY frontend/nginx/nginx.conf /etc/nginx/templates/nginx.conf.template

# Custom entrypoint handles envsubst with $BACKEND_URL only
COPY frontend/nginx/docker-entrypoint.sh /docker-entrypoint.sh
RUN  chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]

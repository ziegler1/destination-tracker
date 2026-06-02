# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first so this layer is cached when only source changes
COPY backend/package*.json  ./
RUN npm ci

COPY backend/tsconfig.json  ./
COPY backend/src            ./src
COPY backend/db             ./db

RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db   ./db

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]

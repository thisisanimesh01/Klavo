# ==============================================================================
# Klavo Multi-Stage Production Container Dockerfile
# ==============================================================================

# --- Stage 1: Build Frontend Single Page Application ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Backend Runtime Image ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5050

# Install production dependencies only
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend application source
COPY backend/src ./backend/src

# Copy built frontend assets to static distribution folder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create uploads directory and set unprivileged permissions
RUN mkdir -p /app/backend/uploads && chown -R node:node /app

USER node

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5050/api/health/live || exit 1

CMD ["node", "backend/src/index.js"]

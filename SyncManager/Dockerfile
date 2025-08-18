# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Prefer a clean prod-only install for runtime
RUN npm ci --omit=dev

# ---- runtime stage ----
FROM node:20-bookworm-slim
WORKDIR /app
# Copy only what you need, owned by the existing 'node' user
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package*.json ./
ENV NODE_ENV=production
USER node
# Set the right entrypoint per app (this repo uses build/)
# SyncManager:
# CMD ["node", "build/index.js"]
# FullSync / DeltaSync:
CMD ["node", "build/index.js"]

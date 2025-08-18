# ---- build stage ----
FROM node:20.16.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
# prepare clean prod deps for runtime
RUN npm ci --omit=dev --no-audit --no-fund

# ---- runtime stage (distroless, non-root) ----
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
ENV NODE_ENV=production
# Distroless has "node" as the entrypoint; pass the script only:
CMD ["build/index.js"]

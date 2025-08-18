# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# ---- runtime stage ----
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
# run as non-root
RUN addgroup -S nodegrp && adduser -S node -G nodegrp
USER node
# SyncManager usually compiles app.ts -> dist/app.js (adjust f different)
CMD ["node", "dist/app.js"]

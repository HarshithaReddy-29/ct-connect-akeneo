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
RUN addgroup -S nodegrp && adduser -S node -G nodegrp
USER node
# these jobs typically compile index.t -> dist/index.js
CMD ["node", "dist/index.js"]

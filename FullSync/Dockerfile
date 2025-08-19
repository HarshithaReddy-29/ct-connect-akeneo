# build
FROM cgr.dev/chainguard/node:20-dev AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
RUN npm ci --omit=dev --no-audit --no-fund

# runtime
FROM cgr.dev/chainguard/node:20
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
ENV NODE_ENV=production
USER nonroot
CMD ["node", "build/index.js"]

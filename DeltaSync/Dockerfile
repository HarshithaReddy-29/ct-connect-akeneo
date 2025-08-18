FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
RUN addgroup -S nodegrp && adduser -S node -G nodegrp
USER node
CMD ["node", "dist/index.js"]

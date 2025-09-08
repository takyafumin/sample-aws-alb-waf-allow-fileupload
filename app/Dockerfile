# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci --omit=optional || npm install --no-optional

# Build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN npm ci --omit=dev --omit=optional || npm install --omit=dev --no-optional

COPY --from=build /app/dist ./dist
COPY public ./public

EXPOSE 3000
CMD ["node", "dist/server.js"]

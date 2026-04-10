# syntax=docker/dockerfile:1

FROM node:23-slim AS base

# Install system dependencies needed for native modules (e.g. better-sqlite3)
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  python3 \
  make \
  g++ \
  git \
  && rm -rf /var/lib/apt/lists/*

# Disable telemetry
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1
ENV NODE_ENV=production
ENV SERVER_PORT=3000

WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lock ./
COPY scripts ./scripts

RUN bun install --frozen-lockfile

# Copy all source files
COPY . .

# Create data directory for DB
RUN mkdir -p /app/.eliza/.elizadb

EXPOSE 3000

CMD ["npm", "start"]

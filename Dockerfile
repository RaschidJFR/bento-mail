# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY . .
RUN npm ci

# ---------------------------------------------------------
# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./

# Make this variable visible to Next.js build
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_APP_URL
ARG BETTER_AUTH_SECRET

ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
ENV NODE_OPTIONS="--max_old_space_size=6144"
RUN npm run build

# ---------------------------------------------------------
# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
COPY --from=builder /app ./
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

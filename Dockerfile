# -----------------------------------------------------------------------------
# Base Stage
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat openssl curl
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Builder Stage
# -----------------------------------------------------------------------------
FROM base AS builder

COPY . .

# Install dependencies using pnpm cache mount
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm db:generate

# Build all workspace packages
RUN pnpm build

# -----------------------------------------------------------------------------
# Production Runner Stage
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl libc6-compat curl

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy workspace build artifacts and dependencies
COPY --from=builder /app /app

# Ensure proper non-root file ownership
RUN chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "apps/api/dist/server.js"]

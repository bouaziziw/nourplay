# Build context: monorepo root
# docker build -f packages/api/Dockerfile -t nourplay-api .

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && corepack enable

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/api/package.json packages/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && corepack enable

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/db ./packages/db
COPY packages/api ./packages/api
COPY tsconfig.base.json ./

# Generate Prisma client, compile @nourplay/db, then compile the API
RUN pnpm --filter @nourplay/db generate \
 && pnpm --filter @nourplay/db build \
 && pnpm --filter @nourplay/api build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production

# node_modules with workspace symlinks (node_modules/@nourplay/db -> ../../packages/db)
COPY --from=builder /app/node_modules ./node_modules

# @nourplay/db runtime artefacts (symlink target must exist)
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist        ./packages/db/dist
COPY --from=builder /app/packages/db/generated   ./packages/db/generated

# Compiled NestJS output
COPY --from=builder /app/packages/api/dist        ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json

WORKDIR /app/packages/api
EXPOSE 4000
CMD ["node", "dist/main"]

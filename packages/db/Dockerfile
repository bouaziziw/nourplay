# Build context: monorepo root
# docker build -f packages/db/Dockerfile -t nourplay-migrate .
# Runs: prisma migrate deploy (exits 0 on success)

FROM node:20-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && corepack enable

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json ./packages/db/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @nourplay/db

# Only the schema + migrations are needed at runtime — not the full source tree
COPY packages/db/prisma ./packages/db/prisma

WORKDIR /app/packages/db
CMD ["npx", "prisma", "migrate", "deploy"]

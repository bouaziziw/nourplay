FROM node:20-alpine AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && corepack enable

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY workers/video-validator/package.json workers/video-validator/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @nourplay/video-validator...

FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && corepack enable

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/db ./packages/db
COPY workers/video-validator ./workers/video-validator
COPY tsconfig.base.json ./

RUN pnpm --filter @nourplay/db generate \
 && pnpm --filter @nourplay/db build \
 && pnpm --filter @nourplay/video-validator build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/generated ./packages/db/generated
COPY --from=builder /app/workers/video-validator/dist ./workers/video-validator/dist
COPY --from=builder /app/workers/video-validator/package.json ./workers/video-validator/package.json

WORKDIR /app/workers/video-validator
CMD ["node", "dist/index.js"]

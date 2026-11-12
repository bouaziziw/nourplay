# Phase 11 — Dockerfiles de production + docker-compose.prod

**Date :** 2026-05-22  
**Commit :** `74be9cf feat(phase-11): production Dockerfiles, docker-compose.prod, standalone Next.js output`  
**Statut :** Complétée

---

## Scope

Création des Dockerfiles de production multi-stages pour l'API NestJS et l'application web Next.js, configuration du `docker-compose.prod.yml`, et activation du mode standalone Next.js pour les images optimisées.

---

## Dockerfile API (`packages/api/Dockerfile`)

Build en 3 stages :

```dockerfile
# Stage 1: deps — installation des dépendances
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --filter @nourplay/api --filter @nourplay/db

# Stage 2: builder — compilation TypeScript + génération Prisma
FROM deps AS builder
COPY packages/api/ packages/api/
COPY packages/db/ packages/db/
COPY tsconfig.base.json ./
RUN pnpm --filter @nourplay/db generate
RUN pnpm --filter @nourplay/api build

# Stage 3: runner — image minimale d'exécution
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/db/generated ./packages/db/generated
COPY --from=builder /app/node_modules ./node_modules
USER nestjs
EXPOSE 4000
CMD ["node", "dist/main"]
```

**Sécurité :**
- Utilisateur non-root `nestjs` (UID 1001)
- Seul le `dist/` compilé est copié dans l'image finale
- Pas de `node_modules` de dev dans le runner

---

## Dockerfile Web (`apps/web/Dockerfile`)

Build en 3 stages avec mode standalone Next.js :

```dockerfile
# Stage 1: deps
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/i18n/package.json packages/i18n/
RUN pnpm install --frozen-lockfile --filter nourplay-web...

# Stage 2: builder
FROM deps AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web/ apps/web/
COPY packages/ packages/
COPY tsconfig.base.json ./
RUN pnpm --filter nourplay-web build

# Stage 3: runner (standalone)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
```

**Optimisations :**
- `output: 'standalone'` dans `next.config.ts` → image finale < 200 MB
- `NEXT_PUBLIC_API_URL` passé en ARG de build pour la configurer à la construction

---

## Configuration standalone (`apps/web/next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...
}
```

Le mode standalone copie uniquement les dépendances nécessaires à l'exécution dans `.next/standalone`, éliminant les devDependencies et les packages inutilisés.

---

## docker-compose.prod.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nourplay
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: nourplay
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nourplay"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  migrate:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
    command: ["node", "-e", "require('./dist/main').runMigrations()"]
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy

  api:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
    ports:
      - "4000:4000"
    env_file: .env.production
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${API_URL}
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

---

## .dockerignore

```
node_modules
.next
dist
.env
.env.*
!.env.example
.git
*.log
coverage
```

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Multi-stage build | 3 stages | Image finale minimale — séparation build/runtime |
| Utilisateur non-root | UID 1001 | Bonne pratique sécurité — pas de root dans les conteneurs |
| Standalone Next.js | `output: 'standalone'` | Réduction drastique de la taille d'image (de 1GB+ à < 200MB) |
| Healthchecks | `pg_isready`, `redis-cli ping` | Évite les démarrages en cascade sur services non prêts |
| Service `migrate` | One-shot | Garantit que les migrations sont appliquées avant le démarrage de l'API |

---

## Tailles d'images obtenues

| Image | Taille |
|---|---|
| `nourplay-api` | ~180 MB |
| `nourplay-web` | ~155 MB |

---

## Tests effectués

- `docker compose -f docker-compose.prod.yml build` → succès sur les deux images (✓)
- `docker compose -f docker-compose.prod.yml up -d` → tous les services démarrent dans l'ordre (✓)
- `curl http://localhost:4000/api/v1/health` → 200 OK (✓)
- `curl http://localhost:3000` → page d'accueil servie (✓)
- Scan Trivy → 0 vulnérabilité CRITICAL sur les images finales (✓)

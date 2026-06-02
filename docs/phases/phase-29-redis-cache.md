# Phase 29 — Redis Application Cache

## Objectif

Ajouter une couche de cache Redis générique pour réduire la charge DB sur les chemins chauds introduits dans les phases précédentes, notamment `getUserPlanLimits` (appelé à chaque création de profil et de playlist).

## Nouveaux fichiers

### `packages/api/src/common/cache/cache.service.ts`

Service générique wrappant `ioredis` avec une API simple :

| Méthode | Signature | Description |
|---------|-----------|-------------|
| `get<T>` | `(key: string) → T \| null` | Désérialise depuis JSON, retourne null si absent ou invalide |
| `set<T>` | `(key, value, ttlSeconds)` | Sérialise en JSON avec `SETEX` |
| `del` | `(...keys: string[])` | Supprime une ou plusieurs clés |

Le service injecte `REDIS_CLIENT` (fourni par `BullModule @Global()`) — aucune connexion Redis supplémentaire, même pool que BullMQ.

### `packages/api/src/common/cache/cache.module.ts`

Module `@Global()` — `CacheService` est disponible dans tout le monorepo API sans import explicite.

## Modifications

### `packages/api/src/app.module.ts`

Ajout de `CacheModule` dans les imports d'infra, après `BullModule` (qui fournit `REDIS_CLIENT`).

### `packages/api/src/modules/subscription/subscription.service.ts`

| Méthode | Clé cache | TTL | Invalidation |
|---------|-----------|-----|-------------|
| `getPlans()` | `sub:plans` | 300s | Aucune (plans changent rarement) |
| `getUserPlanLimits(userId)` | `sub:limits:{userId}` | 60s | `onCheckoutCompleted`, `onSubscriptionUpdated`, `onSubscriptionDeleted` |

**Invalidation webhook** : les 3 handlers Stripe invalident le cache du bon userId immédiatement après l'écriture DB. `onSubscriptionDeleted` fait un `findFirst` préalable pour récupérer le `userId` depuis l'`externalId` Stripe.

### `packages/api/src/modules/video/video.service.ts`

| Méthode | Clé cache | TTL | Invalidation |
|---------|-----------|-----|-------------|
| `search(params)` | `videos:search:{q}:{lang}:{age}:{src}:p{page}:l{limit}` | 120s | Aucune (fenêtre de 2 min acceptable) |

## Architecture de cache

```
Redis
├── sub:plans                           ← liste des plans (TTL 5 min)
├── sub:limits:{userId}                 ← limites du forfait (TTL 60s, invalidé sur webhook)
└── videos:search:{q}:...               ← résultats de recherche (TTL 2 min)

Clés existantes (non modifiées) :
├── email_verify:{token}                ← RedisTokenService
├── pwd_reset:{token}                   ← RedisTokenService
└── magic_link:{token}                  ← RedisTokenService
```

## Impact performance

| Scénario | Avant | Après |
|----------|-------|-------|
| `createProfile` (forfait existant) | 2 requêtes DB (count + limits) | 1 requête DB (count) + 1 lecture Redis |
| `createPlaylist` (forfait existant) | 2 requêtes DB (count + limits) | 1 requête DB (count) + 1 lecture Redis |
| `GET /subscriptions/plans` | 1 requête DB | 0 DB (cache hit pendant 5 min) |
| Recherche vidéo répétée | 2 requêtes DB | 0 DB (cache hit pendant 2 min) |

## Tests

- `@nourplay/api` typecheck : 0 erreurs ✓

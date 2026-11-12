# Phase 26 — Security Hardening

## Objectif

Corriger le rate limiting global (bugué sans APP_GUARD) et renforcer la sécurité HTTP des applications Next.js web et admin.

## Ce qui a été fait

### 1. Rate limiting global activé — `packages/api/src/app.module.ts`

**Problème** : `ThrottlerModule` était importé et configuré (100 req/min), mais sans `APP_GUARD`, le guard n'était jamais appliqué globalement. Seuls les endpoints décorés avec `@Throttle()` explicitement étaient limités.

**Fix** :
```ts
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'

providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },
],
```

Désormais, chaque endpoint est couvert par la limite globale (100 req/min) sauf override explicite.

### 2. Limites strictes sur les endpoints sensibles

| Endpoint | Limite | Raison |
|----------|--------|--------|
| `POST /storage/presigned-url` | 20/min | Appels S3 — coûteux en latence |
| `POST /subscriptions/checkout` | 5/min | Anti-spam création sessions Stripe |
| `POST /subscriptions/portal` | 10/min | Anti-spam portail client |
| `POST /notifications/device-tokens` | 10/min | Éviter l'abus d'enregistrement de tokens |
| `POST /subscriptions/webhook` | `@SkipThrottle()` | Vient de Stripe (IP fixes), ne doit pas être bloqué |

### 3. En-têtes de sécurité HTTP — `apps/web/next.config.ts`

Ajout des en-têtes sur toutes les routes (`/(.*)`):

| En-tête | Valeur |
|---------|--------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-DNS-Prefetch-Control` | `on` |

NestJS API a déjà Helmet (CSP + HSTS) depuis les phases précédentes.

Note : CSP Next.js n'est pas ajouté ici — cela requiert des nonces pour être compatible avec RSC et les scripts inline de Next.js, et constituerait une phase distincte.

### 4. `apps/admin/next.config.ts` (créé)

Le panneau admin n'avait pas de `next.config.ts`. Créé avec les mêmes en-têtes de sécurité + `images.remotePatterns` pour `assets.nourplay.app`.

### 5. Hostname R2 dans `images.remotePatterns` — `apps/web/next.config.ts`

Ajout de `{ protocol: 'https', hostname: 'assets.nourplay.app' }` pour autoriser le composant `<Image>` Next.js à optimiser les avatars servis depuis Cloudflare R2.

## Tests

- `pnpm --filter @nourplay/api exec tsc --noEmit` → 0 erreurs ✓

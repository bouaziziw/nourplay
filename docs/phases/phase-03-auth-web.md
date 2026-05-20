# Phase 03 — Auth extensions + Web UI

## Objectif

Compléter l'authentification (email, 2FA TOTP, OAuth Google) et créer le socle
de l'interface web (login, register, dashboard parent).

---

## Périmètre

### Backend — `packages/api`

| Domaine | Fichiers |
|---|---|
| Email / vérification | `common/email/email.service.ts`, `common/email/email.module.ts` |
| Token Redis | `common/redis/redis-token.service.ts`, `common/redis/redis-token.module.ts` |
| Auth service | `modules/auth/auth.service.ts` |
| Auth controller | `modules/auth/auth.controller.ts` |
| Auth module | `modules/auth/auth.module.ts` |
| Strategies | `auth/strategies/jwt.strategy.ts`, `local.strategy.ts`, `google.strategy.ts` |
| DTOs | `forgot-password`, `reset-password`, `setup-totp`, `verify-email`, `verify-totp` |

### Frontend — `apps/web`

| Domaine | Fichiers |
|---|---|
| Fetch wrapper | `src/lib/api.ts` |
| Auth context | `src/hooks/useAuth.ts` |
| Layout auth | `src/app/[locale]/(auth)/layout.tsx` |
| Login | `src/app/[locale]/(auth)/login/page.tsx` |
| Register | `src/app/[locale]/(auth)/register/page.tsx` |
| Verify email | `src/app/[locale]/(auth)/verify-email/page.tsx` |
| Dashboard layout | `src/app/[locale]/(dashboard)/layout.tsx` |
| Dashboard page | `src/app/[locale]/(dashboard)/page.tsx` |
| i18n | `messages/{fr,en,ar,es}.json` |

---

## Endpoints ajoutés

```
POST /api/v1/auth/verify-email          — consomme token Redis → emailVerified = true
POST /api/v1/auth/resend-verification   — réémet le token (JWT requis, throttle 3/5min)
POST /api/v1/auth/forgot-password       — crée token Redis, envoie email (204 toujours)
POST /api/v1/auth/reset-password        — consomme token, met à jour passwordHash

POST /api/v1/auth/2fa/init              — génère secret TOTP, stocke 10min en Redis
POST /api/v1/auth/2fa/enable            — vérifie code TOTP, active en DB
POST /api/v1/auth/2fa/disable           — vérifie code TOTP, désactive en DB
POST /api/v1/auth/login/2fa             — complète le login avec code TOTP

GET  /api/v1/auth/google                — redirect OAuth Google
GET  /api/v1/auth/google/callback       — finalise OAuth, redirige vers APP_URL/auth/callback?token=...
```

---

## Décisions d'architecture

### Stockage des tokens Redis

| Token | Clé Redis | TTL |
|---|---|---|
| Vérification email | `email_verify:<token>` | 24 h |
| Reset mot de passe | `pwd_reset:<token>` | 1 h |
| Magic link | `magic_link:<token>` | 15 min |
| Setup TOTP (intermédiaire) | `totp_setup:<userId>` | 10 min |

Les tokens de reset invalidés automatiquement à la création d'un nouveau
(via `pwd_reset_user:<userId>`) pour éviter l'accumulation.

### Sécurité email

`forgotPassword` retourne toujours `204` même si l'email n'existe pas — empêche
l'énumération d'adresses.

### Fingerprint de session

```
SHA-256( IP /24 | user-agent )
```

Même sous-réseau /24 = même session légitime. Fingerprint différent → révocation
de **toutes** les sessions de l'utilisateur.

### OAuth Google

Stratégie `findOrCreate` :
1. Cherche par `googleId` ou `email`
2. Si trouvé sans `googleId` → lie le compte existant
3. Si absent → crée un compte `PARENT` avec `emailVerified = true`

---

## Tests

### Unitaires (`vitest run`)

Fichier : `packages/api/src/modules/auth/auth.service.spec.ts`

15 cas couvrant : register, verifyEmail, validateUser, buildFingerprint, login,
refreshTokens, forgotPassword.

### Intégration (`vitest run --config vitest.e2e.config.ts`)

Fichier : `packages/api/test/auth.e2e-spec.ts`

NestJS `Test.createTestingModule` + Supertest. Prisma / Redis / Email remplacés
par des mocks en mémoire. 20 cas couvrant l'intégralité des routes auth.

---

## Commandes

```bash
# Backend
pnpm --filter @nourplay/api test            # unit tests
pnpm --filter @nourplay/api test:e2e        # integration tests
pnpm --filter @nourplay/api typecheck       # tsc --noEmit

# Frontend
pnpm --filter web dev                       # Next.js dev server

# Monorepo
pnpm install                               # pick up new deps (supertest, passport-google-oauth20…)
```

---

## Variables d'environnement requises (nouvelles)

```env
# Email
EMAIL_PROVIDER=resend           # console | resend
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@nourplay.app

# OAuth Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://api.nourplay.app/api/v1/auth/google/callback

# TOTP
TOTP_APP_NAME=NourPlay
```

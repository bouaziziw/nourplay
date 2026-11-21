# Configuration Vercel - NourPlay

> **Date de mise à jour:** 16 novembre 2026
> **État:** HTTP production vérifié. Pour l'audit Pro à jour, les limites WebSocket/Daemons et le tutoriel, voir [VERCEL_PRO_COMPATIBILITY_AND_DEPLOYMENT.md](./VERCEL_PRO_COMPATIBILITY_AND_DEPLOYMENT.md).

## Vue d'ensemble

Ce document documente la configuration Vercel pour le projet NourPlay. Le projet comprend **3 applications Vercel indépendantes** qui communiquent par rewrites HTTP.

```
┌─────────────────────────────────────┐
│   nour-play.app (Domain)            │
│   └─ Vercel Project: nourplay       │
│      └─ apps/web (Next.js 14)       │
│         ├─ Rewrite /api/*           │
│         │  └─ nourplay-api.vercel.app
│         └─ Rewrite /admin/*         │
│            └─ nourplay-admin.vercel.app
│                                     │
├─ Vercel Project: nourplay-admin     │
│  └─ apps/admin (Next.js 14)         │
│                                     │
├─ Vercel Project: nourplay-api       │
│  └─ packages/api (NestJS 10)        │
│     ├─ PostgreSQL (Neon)            │
│     ├─ Redis (Upstash)              │
│     └─ Cron Tasks (via cron-job.org)│
│                                     │
└─ External Worker (Railway/Render)   │
   └─ workers/video-validator         │
      └─ OPENAI_API_KEY only          │
```

## Domaine principal

- **Domaine**: `nour-play.app`
- **Équipe Vercel**: `bouaziziws-projects`
- **Assigné au projet**: `nourplay` (apps/web)
- **Certificat SSL**: Automatique (Let's Encrypt via Vercel)

> ⚠️ Ne pas assigner le même domaine à `nourplay-admin` ou `nourplay-api`. Les trois origines passent par un seul domaine public via les rewrites Next.js du projet web.

## Projets Vercel

### 1. nourplay (Web)

| Clé | Valeur |
|---|---|
| **Git Repository** | `bouaziziw/nourplay` |
| **Root Directory** | `apps/web` |
| **Framework** | Next.js 14 |
| **Node.js Version** | 22.x |
| **Production Branch** | `main` |
| **Install Command** | `cd ../.. && pnpm install --frozen-lockfile` |
| **Build Command** | `cd ../.. && pnpm --filter @nourplay/web build` |
| **Output Directory** | `.next` |
| **Include source files outside Root** | ✅ Activé |

**Domains**: `nour-play.app`, `www.nour-play.app`

**Environment Variables** (Production):

```
NEXT_PUBLIC_API_URL = https://nour-play.app/api/v1
NEXT_PUBLIC_APP_URL = https://nour-play.app
NEXT_PUBLIC_S3_PUBLIC_URL = https://assets.nourplay.app (ou votre CDN)
API_PROXY_ORIGIN = https://nourplay-api.vercel.app (⚠️ PAS nour-play.app)
ADMIN_PROXY_ORIGIN = https://nourplay-admin.vercel.app (⚠️ PAS nour-play.app)
```

**Ignored Build Step** (optionnel, pour optimiser CI):
```
npx turbo-ignore @nourplay/web
```

---

### 2. nourplay-admin (Admin Dashboard)

| Clé | Valeur |
|---|---|
| **Git Repository** | `bouaziziw/nourplay` |
| **Root Directory** | `apps/admin` |
| **Framework** | Next.js 14 |
| **Node.js Version** | 22.x |
| **Production Branch** | `main` |
| **Install Command** | `cd ../.. && pnpm install --frozen-lockfile` |
| **Build Command** | `cd ../.. && pnpm --filter @nourplay/admin build` |
| **Include source files outside Root** | ✅ Activé |

**Environment Variables** (Production):

```
NEXT_PUBLIC_API_URL = https://nour-play.app/api/v1
ADMIN_BASE_PATH = /admin (au build ET à l'exécution)
```

**Ignored Build Step** (optionnel):
```
npx turbo-ignore @nourplay/admin
```

> ⚠️ Le `ADMIN_BASE_PATH` doit être configuré **avant** le build, pas après. Redéployez après modification.

---

### 3. nourplay-api (Backend API)

| Clé | Valeur |
|---|---|
| **Git Repository** | `bouaziziw/nourplay` |
| **Root Directory** | `packages/api` |
| **Framework** | NestJS 10 |
| **Node.js Version** | 22.x |
| **Production Branch** | `main` |
| **Install Command** | `cd ../.. && pnpm install --frozen-lockfile` |
| **Build Command** | `cd ../.. && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db build && pnpm --filter @nourplay/api build` |
| **Functions Region** | **Frankfurt (fra1)** ← Même région que Neon + RGPD |
| **Include source files outside Root** | ✅ Activé |

**Function Configuration** (Settings → Functions):

| Paramètre | Valeur |
|---|---|
| **Memory** | 1024 MB (par défaut) |
| **Max Duration** | Pro : 300 s par défaut, jusqu'à 800 s selon la configuration (extension bêta possible) |
| **Region** | Frankfurt (`fra1`) |

**Ignored Build Step** (optionnel):
```
npx turbo-ignore @nourplay/api
```

---

## Bases de données & Services

### PostgreSQL (Neon)

| Configuration | Valeur |
|---|---|
| **Service** | Neon (via Vercel Marketplace) |
| **Version** | PostgreSQL 16 |
| **Region** | Europe - Frankfurt (`eu-central-1`) |
| **Nom du projet Neon** | `nourplay-db` |
| **Connecté au projet** | `nourplay-api` (Production + Preview) |

**Variables injectées automatiquement**:

```
DATABASE_URL              # URL poolée (PgBouncer) → utilisée par l'API au runtime
DATABASE_URL_UNPOOLED     # URL directe → utilisée uniquement pour les migrations
PGHOST, PGUSER, PGPASSWORD, PGDATABASE  # Optionnels, non utilisés
```

**Migrations**:

```bash
# En local avant production
$env:DATABASE_URL = $env:DATABASE_URL_UNPOOLED
pnpm --filter @nourplay/db migrate:deploy
# Puis restaurer DATABASE_URL à l'URL poolée
```

> La config Prisma utilise intentionnellement `DATABASE_URL` (poolée) au runtime. Ne pas ajouter `directUrl` au schéma.

---

### Redis (Upstash)

| Configuration | Valeur |
|---|---|
| **Service** | Upstash (via Vercel Marketplace) |
| **Version** | Redis 7+ |
| **Region** | EU (Frankfurt) |
| **Nom du projet** | `nourplay-redis` |
| **Connecté au projet** | `nourplay-api` (Production + Preview) |
| **Éviction** | `noeviction` (obligatoire pour BullMQ) |

**Variable injectée**:

```
REDIS_URL  # Format: rediss://default:<PASSWORD>@<HOST>:<PORT>
```

> L'API vérifie `REDIS_URL` au démarrage. Sans elle, le démarrage échoue.

---

## Variables d'environnement - Détail complet

### API (nourplay-api) - Production

#### Authentification & Sécurité

```
JWT_ACCESS_SECRET = <random-32-chars-base64>
JWT_REFRESH_SECRET = <random-32-chars-base64>
COOKIE_SECRET = <random-32-chars-base64>
JWT_ACCESS_TTL = 900
JWT_REFRESH_TTL = 604800
BCRYPT_ROUNDS = 12
CRON_SECRET = <random-32-chars-hex>  # Aussi utilisé pour cron-job.org
```

#### Informations App

```
APP_URL = https://nour-play.app
API_URL = https://nour-play.app
ADMIN_URL = https://nour-play.app/admin
CORS_ORIGINS = https://nour-play.app,https://www.nour-play.app
```

#### 2FA & OAuth

```
TOTP_ISSUER = NourPlay
TOTP_APP_NAME = NourPlay
GOOGLE_CLIENT_ID = <from Google Cloud Console>
GOOGLE_CLIENT_SECRET = <secret>
GOOGLE_CALLBACK_URL = https://nour-play.app/api/v1/auth/google/callback
```

#### Email (Resend)

```
EMAIL_PROVIDER = resend
RESEND_API_KEY = re_<key>
EMAIL_FROM = NourPlay <noreply@nour-play.app>
```

#### Stockage (Cloudflare R2 ou S3)

```
S3_ENDPOINT = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID = <key>
S3_SECRET_ACCESS_KEY = <secret>
S3_BUCKET = nourplay-assets
S3_PUBLIC_URL = https://assets.nourplay.app
```

#### Vidéo (sources externes)

```
YOUTUBE_API_KEY = <key>  # Optionnel
VIMEO_ACCESS_TOKEN = <token>  # Optionnel
```

#### Web Push

```
VAPID_PUBLIC_KEY = <generated>
VAPID_PRIVATE_KEY = <generated>
VAPID_SUBJECT = mailto:security@nour-play.app
```

#### Paiements (Stripe)

```
STRIPE_SECRET_KEY = sk_live_<key>
STRIPE_PUBLISHABLE_KEY = pk_live_<key>
STRIPE_WEBHOOK_SECRET = whsec_<key>
```

> ⚠️ **NE PAS** ajouter `OPENAI_API_KEY` à l'API. Elle va uniquement sur le worker externe.

---

## Tâches planifiées (Cron)

### Option A: Scheduler externe (cron-job.org)

1. Aller sur https://console.cron-job.org/
2. Se connecter / créer un compte
3. Créer 4 tâches HTTP:

#### Tâche 1: Publier les playlists planifiées

| Paramètre | Valeur |
|---|---|
| **URL** | `https://nour-play.app/api/v1/cron/publish-scheduled` |
| **Méthode** | GET |
| **Horaire** | `* * * * *` (chaque minute) |
| **Headers** | `Authorization: Bearer <CRON_SECRET>` |
| **Timezone** | UTC |

#### Tâche 2: Digests hebdomadaires

| Paramètre | Valeur |
|---|---|
| **URL** | `https://nour-play.app/api/v1/cron/weekly-digest` |
| **Horaire** | `0 8 * * 1` (lundi 8h UTC) |

#### Tâche 3: Rappels d'expiration d'abonnement

| Paramètre | Valeur |
|---|---|
| **URL** | `https://nour-play.app/api/v1/cron/subscription-reminders` |
| **Horaire** | `0 10 * * *` (quotidien 10h UTC) |

#### Tâche 4: Nettoyage des abonnements expirés

| Paramètre | Valeur |
|---|---|
| **URL** | `https://nour-play.app/api/v1/cron/subscription-cleanup` |
| **Horaire** | `0 2 * * *` (quotidien 2h UTC) |

> Toutes les tâches utilisent le même `Authorization: Bearer <CRON_SECRET>`.

---

### Option B: Vercel Cron (Vercel Pro)

Sur un plan **Pro**, les tâches Vercel Cron peuvent tourner jusqu'à chaque minute (avec la précision/jitter du plan). Seule `publish-scheduled` est configurée et activée dans le déploiement API vérifié. Les détails sont dans [VERCEL_PRO_COMPATIBILITY_AND_DEPLOYMENT.md](./VERCEL_PRO_COMPATIBILITY_AND_DEPLOYMENT.md).

Vercel envoie `Authorization: Bearer <CRON_SECRET>` si cette variable existe dans l'environnement de production du projet. Les Cron Jobs consomment les invocations et ressources des Functions ; confirmer les effets métier et le coût avant déploiement.

---

## Worker Externe (Video-Validator)

### Raison de l'exclusion de Vercel

- Le worker `workers/video-validator` est un **processus permanent**
- Il consomme Redis en continu via BullMQ (lecture de queue)
- Une Vercel Function HTTP est à la demande et limitée en durée ; ce n'est pas un consommateur de queue permanent
- Les jobs OpenAI prennent 10-45 secondes chacun

### Solution recommandée: Railway ou Render

**Plateforme recommandée**: **Railway**

1. Créer un projet Railway `nourplay-worker`
2. Connecter le repo GitHub et sélectionner `workers/video-validator`
3. Configurer les variables d'environnement:

```
REDIS_URL = <même Upstash que l'API>
OPENAI_API_KEY = sk_<key>
DATABASE_URL = <optionnel, pour les logs>
NODE_ENV = production
```

4. Déployer

> ⚠️ L'API Vercel n'a **pas** `OPENAI_API_KEY`. Elle utilise uniquement Redis pour enfiler/défiler les jobs.

Vercel Pro propose également **Daemons** en bêta pour les workers continus. Ils peuvent être évalués avec le Dockerfile existant, mais ne fournissent pas d'autoscaling pendant la bêta et ont des quotas/coûts propres. Voir la section de compatibilité dans le guide Pro avant de choisir cette option.

---

## Checklist avant Go-Live

### Domaine & DNS

- [ ] Domaine `nour-play.app` acheté et transféré à Vercel Registrar (ou Cloudflare)
- [ ] Nameservers pointent vers Vercel
- [ ] Certification SSL active (Let's Encrypt)
- [ ] `www.nour-play.app` redirige vers `nour-play.app`

### Projets Vercel

- [ ] `nourplay` (web) créé et déployé
- [ ] `nourplay-admin` créé et déployé
- [ ] `nourplay-api` créé et déployé
- [ ] Trois projets dans la même **team**
- [ ] Node.js 22.x sur tous
- [ ] Branche de production = `main`

### Bases de données

- [ ] Neon PostgreSQL créée (Frankfurt)
- [ ] Migrations appliquées
- [ ] Upstash Redis créée (Frankfurt)
- [ ] Éviction = `noeviction`
- [ ] Bases connectées aux projets Vercel

### Variables d'environnement

- [ ] Secrets JWT/Cookie/CRON générés et configurés
- [ ] `API_PROXY_ORIGIN` et `ADMIN_PROXY_ORIGIN` correctes
- [ ] Toutes les variables `NEXT_PUBLIC_*` correctes
- [ ] Email/Stockage/OAuth/Stripe configurés

### Tâches planifiées

- [ ] Cron-job.org configuré (ou plan Pro activé)
- [ ] 4 tâches créées avec `CRON_SECRET`
- [ ] Horaires en UTC

### Worker

- [ ] Déployé sur Railway/Render
- [ ] OPENAI_API_KEY présente (pas sur API)
- [ ] REDIS_URL même Upstash que l'API

### Tests

- [ ] `curl https://nour-play.app` → page web
- [ ] `curl https://nour-play.app/admin/login` → admin
- [ ] `curl https://nour-play.app/api/v1/subscriptions/plans` → JSON
- [ ] Inscription → vérification email
- [ ] Connexion → tokens JWT + cookies
- [ ] Upload avatar → stockage R2

---

## Troubleshooting

### Erreur: "API_PROXY_ORIGIN and ADMIN_PROXY_ORIGIN must be configured together"

**Cause**: Une des deux origines manque lors du build du web.

**Solution**:
1. Aller dans `nourplay → Settings → Environment Variables → Production`
2. Ajouter les deux: `API_PROXY_ORIGIN` et `ADMIN_PROXY_ORIGIN`
3. Redéployer sans cache: **Deployments → ⋯ → Redeploy** (décocher "Use existing Build Cache")

---

### Erreur: "Unexpected end of JSON input" au déploiement API

**Cause**: Prisma binaire manquant pour Linux.

**Solution**:
1. Vérifier que `binaryTargets = ["native", "rhel-openssl-3.0.x"]` dans `packages/db/prisma/schema.prisma`
2. Relancer le build: redéployer sans cache

---

### API démarre mais refuse les connexions

**Cause**: REDIS_URL manquante ou incorrecte.

**Solution**:
1. Aller dans `nourplay-api → Settings → Environment Variables`
2. Vérifier que `REDIS_URL` existe (auto-injectée par Upstash)
3. Tester la connexion Redis depuis Upstash Console

---

### Cookies de session ne sont pas partagés entre web et admin

**Cause**: Domaines/chemins mal configurés.

**Solution**:
1. Vérifier que les deux apps utilisent le domaine `nour-play.app` (pas `.vercel.app`)
2. Vérifier que le contrôleur d'authentification API fixe le chemin cookie à `/api/v1/auth` (check dans `packages/api/src/modules/auth/*)
3. Cookies doivent avoir `Domain=nour-play.app`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`

---

### Cron-job.org n'exécute pas les tâches

**Cause**: `CRON_SECRET` incorrect ou manquant.

**Solution**:
1. Vérifier que `CRON_SECRET` est configurée dans `nourplay-api` (Settings → Environment Variables → Production, **Sensitive**)
2. Copier la valeur dans cron-job.org exactement
3. Tester manuellement: `curl -H "Authorization: Bearer <CRON_SECRET>" https://nour-play.app/api/v1/cron/publish-scheduled`

---

## Ressources

- [Vercel Documentation](https://vercel.com/docs)
- [Neon PostgreSQL on Vercel](https://neon.tech/docs/guides/vercel)
- [Upstash Redis on Vercel](https://upstash.com/docs/redis/features/vercel-integration)
- [NestJS on Vercel](https://docs.nestjs.com/deployment/vercel)
- [cron-job.org Documentation](https://console.cron-job.org/)
- [NourPlay Architecture Guide](../nourplay_architecture.md)

---

**Maintenu par:** DevOps Team
**Dernière révision:** 16 novembre 2026

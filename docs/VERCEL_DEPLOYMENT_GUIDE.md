# Guide de déploiement NourPlay sur Vercel (Web + Admin + API + Neon)

> **Configuration Hobby en cours :** les routes cron sécurisées existent dans l'API, mais aucune tâche Vercel Cron n'est configurée. Utilisez cron-job.org avec `Authorization: Bearer <CRON_SECRET>` pour appeler les quatre routes du § 4.3 aux horaires indiqués. Le secret doit être défini dans le projet API et ne doit pas être publié.
>
> Les WebSockets sont désormais disponibles en bêta sur Vercel : ils nécessitent toutefois un état partagé entre instances et une reconnexion des clients. La watch-party actuelle ne dispose pas encore de cette adaptation ; ne la considérez pas comme fonctionnelle sur Vercel.
>
> La configuration actuelle de Prisma n'utilise pas `directUrl`. Pour les migrations de production, fournissez l'URL Neon directe dans `DATABASE_URL` uniquement au processus de migration. Ne remplacez pas l'URL poolée utilisée par l'API.

> Basé sur [SETUP_AND_DEPLOY.md](./SETUP_AND_DEPLOY.md), **vérifié contre le code du dépôt** et la documentation Vercel/Neon actuelle.
> `domaine.com` désigne `nour-play.app`. Pour les étapes à jour, les origines
> de proxy et la configuration Hobby, suivez en priorité
> [le guide pas à pas](./GUIDE_DEPLOIEMENT_PAS_A_PAS.md).
> Les deux builds Next.js (`apps/web`, `apps/admin`) ont été validés localement. Le déploiement de l'API sur Vercel n'a **pas** pu être testé sur un compte réel : l'étape de vérification locale `vercel build` (§ 4.5) sert à le valider avant de pousser.

---

## Sommaire

1. [Verdict : ce qui marche sur Vercel et ce qui ne marche pas](#1-verdict--ce-qui-marche-sur-vercel-et-ce-qui-ne-marche-pas)
2. [Architecture cible](#2-architecture-cible)
3. [Prérequis](#3-prérequis)
4. [Adapter l'API pour Vercel (modifications de code obligatoires)](#4-adapter-lapi-pour-vercel-modifications-de-code-obligatoires)
5. [Créer les 3 projets Vercel (monorepo)](#5-créer-les-3-projets-vercel-monorepo)
6. [Neon PostgreSQL 16 depuis Vercel](#6-neon-postgresql-16-depuis-vercel)
7. [Redis (obligatoire) via le Marketplace Vercel](#7-redis-obligatoire-via-le-marketplace-vercel)
8. [Variables d'environnement projet par projet](#8-variables-denvironnement-projet-par-projet)
9. [Nom de domaine et routage par chemins](#9-nom-de-domaine-et-routage-par-chemins)
10. [Migrations et premier compte admin](#10-migrations-et-premier-compte-admin)
11. [Services tiers (Resend, Stripe, R2, OpenAI…)](#11-services-tiers-resend-stripe-r2-openai)
12. [Ce qui doit tourner hors Vercel : worker IA et watch-party](#12-ce-qui-doit-tourner-hors-vercel--worker-ia-et-watch-party)
13. [Application mobile `apps/mobile`](#13-application-mobile-appsmobile)
14. [Déploiements, CI et rollback](#14-déploiements-ci-et-rollback)
15. [Checklist finale](#15-checklist-finale)
16. [Dépannage](#16-dépannage)

---

## 1. Verdict : ce qui marche sur Vercel et ce qui ne marche pas

| Élément | Sur Vercel ? | Détail |
|---|---|---|
| `apps/web` (Next.js 14) | ✅ natif | PWA incluse (`next-pwa`). |
| `apps/admin` (Next.js 14) | ✅ natif | |
| `packages/api` (NestJS 10) | ⚠️ **oui pour le REST, avec adaptations** | Vercel déploie NestJS en « zero config » comme **une seule Vercel Function** (Fluid compute). Il faut adapter les **4 tâches `@Cron`** (§ 4). |
| Neon PostgreSQL 16 | ✅ | Intégration native du Marketplace (§ 6). |
| **Redis** | ➕ à ajouter | L'API **exige** `REDIS_URL` (validation au démarrage). Vous n'en avez pas parlé : utilisez Upstash via le Marketplace (§ 7). |
| **Watch-party (Socket.IO)** | ⚠️ **adaptation nécessaire** | WebSockets disponibles, mais routage Upgrade, état partagé et reconnexion restent à développer et tester (§ 12). |
| **Worker `video-validator` (BullMQ)** | ❌ **impossible sur Vercel** | Processus permanent qui consomme une file Redis. L'API ne fait qu'**enfiler** les jobs (OK sur Vercel), mais sans worker, aucune vidéo n'est validée par l'IA. Héberger sur Railway/Render/Fly (§ 12). |
| `apps/mobile` | ❌ app native / ⚠️ web expérimental | Voir § 13 : recommandation = PWA (`apps/web`) + EAS pour les stores. |

**Plan Vercel :** Hobby est réservé à l'usage non commercial et limite les Cron Jobs ; utilisez cron-job.org pour les tâches fréquentes ou choisissez un plan adapté.

---

## 2. Architecture cible

```
                    nour-play.app → Vercel apps/web
                       /admin/* → origine apps/admin
                       /api/*   → origine packages/api
                                    │
                  Neon PostgreSQL · Upstash Redis · Railway worker
```

Le navigateur utilise une seule origine publique. Les origines `*.vercel.app`
des projets admin et API sont les destinations techniques des rewrites, pas
les URL configurées dans les clients. Le cookie refresh conserve son chemin
`/api/v1/auth`.

---

## 3. Prérequis

1. Compte Vercel et plan adapté à l'usage ; le domaine doit appartenir à **la même team** que les projets.
2. Dépôt GitHub `bouaziziw/nourplay` avec la branche `main` à jour.
3. Outils locaux :
   ```bash
   node -v                 # >= 20 (recommandé 22)
   corepack enable
   corepack prepare pnpm@9.15.0 --activate
   npm i -g vercel         # CLI >= 48.4.0
   vercel --version
   vercel login
   ```
4. Secrets à générer (une seule fois, à stocker dans un gestionnaire de mots de passe) :
   ```bash
   openssl rand -base64 32   # JWT_ACCESS_SECRET
   openssl rand -base64 32   # JWT_REFRESH_SECRET
   openssl rand -base64 32   # COOKIE_SECRET
   openssl rand -hex 32      # CRON_SECRET (§ 4.3)
   npx web-push generate-vapid-keys   # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
   ```
   PowerShell : `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

> ⚠️ N'exécutez **jamais** `pnpm db:seed` en production (comptes de test `admin@nourplay.local` / `Admin1234!`).

---

## 4. Adapter l'API pour Vercel (modifications de code obligatoires)

Ces changements sont à committer **avant** de créer le projet API. Ils ne cassent pas le mode Docker/VPS.

### 4.1 Prisma : URL directe + binaire Linux (`packages/db/prisma/schema.prisma`)

L'intégration Neon fournit une URL poolée (`DATABASE_URL`) **et** une URL directe (`DATABASE_URL_UNPOOLED`). Le schéma utilise l'URL `DATABASE_URL` et inclut le binaire Linux nécessaire. Pour migrer, fournissez temporairement l'URL directe sous le nom `DATABASE_URL`, sans changer la configuration runtime.

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../generated/client"
  previewFeatures = ["fullTextSearch"]
  binaryTargets   = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

La CI et Docker peuvent continuer à utiliser leur `DATABASE_URL` habituelle.

### 4.2 Désactiver `@nestjs/schedule` sur Vercel (`packages/api/src/app.module.ts`)

Une Function ne tourne pas en continu : les `@Cron` internes ne se déclencheraient pas de façon fiable.

```ts
// remplacer :  ScheduleModule.forRoot(),
...(process.env.VERCEL ? [] : [ScheduleModule.forRoot()]),
```
(`VERCEL=1` est défini automatiquement par la plateforme.)

### 4.3 Exposer les 4 tâches par des routes sécurisées

Tâches existantes :

| Méthode | Cron d'origine | Fichier |
|---|---|---|
| `PlaylistService.publishScheduled()` | chaque minute | `modules/playlist/playlist.service.ts` |
| `UserTasksService.sendWeeklyDigests()` | lundi 08:00 | `modules/user/user.tasks.ts` |
| `SubscriptionTasksService.sendExpiryReminders()` | tous les jours 10:00 | `modules/subscription/subscription.tasks.ts` |
| `SubscriptionTasksService.markExpiredSubscriptions()` | tous les jours 02:00 | idem |

**a) Exporter les services de tâches** : dans `user.module.ts` → `exports: [UserService, UserTasksService]` ; dans `subscription.module.ts` → `exports: [SubscriptionService, SubscriptionTasksService]`.

**b) et c)** Le contrôleur et le module sont déjà présents dans
`packages/api/src/modules/cron/` localement. Vérifiez qu'ils sont inclus dans
le code publié ; utilisez leur implémentation réelle et ses tests plutôt qu'un
exemple à recopier.

**d) Sur un plan Pro uniquement**, créer `packages/api/vercel.json` (heures en **UTC**). Sur Hobby, ne créez pas ce fichier ; configurez les quatre appels sur cron-job.org avec les mêmes horaires et l'en-tête `Authorization: Bearer <CRON_SECRET>` :

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/v1/cron/publish-scheduled", "schedule": "* * * * *" },
    { "path": "/api/v1/cron/weekly-digest", "schedule": "0 8 * * 1" },
    { "path": "/api/v1/cron/subscription-reminders", "schedule": "0 10 * * *" },
    { "path": "/api/v1/cron/subscription-cleanup", "schedule": "0 2 * * *" }
  ]
}
```

Les Cron Jobs ne tournent que sur le déploiement **Production** et envoient automatiquement `CRON_SECRET` en `Bearer` si la variable existe dans le projet.

### 4.4 (Recommandé) Endpoint de santé

Aucun `/api/health` n'existe dans le code. Ajoutez un contrôleur minimal (`GET /api/v1/health`) ou utilisez `/api/v1/subscriptions/plans` (route publique existante) pour vos tests/monitoring.

### 4.5 Valider localement avant de pousser

```bash
cd packages/api
vercel link            # associe le dossier à un projet Vercel (créé à l'étape 5 si besoin)
vercel pull --yes      # récupère variables + réglages du projet
vercel build           # reproduit le build Vercel en local
vercel dev             # (CLI >= 48.4.0) lance l'API comme en production
```

Puis : `curl http://localhost:3000/api/v1/subscriptions/plans`.

### 4.6 Points à surveiller (premier déploiement)

- **Taille** : 250 Mo max par Function. Prisma + AWS SDK + Stripe + argon2 restent en général sous la limite.
- **Corps de requête max 4,5 Mo** sur Vercel Functions : à garder en tête pour l'upload d'avatar (le stockage passe par S3/R2).
- **Webhook Stripe** : `rawBody: true` est activé dans `main.ts` ; testez la signature après déploiement (§ 11).
- **Swagger** est désactivé quand `NODE_ENV=production` (comportement normal).

---

## 5. Créer les 3 projets Vercel (monorepo)

Un dépôt Git → **3 projets Vercel**, un par application. Réglages communs :

- ✅ **Include source files outside of the Root Directory in the Build Step** : activé (par défaut sur les nouveaux projets). Indispensable : `apps/web` dépend de `@nourplay/ui` et `@nourplay/i18n` (`workspace:*`), l'API de `@nourplay/db`.
- **Node.js Version** : 22.x (Project → Settings → General), compatible avec `engines: >=20`.
- **Production Branch** : `main`.

### 5.1 Étapes communes (interface)

1. <https://vercel.com/dashboard> → choisissez votre **team** → bouton **Add New… → Project**.
2. **Import Git Repository** : si le dépôt n'apparaît pas, **Adjust GitHub App Permissions** et autorisez `bouaziziw/nourplay`. Cliquez **Import** à côté de `nourplay`.
3. Sur l'écran **Configure Project** :
   - **Project Name** ;
   - **Framework Preset** ;
   - **Root Directory** → **Edit** → sélectionnez le dossier ;
   - **Build and Output Settings** → activez **Override** sur les champs voulus ;
   - **Environment Variables** (peut être fait après, § 8) ;
   - **Deploy**.

> Au premier import, laissez l'échec éventuel du build arriver : il faut d'abord les variables (§ 8) ; vous pourrez **Redeploy** ensuite.

### 5.2 Projet n°1 — `nourplay-web` (`apps/web`)

| Champ | Valeur |
|---|---|
| Framework Preset | **Next.js** |
| Root Directory | `apps/web` |
| Install Command (Override) | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command (Override) | `cd ../.. && pnpm --filter @nourplay/web build` |
| Output Directory | `.next` (par défaut) |
| Ignored Build Step (Settings → Git) | `npx turbo-ignore @nourplay/web` *(optionnel : évite de rebuild si seul l'admin/l'API a changé)* |

> Le fichier `next.config.mjs` déclare `output: 'standalone'` pour Docker ; Vercel l'ignore, aucun conflit.

### 5.3 Projet n°2 — `nourplay-admin` (`apps/admin`)

Répétez **Add New… → Project** avec le **même dépôt**.

| Champ | Valeur |
|---|---|
| Project Name | `nourplay-admin` |
| Framework Preset | **Next.js** |
| Root Directory | `apps/admin` |
| Install Command (Override) | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command (Override) | `cd ../.. && pnpm --filter @nourplay/admin build` |
| Ignored Build Step | `npx turbo-ignore @nourplay/admin` *(optionnel)* |

### 5.4 Projet n°3 — `nourplay-api` (`packages/api`)

| Champ | Valeur |
|---|---|
| Project Name | `nourplay-api` |
| Framework Preset | **NestJS** (détecté automatiquement grâce à `src/main.ts` ; sinon choisissez-le dans la liste) |
| Root Directory | `packages/api` |
| Install Command (Override) | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command (Override) | `cd ../.. && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db build && pnpm --filter @nourplay/api build` |
| Function Region (Settings → Functions) | **Frankfurt `fra1`** (même région que Neon, données UE/RGPD, latence minimale) |

Pourquoi ce Build Command : le package `@nourplay/db` est consommé via son `dist/` (`"main": "./dist/index.js"`) et le client Prisma est généré dans `packages/db/generated`. Le Dockerfile de l'API fait exactement ces trois étapes.

### 5.5 Équivalent en ligne de commande

```bash
# À la racine du dépôt : lie le dépôt et tous ses projets
vercel link --repo

# Ou projet par projet
cd apps/web   && vercel link   # puis vercel --prod
cd apps/admin && vercel link
cd packages/api && vercel link
```
Les réglages (Root Directory, Build Command…) se saisissent ensuite dans **Project → Settings → Build and Deployment**.

---

## 6. Neon PostgreSQL 16 depuis Vercel

### 6.1 Création de la base

1. Dashboard Vercel (team) → onglet **Storage** → **Create Database** (ou <https://vercel.com/marketplace/neon> → **Install**).
2. Choisissez **Neon** puis le mode **Create New Neon Account** (facturation via Vercel) → **Continue**.
3. **Configuration and Plan** :
   - **Region** : **Europe — Frankfurt (`eu-central-1`)** ;
   - **Auth / Realtime** : laissez désactivés (NourPlay a sa propre authentification) ;
   - **Plan** : *Free* pour démarrer, *Launch* en production (le plan Free met la base en veille ; premier appel plus lent) ;
   - **Database Name** : `nourplay-db` → **Create**.
4. Vous arrivez dans **Storage → nourplay-db** : statut, plan, chaîne de connexion. Le bouton **Open in Neon** ouvre la console Neon (organisation `Vercel: <team>`).

> PostgreSQL 16 : dans la console Neon, **Project → Settings → General** affiche la version ; en cas de besoin de changement, créez le projet avec la version 16 (Neon → *New project*) puis utilisez le mode **Link Existing Neon Account** du Marketplace.

### 6.2 Connecter la base aux projets

Seule **l'API** parle à la base (web/admin appellent l'API en HTTP).

1. **Storage → nourplay-db → Projects → Connect Project**.
2. Choisissez **`nourplay-api`** et cochez les environnements **Development, Preview, Production**.
3. **Create database branch for deployment** : cochez **Preview** (une branche Neon isolée par déploiement *preview*). **Laissez Production décoché.**
4. **Custom Prefix** : laissez vide. → **Connect**.

Variables injectées automatiquement dans `nourplay-api` (vérifiez dans **Settings → Environment Variables**) :

| Variable | Usage |
|---|---|
| `DATABASE_URL` | URL **poolée** (PgBouncer, hôte `-pooler`) → utilisée par l'API au runtime |
| `DATABASE_URL_UNPOOLED` | URL **directe** à fournir temporairement sous `DATABASE_URL` pour les migrations (§ 4.1) |
| `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `POSTGRES_*` | variantes, non utilisées par NourPlay |

Pour une **production branch** précise : console Neon → **Integrations → Vercel → Settings → Production branch**, puis redéployez la prod.

Réglage utile : si vous voyez des erreurs de type *prepared statement … does not exist* avec le pooler, ajoutez `pgbouncer=true` à l'URL poolée (créez alors votre propre variable `DATABASE_URL` dans le projet en vous basant sur la valeur Neon).

### 6.3 Récupérer les variables en local (pour migrer)

```bash
cd packages/api
vercel env pull ../../.env.production.local --environment=production
```

---

## 7. Redis (obligatoire) via le Marketplace Vercel

L'API refuse de démarrer sans `REDIS_URL` (jetons de vérification email, cache, files BullMQ).

1. **Storage → Create Database → Upstash (Redis)** → région **EU (Frankfurt)** → nom `nourplay-redis` → **Create**.
2. **Connect Project** → `nourplay-api` (Development, Preview, Production).
3. Vérifiez dans **Settings → Environment Variables** que `REDIS_URL` (`rediss://…`) existe. Sinon, créez-la à la main depuis l'onglet **Details** d'Upstash (champ *TCP / ioredis*).
4. Politique d'éviction : **`noeviction`** (obligatoire pour BullMQ) — Upstash → base → *Configuration*.

> NourPlay utilise `ioredis`/`bullmq` (protocole TCP) : il faut `REDIS_URL`, **pas** les variables `KV_REST_API_*`. Le worker (§ 12) interroge la file en continu : sur Upstash facturé à la requête, privilégiez un **plan à prix fixe**.

---

## 8. Variables d'environnement projet par projet

**Où :** *Project → Settings → Environment Variables → Add Environment Variable* → Key / Value / cases **Production**, **Preview**, **Development** → **Save**. Pour les secrets, activez **Sensitive**. Pour des valeurs communes à plusieurs projets : *Team → Settings → Environment Variables* (**Shared Environment Variables**) puis **Link** dans chaque projet.

Ou en CLI :
```bash
cd packages/api
vercel env add JWT_ACCESS_SECRET production     # saisie interactive de la valeur
vercel env ls
```

> ⚠️ `NEXT_PUBLIC_*` sont **figées au build** : après modification, faites **Deployments → ⋯ → Redeploy** en **décochant « Use existing Build Cache »**.

### 8.1 `nourplay-api`

| Variable | Valeur | Source |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | — | **auto** (Neon, § 6) |
| `REDIS_URL` | — | **auto** (Upstash, § 7) |
| `NODE_ENV` | `production` | défini par Vercel en production |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` | 3 secrets distincts ≥ 32 car. | manuel |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `900` / `604800` | manuel |
| `BCRYPT_ROUNDS` | `12` | manuel |
| `TOTP_ISSUER` / `TOTP_APP_NAME` | `NourPlay` | manuel |
| `APP_URL` | `https://domaine.com` | manuel |
| `API_URL` / `ADMIN_URL` | `https://nour-play.app` / `https://nour-play.app/admin` | manuel |
| `CORS_ORIGINS` | `https://nour-play.app,https://www.nour-play.app` | origines sans chemin |
| `CRON_SECRET` | `openssl rand -hex 32` | manuel (§ 4.3) |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` | `resend` / `re_…` / `NourPlay <noreply@domaine.com>` | § 11 |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL` | R2/S3 | § 11 |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | `sk_live_…`, `pk_live_…`, `whsec_…` | § 11 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | clés générées, `mailto:security@domaine.com` | manuel |
| `YOUTUBE_API_KEY`, `VIMEO_ACCESS_TOKEN` | optionnels | manuel |
| `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | optionnels (callback : `https://nour-play.app/api/v1/auth/google/callback`) | manuel |
| `OPENAI_API_KEY` | **pas ici** : uniquement sur le worker (§ 12) | — |

### 8.2 `nourplay-web`

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://nour-play.app/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `https://domaine.com` |
| `API_PROXY_ORIGIN` | Origine HTTPS stable du projet API sans chemin ni slash final |
| `ADMIN_PROXY_ORIGIN` | Origine HTTPS stable du projet admin sans chemin ni slash final |
| `NEXT_PUBLIC_WS_URL` | À configurer seulement après adaptation et tests de la watch-party (§ 12) |
| `NEXT_PUBLIC_S3_PUBLIC_URL` | `https://assets.domaine.com` (affichage des avatars) |

### 8.3 `nourplay-admin`

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://nour-play.app/api/v1` |
| `ADMIN_BASE_PATH` | `/admin` (au build et à l'exécution) |

Pour tester directement l'Admin sur son domaine Preview Vercel, configurez
uniquement pour ce Preview `API_PROXY_ORIGIN` avec l'origine de l'API Preview
(sans chemin ni slash final), et `NEXT_PUBLIC_API_URL` avec `/api/v1`.
Redéployez ensuite l'Admin : les requêtes et le cookie de renouvellement
passent par son origine, sans dépendre des cookies intersites. L'API Preview
doit être accessible au serveur Vercel qui exécute le proxy. Sans
`API_PROXY_ORIGIN`, aucun rewrite Admin n'est activé ; la configuration
Production existante reste inchangée.

Les deux origines de proxy doivent être configurées ensemble au build du web.
Utilisez des origines de preview isolées pour les previews, vérifiez leur
protection Vercel et redéployez après modification. Détails et vérifications :
[guide pas à pas § 3 et 5](./GUIDE_DEPLOIEMENT_PAS_A_PAS.md).

### 8.4 Valeurs en dur à remplacer par votre domaine

| Fichier | Contenu actuel |
|---|---|
| `apps/web/next.config.mjs`, `apps/admin/next.config.mjs` | `images.remotePatterns` → `assets.nourplay.app` |
| `packages/api/src/common/email/email.service.ts` | logo `https://nour-play.app/logo.png` : vérifier que cette ressource existe |
| `apps/mobile/src/components/VideoPlayer.tsx` | `EXPO_PUBLIC_APP_URL` par défaut `https://nour-play.app` |

---

## 9. Nom de domaine et routage par chemins

Domaine acheté chez Vercel ⇒ ses **nameservers sont déjà ceux de Vercel** et le **DNS est géré par Vercel** : aucun enregistrement à créer à la main pour les projets, ni certificat SSL à configurer (Let's Encrypt automatique).

### 9.1 Vérifier que le domaine est dans la bonne team

Dashboard → team → onglet **Domains** → `domaine.com` doit apparaître. Sinon : **⋯ → Move to Team** (le domaine et les projets doivent être dans la même team).

### 9.2 Attacher le domaine au web

Dans **Project → Settings → Domains**, associez `nour-play.app` et
éventuellement `www.nour-play.app` au seul projet web, avec redirection de
`www` vers le domaine principal. Les projets admin et API gardent leurs alias
techniques ; configurez-les dans les variables de proxy du § 8. Le web
transmet les chemins `/admin/*` et `/api/*` sans les supprimer.

CLI équivalent :
```bash
cd apps/web
vercel domains add nour-play.app
vercel domains add www.nour-play.app
vercel domains inspect nour-play.app
```

### 9.3 Enregistrements DNS supplémentaires (email, assets, WebSocket)

**Team → Domains → `domaine.com` → DNS Records → Add** :

| Type | Name | Value | Usage |
|---|---|---|---|
| (valeurs fournies par Resend) | `resend._domainkey`, `send`… | voir § 11 | DKIM / SPF / retour |
| `TXT` | `_dmarc` | `v=DMARC1; p=reject; rua=mailto:dmarc@domaine.com` | DMARC |
| `CNAME` | `assets` | cible fournie par Cloudflare R2 *Custom Domain* (ou domaine public R2) | avatars (optionnel) |

Les enregistrements `A`/`CNAME` créés **automatiquement** par Vercel pour vos projets apparaissent aussi dans cette liste : ne les supprimez pas.

### 9.4 Protection des déploiements

Les protections Vercel des origines techniques peuvent bloquer le proxy,
notamment en preview. Vérifiez-les explicitement sans exposer de secret de
bypass ; une origine accessible directement ne bénéficie pas nécessairement
des règles de protection du domaine web. Protégez aussi l'admin avec les
contrôles adaptés sur les deux points d'entrée.

### 9.5 Vérification

```bash
nslookup nour-play.app
curl -I https://nour-play.app
curl -i https://nour-play.app/admin/login
curl -i https://nour-play.app/api/v1/subscriptions/plans
```

---

## 10. Migrations et premier compte admin

**Les migrations ne sont pas exécutées automatiquement.** Lancez-les depuis votre poste, avec l'URL **directe** de Neon (production) :

```bash
cd packages/api
vercel env pull ../../.env.production.local --environment=production
cd ../..

# Linux / macOS / Git Bash
set -a && source .env.production.local && set +a
pnpm --filter @nourplay/db generate
DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm --filter @nourplay/db migrate:deploy
```

PowerShell :
```powershell
Get-Content .env.production.local | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim('"'), 'Process') }
}
pnpm --filter @nourplay/db generate
$pooledDatabaseUrl = $env:DATABASE_URL
try {
  $env:DATABASE_URL = $env:DATABASE_URL_UNPOOLED
  pnpm --filter @nourplay/db migrate:deploy
} finally {
  $env:DATABASE_URL = $pooledDatabaseUrl
}
```

Résultat attendu : `All migrations have been successfully applied.` Supprimez ensuite `.env.production.local` (jamais commité : ajoutez-le à `.gitignore`).

> Pour appliquer aussi les migrations sur les branches Neon des **previews**, mettez dans le Build Command du projet API : `cd ../.. && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db migrate:deploy && pnpm --filter @nourplay/db build && pnpm --filter @nourplay/api build`. En production, préférez la commande manuelle ci-dessus (contrôle avant chaque migration).

### Créer le premier administrateur

1. Inscrivez-vous sur `https://domaine.com` et validez l'email.
2. **Neon Console → SQL Editor** (Storage → *Open in Neon*) :
   ```sql
   UPDATE users SET role = 'ADMIN' WHERE email = 'vous@exemple.com';
   ```
   Rôles possibles : `PARENT`, `TEACHER`, `MODERATOR`, `ADMIN`.
3. Connectez-vous sur `https://nour-play.app/admin`.

---

## 11. Services tiers (Resend, Stripe, R2, OpenAI…)

Le détail pas à pas (créations de comptes, clés) est dans [DEPLOYMENT_GUIDE.md § 10](./DEPLOYMENT_GUIDE.md). Spécificités liées à Vercel :

- **Resend** : <https://resend.com/domains> → **Add Domain** `domaine.com` → copiez chaque enregistrement affiché dans **Vercel → Domains → DNS Records → Add** (§ 9.3) → **Verify**. Puis `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` sur `nourplay-api`. Sans `EMAIL_PROVIDER=resend`, l'API tourne en mode `console` (aucun email envoyé).
- **Stripe** : Developers → Webhooks → endpoint `https://nour-play.app/api/v1/subscriptions/webhook` (⚠️ `subscriptions` au pluriel) ; événements `customer.subscription.created|updated|deleted`, `invoice.payment_succeeded|payment_failed` ; copiez le `whsec_…` dans `STRIPE_WEBHOOK_SECRET`, puis **Redeploy** l'API. Testez avec **Send test webhook** (attendu : `200`).
- **Stockage avatars/exports** : le code utilise une API S3 ⇒ **Cloudflare R2** (bucket + clés `S3_*`). Vercel Blob n'est pas compatible sans modification du code. Le domaine `assets.domaine.com` se rattache soit à R2 (Custom Domain, nécessite que la zone soit sur Cloudflare), soit utilisez l'URL publique `r2.dev` dans `S3_PUBLIC_URL`/`NEXT_PUBLIC_S3_PUBLIC_URL` pour démarrer.
- **OpenAI / YouTube / Vimeo** : voir DEPLOYMENT_GUIDE ; `OPENAI_API_KEY` va sur le **worker**, pas sur Vercel.

---

## 12. Ce qui doit tourner hors Vercel : worker IA et watch-party

### 12.1 Worker `video-validator` (indispensable pour la validation IA)

Sans lui, les vidéos restent en attente (revue humaine uniquement). Hébergement conseillé : **Railway** (~5 $/mois).

1. <https://railway.app> → **New Project → Deploy from GitHub repo** → `bouaziziw/nourplay`.
2. Service → **Settings** :
   - **Build** : *Dockerfile Path* = `workers/video-validator/Dockerfile` (contexte = racine du dépôt) ;
   - pas de domaine public.
3. **Variables** :
   ```ini
   NODE_ENV=production
   DATABASE_URL=<URL Neon directe ou poolée : Vercel → Storage → nourplay-db → copier, ou console Neon → Connect>
   REDIS_URL=<même REDIS_URL que l'API>
   OPENAI_API_KEY=sk-...
   AI_MODERATION_MODEL=gpt-4o-mini
   OPENAI_TIMEOUT_MS=45000
   ```
4. **Deploy**, puis vérifiez dans **Logs** que le worker démarre sans erreur Redis/DB.

### 12.2 Watch-party (Socket.IO)

Le proxy HTTP actuel ne route pas `/socket.io`. L'état des salles est local à
chaque instance et la reconnexion doit être adaptée. Suivez et testez toutes
les étapes du [guide pas à pas § 9](./GUIDE_DEPLOIEMENT_PAS_A_PAS.md) avant
de présenter cette fonctionnalité comme disponible.

---

## 13. Application mobile `apps/mobile`

### 13.1 Peut-on l'héberger sur Vercel ?

**Non, pas en tant qu'application mobile.** `apps/mobile` est une application **Expo / React Native** (Expo 58, RN 0.88) : le livrable est un binaire **iOS (.ipa)** / **Android (.aab/.apk)** distribué via l'App Store, Google Play ou un lien interne, pas un site. Vercel n'héberge que du web et des fonctions serveur.

Techniquement, `expo export --platform web` produirait un site statique déployable sur Vercel (`react-native-web` et `react-dom` sont déjà dans les dépendances), **mais l'app mobile actuelle ne fonctionnera pas correctement dans un navigateur sans adaptations** :

| Élément | Problème sur le web |
|---|---|
| `react-native-webview` (`VideoPlayer.tsx`, cœur de l'app) | pas de support web : il faudrait un `<iframe>` |
| `expo-secure-store` (`hooks/useAuth.ts`, stockage du token) | non disponible sur le web : à remplacer par `localStorage`/AsyncStorage |
| `expo-notifications` (push) | comportement différent sur le web |
| `app.json` | pas de `web.bundler: "metro"` / `output: "single"` configuré |

### 13.2 Recommandation

1. **Version « web/PWA » : c'est déjà `apps/web`.** Elle est installable sur téléphone (`next-pwa`, manifeste, hors-ligne) et hébergée sur `domaine.com` — rien de plus à faire. Sur le téléphone : ouvrir `https://domaine.com` → **Ajouter à l'écran d'accueil** (Safari : bouton Partager ; Chrome : menu ⋮ → *Installer l'application*).
2. **Applications natives : Expo Application Services (EAS).**
   ```bash
   npm install -g eas-cli
   cd apps/mobile
   eas login
   eas init
   ```
   Créez `apps/mobile/eas.json` (absent du dépôt) :
   ```json
   {
     "cli": { "version": ">= 12.0.0" },
     "build": {
       "preview": {
         "distribution": "internal",
         "env": { "EXPO_PUBLIC_API_URL": "https://nour-play.app/api/v1" }
       },
       "production": {
         "channel": "production",
         "autoIncrement": true,
         "env": {
           "EXPO_PUBLIC_API_URL": "https://nour-play.app/api/v1",
           "EXPO_PUBLIC_APP_URL": "https://domaine.com",
           "EXPO_PUBLIC_S3_PUBLIC_URL": "https://assets.domaine.com"
         }
       }
     },
     "submit": { "production": {} }
   }
   ```
   ```bash
   eas build --platform android --profile preview      # APK de test (lien/QR à partager)
   eas build --platform all --profile production       # AAB + IPA
   eas submit --platform android                       # Google Play (compte 25 $, clé de service JSON)
   eas submit --platform ios                           # App Store (compte Apple Developer 99 $/an)
   ```
   Suivi : <https://expo.dev> → projet → **Builds**. Mises à jour sans passer par les stores : `eas update --channel production`.
3. **Option expérimentale — web Expo sur Vercel** (démo/preview uniquement, après avoir corrigé WebView et SecureStore pour `Platform.OS === 'web'`) :
   - ajouter dans `app.json` : `"web": { "bundler": "metro", "output": "single" }` ;
   - nouveau projet Vercel : *Framework* **Other**, *Root Directory* `apps/mobile`, *Install* `cd ../.. && pnpm install --frozen-lockfile`, *Build* `npx expo export --platform web`, *Output Directory* `dist` ;
   - domaine `m.domaine.com`.
   
   Non recommandé : cela duplique `apps/web`.

---

## 14. Déploiements, CI et rollback

- **Déploiement continu natif** : chaque `git push` sur `main` déploie les 3 projets en **Production** ; chaque branche/PR crée une **Preview** (avec sa branche Neon). Aucun workflow à écrire.
- **`.github/workflows/deploy.yml`** (SSH + Docker + GHCR) cible le **VPS** : il **ne sert plus** dans cette architecture et son test `curl /api/health` échouerait. Désactivez-le : GitHub → **Actions → Deploy → ⋯ → Disable workflow**. Gardez `ci.yml` et `e2e.yml` (lint, tests, Playwright).
- Pour que Vercel attende la CI : GitHub → *Settings → Branches → Branch protection rule* sur `main` → *Require status checks* (`CI`).
- **Rollback instantané** : Vercel → projet → **Deployments** → déploiement précédent → **⋯ → Promote to Production** (ou `vercel rollback`). Les migrations Prisma ne sont pas annulées : écrivez-les rétro-compatibles.
- **Logs** : projet → **Logs** (Runtime Logs) ; **Observability** pour durées/erreurs ; **Cron Jobs** : *Project → Settings → Cron Jobs* (exécution manuelle et historique).
- **Alerte disponibilité** : surveillez `https://nour-play.app`, `https://nour-play.app/api/v1/subscriptions/plans` et `https://nour-play.app/admin/login`.

---

## 15. Checklist finale

- [ ] Plan Vercel adapté ; domaine et projets dans la **même team**.
- [ ] Code cron, routage web et `basePath` admin mergés.
- [ ] 3 projets créés : Root Directory + Install/Build Commands corrects ; Function Region API = `fra1`.
- [ ] Neon (Frankfurt, PG 16) connecté à `nourplay-api` ; `DATABASE_URL` et `DATABASE_URL_UNPOOLED` présents.
- [ ] Redis connecté ; `REDIS_URL` présent ; éviction `noeviction`.
- [ ] Variables du § 8 renseignées ; `CORS_ORIGINS` contient les origines HTTPS sans chemins ; `CRON_SECRET` défini.
- [ ] `migrate:deploy` exécuté ; **seed non exécuté** ; compte `ADMIN` créé.
- [ ] Domaine web et éventuellement `www` en *Valid Configuration* ; HTTPS et rewrites vérifiés.
- [ ] Resend vérifié (SPF/DKIM/DMARC) ; webhook Stripe Live répond `200`.
- [ ] Worker `video-validator` déployé (Railway) ; watch-party déployé ou désactivé.
- [ ] Les quatre tâches cron-job.org sont configurées ; appel d'une route cron → `200` avec le secret, `401` sans.
- [ ] Tests : inscription + email, connexion/refresh (cookie), PIN parent, ajout vidéo → validation, paiement Stripe, upload d'avatar.
- [ ] `deploy.yml` désactivé ; monitoring d'uptime en place.
- [ ] Valeurs en dur `nourplay.app` remplacées (§ 8.4).

---

## 16. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Build API : `Cannot find module '@nourplay/db'` / client Prisma introuvable | `db` non généré/compilé | Build Command du § 5.4 (generate + build de `@nourplay/db` avant l'API) |
| Build web : `workspace:*` / `@nourplay/ui` introuvable | *Include source files outside Root Directory* désactivé, ou Install Command lancé depuis le sous-dossier | Réactiver l'option ; Install Command `cd ../.. && pnpm install --frozen-lockfile` |
| Runtime API : `Query engine library … not found` | moteur Prisma non embarqué dans la Function | `binaryTargets = ["native","rhel-openssl-3.0.x"]` (§ 4.1) puis redeploy sans cache |
| Runtime : erreur `argon2` / binaire natif | binaire non tracé | redeploy sans cache ; vérifier Node 22.x ; ouvrir *Runtime Logs* pour le chemin manquant |
| `Configuration validation error` au démarrage | variable obligatoire manquante | `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` doivent exister dans le bon environnement (Production **et** Preview) |
| `P1001` / timeouts base | base Neon en veille (plan Free), mauvaise région | réessayer ; mettre la Function Region sur `fra1` ; passer en plan payant |
| `prepared statement … does not exist` | pooler PgBouncer | ajouter `pgbouncer=true` à l'URL poolée (§ 6.2) |
| `Environment variable not found: DATABASE_URL_UNPOOLED` | `directUrl` activé mais variable absente (CI/Docker) | définir `DATABASE_URL_UNPOOLED` = `DATABASE_URL` dans ces environnements |
| Erreurs CORS | origine absente de `CORS_ORIGINS` | ajouter les origines `https://nour-play.app` et, si nécessaire, `https://www.nour-play.app` ; redeploy |
| Connexion OK mais déconnecté au rafraîchissement | mauvais domaine ou cookie non transmis | vérifier le proxy, `Set-Cookie` et le chemin `/api/v1/auth` sur `nour-play.app` |
| Le front appelle `localhost:4000` | `NEXT_PUBLIC_API_URL` absent au build | définir puis redeploy **sans cache** |
| Les playlists planifiées ne se publient pas | cron non configuré | configurer cron-job.org et `CRON_SECRET` selon le guide pas à pas |
| Cron `401` | `CRON_SECRET` manquant dans le projet API | l'ajouter (Production) et redéployer |
| Webhook Stripe 400 « Signature webhook invalide » | mauvais `whsec_` (test vs live) | utiliser le secret de l'endpoint Live |
| Preview inaccessible (page de login Vercel) | *Deployment Protection* | normal ; se connecter à Vercel ou désactiver pour les previews |
| Vidéos jamais validées | worker absent | § 12.1 |
| Watch-party ne se connecte pas | Socket.IO non supporté sur Vercel | § 12.2 |
| Avertissement « vulnerable Next.js version » au déploiement | Next 14.2.13 ancien | mettre à jour vers la dernière 14.2.x : `pnpm --filter @nourplay/web up next@^14.2 && pnpm --filter @nourplay/admin up next@^14.2` |

> Si le build « zero config » NestJS de Vercel ne convient pas malgré ces réglages, repli possible : fournir un point d'entrée serverless explicite `packages/api/api/index.ts` qui crée l'application Nest (sans `listen`) et exporte le handler Express, avec un `rewrites` `/(.*) → /api` dans `vercel.json`. Cela impose de retirer `app.listen()` de ce point d'entrée ; je peux le préparer si besoin.

# Guide de déploiement pas à pas — NourPlay

> **Architecture actuelle :** utilisez en priorité le
> [guide Vercel pas à pas](./GUIDE_DEPLOIEMENT_PAS_A_PAS.md). Le domaine
> public appartient au projet web, qui transmet `/admin` et `/api` aux
> origines techniques. Les exemples VPS ci-dessous nécessitent un service
> admin supplémentaire ; le compose fourni n'en crée pas.

> Ce guide est dérivé de [SETUP_AND_DEPLOY.md](./SETUP_AND_DEPLOY.md) **et vérifié contre le code du dépôt**
> (`package.json`, Dockerfiles, `docker-compose.prod.yml`, workflows GitHub Actions, `main.ts` de l'API).
> Les écarts trouvés entre la doc d'origine et le code sont signalés par ⚠️ et récapitulés en [§ 15](#15-écarts-détectés-entre-la-doc-dorigine-et-le-dépôt).

---

## Sommaire

0. [Vue d'ensemble et ordre de déploiement](#0-vue-densemble-et-ordre-de-déploiement)
1. [Prérequis communs](#1-prérequis-communs)
2. [Variables d'environnement par composant](#2-variables-denvironnement-par-composant)
3. [Partie 1 — Base de données PostgreSQL](#3-partie-1--base-de-données-postgresql)
4. [Partie 2 — Redis (cache + files BullMQ)](#4-partie-2--redis-cache--files-bullmq)
5. [Partie 3 — Migrations Prisma](#5-partie-3--migrations-prisma)
6. [Partie 4 — Backend API (NestJS)](#6-partie-4--backend-api-nestjs)
7. [Partie 5 — Worker de validation vidéo (BullMQ)](#7-partie-5--worker-de-validation-vidéo-bullmq)
8. [Partie 6 — Frontend Web (Next.js)](#8-partie-6--frontend-web-nextjs)
9. [Partie 7 — Back-office Admin (Next.js)](#9-partie-7--back-office-admin-nextjs)
10. [Partie 8 — Services tiers](#10-partie-8--services-tiers-r2-resend-openai-stripe-vapid-youtube)
11. [Partie 9 — Application mobile (Expo / EAS)](#11-partie-9--application-mobile-expo--eas)
12. [Partie 10 — DNS et Cloudflare](#12-partie-10--dns-et-cloudflare)
13. [Option B — Tout sur un VPS (Docker Compose + Caddy)](#13-option-b--tout-sur-un-vps-docker-compose--caddy)
14. [CI/CD GitHub Actions](#14-cicd-github-actions)
15. [Écarts détectés entre la doc d'origine et le dépôt](#15-écarts-détectés-entre-la-doc-dorigine-et-le-dépôt)
16. [Monitoring, sauvegardes, checklist Go-Live](#16-monitoring-sauvegardes-checklist-go-live)
17. [Dépannage](#17-dépannage)

---

## 0. Vue d'ensemble et ordre de déploiement

| # | Composant | Dossier | Techno | Port | Option A (cloud managé) | Option B (VPS) |
|---|---|---|---|---|---|---|
| 1 | Base de données | `packages/db` | PostgreSQL 16 + Prisma 5 | 5432 | Neon / Supabase | conteneur `postgres` |
| 2 | Cache / files | — | Redis 7 | 6379 | Upstash / Redis Cloud | conteneur `redis` |
| 3 | Migrations | `packages/db` | `prisma migrate deploy` | — | commande manuelle / CI | conteneur `migrate` |
| 4 | API | `packages/api` | NestJS 10 (`/api/v1`) | 4000 | Render / Railway | conteneur `api` |
| 5 | Worker IA | `workers/video-validator` | BullMQ + OpenAI | — | Render *Background Worker* / Railway | conteneur `video-validator` |
| 6 | Web | `apps/web` | Next.js 14 (`output: standalone`) | 3000 | Vercel | conteneur `web` |
| 7 | Admin | `apps/admin` | Next.js 14 | 3001 | Vercel | ⚠️ pas d'image Docker (voir § 9) |
| 8 | Stockage | — | S3 compatible | — | Cloudflare R2 | R2 / S3 |
| 9 | Mobile | `apps/mobile` | Expo 53 / RN 0.79 | — | EAS Build + stores | idem |

**Ordre à respecter** (chaque étape dépend de la précédente) :

1. Domaine + DNS → 2. PostgreSQL → 3. Redis → 4. Migrations → 5. API → 6. Worker → 7. Web → 8. Admin → 9. Services tiers (R2, Resend, Stripe…) → 10. Mobile → 11. Monitoring → 12. Checklist.

> Les URL de production (`NEXT_PUBLIC_API_URL`…) sont **figées dans le build** des fronts Next.js : déployez l'API (ou au moins connaissez son URL finale) **avant** de builder Web/Admin.

---

## 1. Prérequis communs

### 1.1 Comptes à créer

| Service | Usage | Obligatoire |
|---|---|:---:|
| GitHub | dépôt, CI/CD, GHCR | ✅ |
| Registrar de domaine (ou Cloudflare Registrar) | `nour-play.app` | ✅ |
| Cloudflare | DNS, WAF, R2 | ✅ |
| Neon **ou** Supabase | PostgreSQL | ✅ (option A) |
| Upstash **ou** Redis Cloud | Redis | ✅ (option A) |
| Render **ou** Railway | API + worker | ✅ (option A) |
| Vercel | Web + Admin | ✅ (option A) |
| Resend | emails | ✅ |
| OpenAI | modération IA | optionnel (sans clé : revue humaine obligatoire) |
| Stripe | abonnements | optionnel |
| Expo (EAS) + Apple Developer (99 $/an) + Google Play Console (25 $) | mobile | optionnel |
| Hetzner / OVH / Scaleway | VPS | option B |

### 1.2 Outils locaux

```bash
node -v          # >= 20 (le code exige >=20.0.0 ; la doc d'origine parle de 20.12)
pnpm -v          # >= 9 (le dépôt fixe pnpm@9.15.0)
docker --version
git --version
openssl version
```

Installer pnpm exactement à la version du dépôt :
```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

### 1.3 Cloner le dépôt

```bash
git clone https://github.com/bouaziziw/nourplay.git
cd nourplay
pnpm install --frozen-lockfile
```

### 1.4 Générer les secrets de production

À faire **une fois**, stocker dans un gestionnaire de mots de passe (1Password, Bitwarden…). **Trois secrets différents** :

```bash
openssl rand -base64 32   # → JWT_ACCESS_SECRET
openssl rand -base64 32   # → JWT_REFRESH_SECRET
openssl rand -base64 32   # → COOKIE_SECRET
openssl rand -hex 24      # → mot de passe Postgres / Redis (hex = pas de caractères spéciaux à échapper dans une URL)
npx web-push generate-vapid-keys   # → VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

PowerShell (sans OpenSSL) :
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> ⚠️ **Ne jamais committer `.env`.** Ne jamais lancer `pnpm db:seed` en production : il crée des comptes de test (`admin@nourplay.local` / `Admin1234!`…).

---

## 2. Variables d'environnement par composant

Source de vérité : `.env.example` + `packages/api/src/config/app.config.ts`. Légende : **A** = API, **W** = Worker, **Web**, **Adm** = Admin, **M** = Mobile, **Mig** = migrations.

| Variable | A | W | Web | Adm | Mig | Valeur production |
|---|:-:|:-:|:-:|:-:|:-:|---|
| `NODE_ENV` | ✅ | ✅ | | | | `production` (désactive Swagger et active les cookies `secure`) |
| `PORT` | ✅ | | | | | `4000` (souvent injecté par la plateforme) |
| `APP_URL` | ✅ | | | | | `https://nour-play.app` |
| `API_URL`, `ADMIN_URL` | ✅ | | | | | `https://nour-play.app`, `https://nour-play.app/admin` |
| `CORS_ORIGINS` | ✅ | | | | | `https://nour-play.app,https://www.nour-play.app` (origines sans chemin) |
| `DATABASE_URL` | ✅ | ✅ | | | ✅ | URL PostgreSQL (`?sslmode=require` chez un provider managé) |
| `REDIS_URL` | ✅ | ✅ | | | | `rediss://default:PWD@HOST:PORT` (TLS) ou `redis://:PWD@redis:6379` (VPS) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` | ✅ | | | | | 3 secrets distincts ≥ 32 car. |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | ✅ | | | | | `900` / `604800` |
| `BCRYPT_ROUNDS` | ✅ | | | | | `12` |
| `TOTP_ISSUER`, `TOTP_APP_NAME` | ✅ | | | | | `NourPlay` |
| `RATE_LIMIT_TTL`, `RATE_LIMIT_MAX` | ✅ | | | | | valeurs de `.env.example` |
| `EMAIL_PROVIDER` | ✅ | | | | | `resend` (défaut du code : `console`, qui n'envoie rien) |
| `RESEND_API_KEY`, `EMAIL_FROM` | ✅ | | | | | `re_…`, `NourPlay <noreply@nour-play.app>` |
| `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | ✅ | | | | | optionnel (OAuth Google) |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL` | ✅ | | | | | R2/S3 (avatars, exports RGPD) |
| `YOUTUBE_API_KEY`, `VIMEO_ACCESS_TOKEN` | ✅ | | | | | optionnels (import playlists) |
| `OPENAI_API_KEY`, `AI_MODERATION_MODEL`, `OPENAI_TIMEOUT_MS` | | ✅ | | | | `sk-…`, `gpt-4o-mini`, `45000` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | ✅ | | | | | ⚠️ `STRIPE_PUBLISHABLE_KEY` est lue par le code mais absente de la doc d'origine |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | ✅ | | | | | clés générées en § 1.4 |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_SERVICE_NAME` | ✅ | | | | | optionnels |
| `NEXT_PUBLIC_API_URL` | | | ✅ | ✅ | | `https://nour-play.app/api/v1` (**build-time**) |
| `NEXT_PUBLIC_WS_URL` | | | ✅ | | | À configurer après adaptation et tests de la watch-party |
| `NEXT_PUBLIC_S3_PUBLIC_URL` | | | ✅ | | | `https://assets.nour-play.app` (affichage des avatars ; ⚠️ absent de la doc d'origine) |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_S3_PUBLIC_URL` | | | | | | Mobile, voir § 11 |
| `POSTGRES_USER/PASSWORD/DB`, `REDIS_PASSWORD` | | | | | | **VPS uniquement** (lus par `docker-compose.prod.yml`) |

> Règle d'or : toute variable `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` est **embarquée dans le bundle au build**. La modifier impose un **nouveau build**, pas seulement un redémarrage.

---

## 3. Partie 1 — Base de données PostgreSQL

### Option A1 : Neon (recommandé pour démarrer, simple)

1. Allez sur <https://console.neon.tech> → **Sign up** → **Create project**.
2. Renseignez : *Name* `nourplay-prod`, *Postgres version* **16**, *Region* **AWS Europe (Frankfurt) `eu-central-1`** (données UE / RGPD).
3. Sur le tableau de bord du projet, cliquez **Connect** :
   - **Pooled connection** (toggle *Connection pooling* activé, hôte contenant `-pooler`) → pour l'API/worker.
   - **Direct connection** (toggle désactivé) → pour les migrations.
4. Copiez les chaînes et vérifiez qu'elles se terminent par `?sslmode=require`.

### Option A2 : Supabase

1. <https://supabase.com/dashboard> → **New project** → région **West EU (Paris)** ou **Frankfurt**, définissez un mot de passe fort.
2. **Project Settings → Database → Connection string** (onglet *URI*) :
   - *Session/Transaction pooler* (port `6543`, ajouter `?pgbouncer=true`) → API/worker.
   - *Direct connection* (port `5432`) → migrations.

### Variables

```ini
# API et worker (via pooler)
DATABASE_URL="postgresql://USER:<REDACTED_SECRET>@HOST-POOLER:6543/DBNAME?pgbouncer=true&sslmode=require"
```

> ⚠️ **Divergence avec la doc d'origine** : `packages/db/prisma/schema.prisma` ne déclare que `url = env("DATABASE_URL")` — **il n'y a pas de `directUrl`**, donc la variable `DIRECT_URL` mentionnée dans l'ancienne doc est **ignorée** par Prisma. Pour migrer, il faut simplement **exécuter la commande de migration avec `DATABASE_URL` pointant vers l'URL directe** (voir § 5).
> Alternative propre (modification de code) : ajouter `directUrl = env("DIRECT_URL")` dans le bloc `datasource db` du schéma.

### Option B : PostgreSQL en conteneur (VPS)

Rien à faire ici : le service `postgres` de `docker-compose.prod.yml` est démarré à l'étape [§ 13.4](#134-déployer-la-stack).

---

## 4. Partie 2 — Redis (cache + files BullMQ)

### Upstash

1. <https://console.upstash.com> → **Create Database** → *Type* **Redis**, *Name* `nourplay-prod`, *Region* **EU (Frankfurt / Ireland)**, activez **TLS/SSL**.
2. Dans l'onglet **Details**, copiez l'endpoint, le port et le mot de passe, puis construisez :
   ```ini
   REDIS_URL="rediss://default:<REDACTED_SECRET>@HOST:PORT"
   ```
3. **Eviction : `noeviction`** — obligatoire pour que BullMQ ne perde jamais de jobs.
   - Upstash : *Details → Eviction* (⚠️ Upstash n'évince pas par défaut ; vérifiez que l'option est désactivée).
   - Redis Cloud : *Database → Configuration → Data eviction policy* = `noeviction`.

### Redis Cloud (alternative)

<https://app.redislabs.com> → **New database** → *Essentials* → région Europe → copiez `Public endpoint` et le mot de passe → `REDIS_URL="rediss://default:PWD@HOST:PORT"` (selon le plan, le TLS peut être `redis://` — suivez l'indication du dashboard).

### Test de connexion

```bash
redis-cli -u "$REDIS_URL" ping    # → PONG
```

---

## 5. Partie 3 — Migrations Prisma

Les migrations s'exécutent **depuis votre poste ou la CI**, jamais au démarrage de l'API (sauf VPS où le conteneur `migrate` le fait).

```bash
# À la racine du dépôt
cp .env.example .env            # puis éditez .env : DATABASE_URL = URL DIRECTE (port 5432 / sans -pooler)

pnpm --filter @nourplay/db generate    # génère le client Prisma
pnpm db:migrate:prod                   # = dotenv -e .env -- pnpm --filter @nourplay/db migrate:deploy
```

Résultat attendu : `All migrations have been successfully applied.`

Sans fichier `.env` (par exemple en CI), en une ligne :

```bash
DATABASE_URL="postgresql://…direct…?sslmode=require" pnpm --filter @nourplay/db migrate:deploy
```

PowerShell :
```powershell
$env:DATABASE_URL = "postgresql://…direct…?sslmode=require"
pnpm --filter @nourplay/db migrate:deploy
```

### Créer le premier compte administrateur (sans seed)

1. Inscrivez-vous normalement via le site web (rôle `PARENT` par défaut) et validez l'email.
2. Promouvez le compte (enum `UserRole` : `PARENT`, `TEACHER`, `MODERATOR`, `ADMIN`) :
   ```sql
   UPDATE users SET role = 'ADMIN' WHERE email = 'vous@exemple.com';
   ```
   (via l'éditeur SQL Neon/Supabase, ou `pnpm db:studio` en pointant `DATABASE_URL` sur la prod, puis fermez-le).

---

## 6. Partie 4 — Backend API (NestJS)

Image/Build : `packages/api`. L'API expose `/api/v1/*` ; Swagger (`/api/docs`) est **désactivé en production** (`NODE_ENV=production`).

### 6.1 Render (Web Service)

1. <https://dashboard.render.com> → **New +** → **Web Service** → **Build and deploy from a Git repository** → autorisez GitHub et sélectionnez `bouaziziw/nourplay`.
2. Renseignez :
   | Champ | Valeur |
   |---|---|
   | Name | `nourplay-api` |
   | Region | **Frankfurt (EU Central)** |
   | Branch | `main` |
   | Root Directory | *(vide : racine du monorepo)* |
   | Runtime | **Node** |
   | Instance Type | Starter ou supérieur (le plan Free s'endort) |
3. **Build Command** :
   ```bash
   corepack enable && pnpm install --frozen-lockfile && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db build && pnpm --filter @nourplay/api build
   ```
   > ⚠️ `@nourplay/db build` est nécessaire (le Dockerfile de l'API le fait) : le package `db` est consommé via `dist/` (`"main": "./dist/index.js"`).
4. **Start Command** :
   ```bash
   pnpm --filter @nourplay/api start
   ```
   > ⚠️ Le script `start:prod` cité dans l'ancienne doc **n'existe pas** pour l'API : le script est `start` (= `node dist/main`).
5. **Health Check Path** : `/api/v1/subscriptions/plans` (route publique existante).
   > ⚠️ `/api/health` (ancienne doc, workflow `deploy.yml`, supervision) **n'existe pas** dans le code. Voir § 15 pour la correction recommandée.
6. **Advanced → Environment Variables** : ajoutez `NODE_VERSION=20` puis toutes les variables « API » du tableau du § 2 (utilisez *Add from .env* pour un copier-coller en bloc).
7. **Create Web Service**. Suivez les logs dans l'onglet **Logs** : cherchez `Nest application successfully started`.
8. Conservez l'origine technique Render pour `API_PROXY_ORIGIN` côté web ; ne lui associez pas le domaine public.

### 6.2 Railway (alternative)

1. <https://railway.app> → **New Project** → **Deploy from GitHub repo** → `bouaziziw/nourplay`.
2. Service → **Settings** : *Build Command* et *Start Command* comme ci-dessus ; **Networking → Generate Domain** pour obtenir l'origine technique du proxy.
3. Onglet **Variables → Raw Editor** : collez les variables API.

### 6.3 CLI Docker (build manuel de l'image)

```bash
docker build -f packages/api/Dockerfile -t nourplay-api .
docker run --rm -p 4000:4000 --env-file .env nourplay-api
curl -i http://localhost:4000/api/v1/subscriptions/plans
```

### 6.4 WebSocket (watch-party)

La passerelle Socket.IO utilise `/socket.io` et le namespace `/watch`. Le
rewrite web actuel ne transmet pas ce chemin. Son routage Upgrade et le
partage d'état doivent être adaptés et testés avant utilisation ; voir le
[guide pas à pas § 9](./GUIDE_DEPLOIEMENT_PAS_A_PAS.md).

---

## 7. Partie 5 — Worker de validation vidéo (BullMQ)

Il consomme la file Redis et appelle OpenAI. Variables utiles : `REDIS_URL`, `DATABASE_URL`, `OPENAI_API_KEY`, `AI_MODERATION_MODEL`, `OPENAI_TIMEOUT_MS`.

### Render (Background Worker)

1. **New +** → **Background Worker** → même dépôt, *Name* `nourplay-video-validator`, même région.
2. **Build Command** :
   ```bash
   corepack enable && pnpm install --frozen-lockfile && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db build && pnpm --filter @nourplay/video-validator build
   ```
3. **Start Command** :
   ```bash
   pnpm --filter @nourplay/video-validator start:prod
   ```
4. Variables : `NODE_VERSION=20`, `REDIS_URL`, `DATABASE_URL`, `OPENAI_API_KEY`, `AI_MODERATION_MODEL`, `OPENAI_TIMEOUT_MS`.

### Railway

Dans le même projet : **+ New → GitHub Repo** (même dépôt) → mêmes commandes build/start, **sans domaine public**.

> Sans `OPENAI_API_KEY`, aucune validation IA : toutes les vidéos passent en **revue humaine** (back-office Admin).

---

## 8. Partie 6 — Frontend Web (Next.js)

### 8.1 Vercel (monorepo)

1. <https://vercel.com/new> → **Import Git Repository** → `bouaziziw/nourplay` → **Import**.
2. **Configure Project** :
   | Champ | Valeur |
   |---|---|
   | Project Name | `nourplay-web` |
   | Framework Preset | **Next.js** |
   | Root Directory | `apps/web` (bouton **Edit**) |
   | Include source files outside of the Root Directory | **Activé** (Settings → General) — indispensable en monorepo pnpm |
   | Install Command | *Override* : `cd ../.. && pnpm install --frozen-lockfile` |
   | Build Command | *Override* : `cd ../.. && pnpm --filter @nourplay/web build` |
   | Output Directory | `.next` |
   | Node.js Version | **20.x** (Settings → General) |
3. **Environment Variables** (scope *Production*) :
   ```ini
   NEXT_PUBLIC_API_URL=https://nour-play.app/api/v1
   NEXT_PUBLIC_APP_URL=https://nour-play.app
   NEXT_PUBLIC_S3_PUBLIC_URL=https://assets.nour-play.app
   API_PROXY_ORIGIN=https://<origine-technique-api>
   ADMIN_PROXY_ORIGIN=https://<origine-technique-admin>
   ```
4. **Deploy**. Puis **Settings → Domains → Add** : `nour-play.app` et `www.nour-play.app` (Vercel affiche les enregistrements DNS à créer).
5. Chaque `git push` sur `main` redéploie ; chaque PR obtient une *Preview*.

CLI équivalent :
```bash
npm i -g vercel
vercel login
cd apps/web
vercel link
vercel env add NEXT_PUBLIC_API_URL production
vercel --prod
```

> Le fichier `next.config.mjs` active `output: 'standalone'` (utilisé par l'image Docker) ; Vercel l'ignore, pas de conflit. L'app est une PWA : après un changement de variable, faites un **redeploy sans cache** (*Deployments → ⋯ → Redeploy → décocher « Use existing Build Cache »*).

### 8.2 Docker (VPS ou autre hébergeur)

```bash
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://nour-play.app/api/v1 \
  -t nourplay-web .
docker run --rm -p 3000:3000 nourplay-web
```

> ⚠️ Le Dockerfile ne déclare qu'un seul `ARG` (`NEXT_PUBLIC_API_URL`). `NEXT_PUBLIC_WS_URL` et `NEXT_PUBLIC_S3_PUBLIC_URL` retombent sur leurs valeurs par défaut (`http://localhost:4000` / `undefined`) : pour le watch-party et les avatars en mode Docker, ajoutez-les en `ARG`/`ENV` dans `apps/web/Dockerfile` (stage *builder*) et en `args:` dans `docker-compose.prod.yml`.

---

## 9. Partie 7 — Back-office Admin (Next.js)

L'Admin n'a **ni Dockerfile ni service dans `docker-compose.prod.yml`** → déployez-le sur Vercel (même en option B).

1. <https://vercel.com/new> → importez **à nouveau** le même dépôt → *Project Name* `nourplay-admin`.
2. **Root Directory** : `apps/admin` ; *Framework* **Next.js** ; *Include source files outside root* **activé**.
3. **Install Command** : `cd ../.. && pnpm install --frozen-lockfile`
4. **Build Command** : `cd ../.. && pnpm --filter @nourplay/admin build`
5. **Environment Variables** :
   ```ini
   NEXT_PUBLIC_API_URL=https://nour-play.app/api/v1
   ADMIN_BASE_PATH=/admin
   ```
   (`NEXT_PUBLIC_ADMIN_URL` de l'ancienne doc n'est lue nulle part dans `apps/admin`.)
6. Gardez l'origine technique Vercel de l'admin et renseignez-la dans `ADMIN_PROXY_ORIGIN` du web.
7. `CORS_ORIGINS` contient `https://nour-play.app`, sans chemin.
8. Protégez `/admin` et l'origine admin directe ; une protection de l'origine peut aussi bloquer le proxy.

---

## 10. Partie 8 — Services tiers (R2, Resend, OpenAI, Stripe, VAPID, YouTube)

### 10.1 Cloudflare R2 (avatars + exports RGPD)

1. <https://dash.cloudflare.com> → **R2 Object Storage** → **Create bucket** → nom `nourplay-assets`, localisation **Europe (EEUR)**.
2. **Settings → CORS Policy → Add** :
   ```json
   [
     {
       "AllowedOrigins": ["https://nour-play.app"],
       "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. **Settings → Custom Domains → Connect Domain** → `assets.nour-play.app`.
4. **R2 → Manage API Tokens → Create API token** (*Object Read & Write*, restreint au bucket) → copiez *Access Key ID*, *Secret Access Key* et l'URL d'endpoint.
5. Variables API :
   ```ini
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_BUCKET=nourplay-assets
   S3_PUBLIC_URL=https://assets.nour-play.app
   ```
6. Créez un **second bucket privé** `nourplay-backups` (non exposé) pour les sauvegardes PostgreSQL.

### 10.2 Resend (emails)

1. <https://resend.com/domains> → **Add Domain** → `nour-play.app` (région **eu-west-1**).
2. Créez chez Cloudflare les enregistrements DNS affichés (DKIM `resend._domainkey`, SPF, MX de retour). Ajoutez DMARC :
   ```
   _dmarc  TXT  v=DMARC1; p=reject; rua=mailto:dmarc@nour-play.app
   ```
   > ⚠️ Un seul enregistrement SPF par domaine : copiez la valeur **exacte** donnée par Resend (la valeur `include:amazonses.com` de l'ancienne doc peut différer).
3. Cliquez **Verify DNS Records** jusqu'à *Verified*.
4. **API Keys → Create API Key** (*Sending access*) → variables :
   ```ini
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxx
   EMAIL_FROM=NourPlay <noreply@nour-play.app>
   ```

### 10.3 OpenAI

1. <https://platform.openai.com> → **Settings → Billing** → ajoutez un moyen de paiement et **Usage limits** (limite mensuelle dure).
2. **API keys → Create new secret key** → `OPENAI_API_KEY` (uniquement sur le **worker**).
3. `AI_MODERATION_MODEL=gpt-4o-mini`, `OPENAI_TIMEOUT_MS=45000`.

### 10.4 YouTube / Vimeo

- YouTube : <https://console.cloud.google.com> → nouveau projet → **APIs & Services → Library → YouTube Data API v3 → Enable** → **Credentials → Create credentials → API key** (restreignez à l'API YouTube Data v3 et à l'IP de l'API) → `YOUTUBE_API_KEY`. Quota par défaut : 10 000 unités/jour ; demandez une extension si besoin.
- Vimeo : <https://developer.vimeo.com/apps> → *Create an app* → *Generate access token* → `VIMEO_ACCESS_TOKEN`.

### 10.5 Stripe (abonnements)

1. <https://dashboard.stripe.com> → basculez en **mode Live** (après activation du compte).
2. **Product catalog → Add product** : créez *Pass Famille*, *Pass Établissement Scolaire* avec un prix récurrent.
3. **Developers → API keys** : `STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_PUBLISHABLE_KEY=pk_live_…`.
4. **Developers → Webhooks → Add endpoint** :
   - URL : `https://nour-play.app/api/v1/subscriptions/webhook`
     > ⚠️ **`subscriptions` au pluriel** (la doc d'origine indiquait `subscription`, ce qui renverrait un 404).
   - Événements : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
5. Ouvrez l'endpoint → **Signing secret → Reveal** → `STRIPE_WEBHOOK_SECRET=whsec_…`.
6. Redéployez l'API, puis **Send test webhook** depuis Stripe et vérifiez un `200`.
7. Test local : `stripe listen --forward-to localhost:4000/api/v1/subscriptions/webhook`.

### 10.6 Notifications Web Push (VAPID)

```bash
npx web-push generate-vapid-keys
```
```ini
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:security@nour-play.app
```

### 10.7 Google OAuth (optionnel)

<https://console.cloud.google.com/apis/credentials> → **Create credentials → OAuth client ID** (*Web application*) → *Authorized redirect URI* : `https://nour-play.app/api/v1/auth/google/callback` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.

---

## 11. Partie 9 — Application mobile (Expo / EAS)

Identifiants de l'app (`apps/mobile/app.json`) : `app.nourplay.mobile` (iOS bundle ID et Android package).

> ⚠️ **Il n'existe pas de `eas.json` dans le dépôt** : créez-le (étape 2).

1. Installation et connexion :
   ```bash
   npm install -g eas-cli
   cd apps/mobile
   eas login
   eas init            # lie le projet à votre compte Expo
   ```
2. Créez `apps/mobile/eas.json` avec les variables d'environnement de production (les `EXPO_PUBLIC_*` sont embarquées au build) :
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
           "EXPO_PUBLIC_APP_URL": "https://nour-play.app",
           "EXPO_PUBLIC_S3_PUBLIC_URL": "https://assets.nour-play.app"
         }
       }
     },
     "submit": { "production": {} }
   }
   ```
3. Builds :
   ```bash
   eas build --platform android --profile production   # AAB pour Google Play
   eas build --platform ios --profile production       # IPA (compte Apple Developer requis ; EAS gère les certificats)
   eas build --platform android --profile preview      # APK interne pour tests
   ```
4. Soumission :
   ```bash
   eas submit --platform android --profile production  # nécessite une clé de service Google Play (JSON)
   eas submit --platform ios --profile production      # nécessite l'App Store Connect API key
   ```
   Interface : <https://expo.dev> → projet → **Builds** (suivi) ; <https://play.google.com/console> et <https://appstoreconnect.apple.com> pour les fiches store (captures, politique de confidentialité, classification « enfants »).
5. En développement sur téléphone physique : `EXPO_PUBLIC_API_URL=http://192.168.x.x:4000/api/v1 pnpm start`.

---

## 12. Partie 10 — DNS et Cloudflare

1. <https://dash.cloudflare.com> → **Add a site** → `nour-play.app` → plan Free → remplacez les *nameservers* chez votre registrar par ceux de Cloudflare.
2. **DNS → Records → Add record** :

   | Type | Nom | Cible | Proxy |
   |---|---|---|---|
   | `A` / `CNAME` | `@` | IP Vercel `76.76.21.21` ou `cname.vercel-dns.com` (valeur exacte affichée par Vercel) | ⚠️ **DNS only** (gris) tant que Vercel n'a pas émis le certificat |
   | `CNAME` | `www` | `cname.vercel-dns.com` | DNS only |
   | `CNAME` | `assets` | géré automatiquement par R2 (Custom Domain) | Proxied ✅ |
   | `TXT`/`CNAME`/`MX` | Resend | valeurs fournies par Resend | DNS only |
   | `TXT` | `_dmarc` | `v=DMARC1; p=reject; rua=mailto:dmarc@nour-play.app` | — |

3. **SSL/TLS → Overview** : mode **Full (strict)**. **Edge Certificates** : *Always Use HTTPS* et *HSTS* activés, TLS minimum 1.2 (1.3 activé).
4. Vérification :
   ```bash
   nslookup nour-play.app
   curl -I https://nour-play.app/api/v1/subscriptions/plans
   ```

> Utilisez `nour-play.app` pour la production et vérifiez les variables
> effectivement configurées, les URL Stripe et les environnements de staging
> séparés avant la bascule.

---

## 13. Option B — Tout sur un VPS (Docker Compose + Caddy)

Stack couverte par `docker-compose.prod.yml` : `postgres`, `redis`, `migrate` (one-shot), `api`, `video-validator`, `web`. **L'Admin reste sur Vercel** (§ 9) ou nécessite d'ajouter un Dockerfile.

### 13.1 Créer le serveur

1. <https://console.hetzner.cloud> → **New project** → **Add Server** : *Location* Falkenstein/Nuremberg, *Image* **Ubuntu 24.04**, *Type* **CPX31** (4 vCPU / 8 Go), ajoutez votre **clé SSH** (`ssh-keygen -t ed25519`) → **Create & Buy now**.
2. Chez Cloudflare, créez des enregistrements `A` (`@`, `www`, `api`, `admin` si besoin) vers l'IP du serveur.
3. Connexion : `ssh root@IP_DU_SERVEUR`.

### 13.2 Durcir le serveur

```bash
# Utilisateur non-root dédié
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Mises à jour
apt update && apt upgrade -y

# SSH : désactiver root + mot de passe
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Pare-feu
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
usermod -aG docker deploy

# Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```
Reconnectez-vous ensuite : `ssh deploy@IP_DU_SERVEUR`.

> ⚠️ **Docker contourne UFW** : `ports: '4000:4000'` / `'3000:3000'` exposent ces ports sur Internet malgré `ufw`. Dans `docker-compose.prod.yml`, remplacez par `'127.0.0.1:4000:4000'` et `'127.0.0.1:3000:3000'` pour que seul Caddy y accède.

### 13.3 Configurer Caddy

`sudo nano /etc/caddy/Caddyfile` :

```caddy
{
    email security@nour-play.app
}

nour-play.app, www.nour-play.app {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
    handle /api/* {
        reverse_proxy localhost:4000
    }
    @admin path /admin /admin/*
    handle @admin {
        reverse_proxy localhost:3001
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

> `/admin` suppose un service admin supplémentaire sur `localhost:3001`,
> compilé et lancé avec `ADMIN_BASE_PATH=/admin` : il n'existe pas dans le
> compose actuel. Sans lui, l'admin ne fonctionne pas. Le CORS est géré par
> NestJS. Le routage WebSocket n'est pas couvert par cet exemple.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

### 13.4 Déployer la stack

```bash
sudo mkdir -p /opt/nourplay && sudo chown -R $USER:$USER /opt/nourplay
cd /opt/nourplay
git clone https://github.com/bouaziziw/nourplay.git .
cp .env.example .env
nano .env
```

Dans `.env`, en plus des variables du § 2, **ajoutez** (lues par `docker-compose.prod.yml`) :

```ini
POSTGRES_USER=nourplay
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DB=nourplay
REDIS_PASSWORD=<openssl rand -hex 24>

# Les hôtes sont les noms de services Docker, pas localhost
DATABASE_URL=postgresql://nourplay:<REDACTED_SECRET>@postgres:5432/nourplay
REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379

NODE_ENV=production
NEXT_PUBLIC_API_URL=https://nour-play.app/api/v1
```

Lancement :

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs migrate     # doit finir par "All migrations have been successfully applied"
curl -i http://localhost:4000/api/v1/subscriptions/plans
```

Ordre de démarrage garanti par `depends_on` : `postgres`/`redis` healthy → `migrate` terminé → `api` et `video-validator` → `web`.

Mise à jour manuelle :
```bash
cd /opt/nourplay && git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

### 13.5 Sauvegardes PostgreSQL

`/opt/nourplay/scripts/backup-db.sh` :

```bash
#!/bin/bash
set -eo pipefail
source /opt/nourplay/.env   # pour S3_ENDPOINT et clés

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/opt/nourplay/backups"
BACKUP_FILE="${BACKUP_DIR}/nourplay_pg_${TIMESTAMP}.sql.gz"
mkdir -p "$BACKUP_DIR"

# Pas d'option -t : un TTY corromprait le flux gzip dans cron
docker exec nourplay-postgres pg_dump -U nourplay -d nourplay | gzip > "$BACKUP_FILE"

if command -v aws &> /dev/null; then
  AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION=auto \
  aws s3 cp "$BACKUP_FILE" "s3://nourplay-backups/postgres/${TIMESTAMP}.sql.gz" --endpoint-url "$S3_ENDPOINT"
fi

find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete
echo "[$(date)] Backup OK: ${BACKUP_FILE}"
```

```bash
sudo apt install -y awscli
chmod +x /opt/nourplay/scripts/backup-db.sh
crontab -e
# ajouter :
30 2 * * * /opt/nourplay/scripts/backup-db.sh >> /var/log/nourplay-backup.log 2>&1
```

Test de restauration (à faire **avant** le go-live) :
```bash
gunzip -c backups/nourplay_pg_XXXX.sql.gz | docker exec -i nourplay-postgres psql -U nourplay -d nourplay_restore_test
```

---

## 14. CI/CD GitHub Actions

Workflows présents dans `.github/workflows/` :

| Fichier | Déclencheur | Rôle |
|---|---|---|
| `ci.yml` | push `main`/`dev`, PR vers `main` | lint, typecheck, tests (`pnpm --filter @nourplay/db generate` avant), Codecov |
| `e2e.yml` | voir fichier | Playwright |
| `deploy.yml` | fin de CI sur `main` (→ staging auto) ou *Run workflow* manuel (staging/production) | build + push images sur `ghcr.io`, puis déploiement SSH |

`deploy.yml` construit 4 images : `nourplay-api`, `nourplay-video-validator`, `nourplay-migrate`, `nourplay-web` (pas d'admin), puis se connecte en SSH à `/opt/nourplay` et exécute `docker compose pull` + `up -d`. **Il suppose donc l'option B** (VPS déjà préparé selon le § 13).

### 14.1 Secrets et variables à créer

GitHub → dépôt → **Settings → Secrets and variables → Actions** :

| Onglet | Nom | Valeur |
|---|---|---|
| Secrets | `PROD_SSH_HOST` | IP / FQDN du serveur de prod |
| Secrets | `PROD_SSH_USER` | `deploy` |
| Secrets | `PROD_SSH_KEY` | clé **privée** Ed25519 (contenu complet de `~/.ssh/nourplay_deploy`) |
| Secrets | `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY` | idem pour le staging (⚠️ absents de l'ancienne doc) |
| Secrets | `GHCR_READ_TOKEN` | PAT avec le scope `read:packages` |
| Secrets | `CODECOV_TOKEN` | jeton Codecov |
| Variables | `STAGING_API_URL` | ex. `https://api.staging.nour-play.app/api/v1` (build-arg du web) |

Générer et installer la clé de déploiement :
```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/nourplay_deploy -N ""
ssh-copy-id -i ~/.ssh/nourplay_deploy.pub deploy@IP_DU_SERVEUR
cat ~/.ssh/nourplay_deploy        # → à coller dans le secret PROD_SSH_KEY
```

Créer le PAT : GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token** → scope `read:packages`.

### 14.2 Approbation manuelle pour la production

**Settings → Environments → New environment** `production` → cochez **Required reviewers** et ajoutez-vous. Le job `deploy-production` attendra alors votre validation.

### 14.3 Lancer un déploiement

- **Staging** : automatique après un CI vert sur `main`.
- **Production** : onglet **Actions → Deploy → Run workflow** → *Environment* = `production` → **Run workflow** → approuvez.
- CLI :
  ```bash
  gh workflow run deploy.yml -f environment=production
  gh run watch
  ```

### 14.4 Rollback

Les images sont taguées par SHA court. Sur le serveur :
```bash
cd /opt/nourplay
printf "REGISTRY=ghcr.io/bouaziziw\nIMAGE_TAG=<sha7_precedent>\n" > .image.env
docker compose --env-file .env --env-file .image.env -f docker-compose.prod.yml up -d
```
(⚠️ les migrations Prisma ne se « dé-jouent » pas : rédigez des migrations rétro-compatibles.)

---

## 15. Écarts détectés entre la doc d'origine et le dépôt

| # | Constat | Impact | Correction recommandée |
|---|---|---|---|
| 1 | **Aucun endpoint `/api/health`** n'existe dans `packages/api` (la doc, la supervision et `deploy.yml` l'utilisent). | Le `curl -fsS http://localhost:4000/api/health` de `deploy.yml` échoue → **le déploiement est marqué en échec** après chaque release. | Ajouter un `HealthController` (`GET /api/health`, hors versioning) **ou** changer les checks vers `/api/v1/subscriptions/plans`. |
| 2 | Script `start:prod` absent de `@nourplay/api` (seul `start` existe). | Start Command Render/Railway en erreur. | Utiliser `pnpm --filter @nourplay/api start` ou ajouter `"start:prod"`. |
| 3 | `DIRECT_URL` non utilisé : pas de `directUrl` dans `schema.prisma`. | Migration via pooler PgBouncer potentiellement bloquée. | Migrer avec `DATABASE_URL` = URL directe, ou ajouter `directUrl`. |
| 4 | Webhook Stripe : route réelle `/api/v1/subscriptions/webhook` (pluriel). | 404 si l'URL de l'ancienne doc est utilisée. | Corrigé dans ce guide (§ 10.5). |
| 5 | `deploy.yml` passe `vars.STAGING_API_URL` au build de l'image **web pour toutes les cibles**. | La prod embarquerait l'URL de staging. | Builder deux images (tags distincts) ou conditionner le build-arg par environnement. |
| 6 | `deploy.yml` utilise `STAGING_SSH_*` (non documentés) et ne publie pas d'image Admin. | Staging non déployable sans ces secrets ; Admin hors Docker. | Créer les secrets (§ 14.1) ; Admin sur Vercel. |
| 7 | Compose prod : ports `3000`/`4000` publiés sur `0.0.0.0`, contournant UFW. | Exposition directe sans TLS. | Lier à `127.0.0.1` (§ 13.2). |
| 8 | Variables absentes de la doc : `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_S3_PUBLIC_URL`, `EXPO_PUBLIC_*`, `POSTGRES_*`, `REDIS_PASSWORD`. | Watch-party, avatars et compose prod non fonctionnels. | Ajoutées au § 2. |
| 9 | Pas de `eas.json` dans `apps/mobile`. | `eas build` ne sait pas injecter les variables. | Créer le fichier (§ 11). |
| 10 | URLs de production configurées dans plusieurs services. | CORS/cookies/Stripe incohérents si elles divergent. | Vérifier les variables et webhooks avant la bascule. |
| 11 | Script de sauvegarde : `docker exec -t` (TTY) corrompt le dump dans cron. | Sauvegardes invalides. | Retirer `-t` (corrigé § 13.5). |
| 12 | Gateway watch-party : `cors: { origin: '*' }`. | CORS Socket.IO permissif, contraire au durcissement attendu. | Restreindre à `CORS_ORIGINS` (revue sécurité). |

---

## 16. Monitoring, sauvegardes, checklist Go-Live

### Monitoring

- **Disponibilité** — <https://uptimerobot.com> → **Add New Monitor** → *HTTP(s)*, intervalle 1 min, pour :
  - `https://nour-play.app`
  - `https://nour-play.app/api/v1/subscriptions/plans` (ou `/api/health` une fois créé)
  - `https://nour-play.app/admin/login`
  
  Alertes email/Slack/SMS si ≠ 200 pendant 60 s.
- **Logs** — Render : onglet *Logs* ; Vercel : *Logs* du projet ; VPS : `docker compose -f docker-compose.prod.yml logs -f --tail=100 <service>`.
- **Observabilité avancée (optionnelle)** — Grafana Cloud (OTLP) : renseignez `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_SERVICE_NAME` sur l'API. Config locale de référence : `scripts/observability/`.
- **Files BullMQ** — surveillez le nombre de jobs en attente/échoués dans Redis.

### Checklist Go-Live

- [ ] `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` : 3 valeurs distinctes ≥ 32 car.
- [ ] `NODE_ENV=production`, `BCRYPT_ROUNDS=12`, `EMAIL_PROVIDER=resend`.
- [ ] `CORS_ORIGINS` limité aux domaines de production (sans espace).
- [ ] `pnpm db:migrate:prod` exécuté sans erreur ; **seed non exécuté** ; compte ADMIN créé (§ 5).
- [ ] Sauvegarde PostgreSQL planifiée **et restauration testée**.
- [ ] Redis en `noeviction` + TLS.
- [ ] CGU, mentions légales et politique de confidentialité publiées (back-office, `LegalDocument`) ; consentement parental actif ; registre des traitements + AIPD archivés (`docs/compliance/`).
- [ ] Domaine Resend « Verified » (SPF/DKIM/DMARC).
- [ ] Webhook Stripe en Live testé (200) ; clés `sk_live`/`pk_live` en prod uniquement.
- [ ] Limite de dépense OpenAI configurée ; quota YouTube vérifié.
- [ ] DNS propagés, TLS valide, HSTS actif (`nour-play.app` et `assets` si utilisé).
- [ ] Tests de bout en bout : inscription parent + email de validation ; ajout d'une vidéo YouTube/Vimeo → passage par le worker ; PIN parent + lecture en profil enfant ; paiement Stripe ; upload d'avatar.
- [ ] Monitoring d'uptime configuré.

---

## 17. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Prisma Client did not initialize` / module `@nourplay/db` introuvable | `generate` ou `build` du package db non exécuté | `pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db build` |
| `P1001: Can't reach database server` | mauvaise URL / IP non autorisée / `sslmode` manquant | vérifier l'URL, ajouter `?sslmode=require`, tester avec `psql "$DATABASE_URL"` |
| Migration qui bloque avec PgBouncer | migration via pooler | utiliser l'URL directe (§ 5) |
| Erreurs CORS dans le navigateur | origine absente de `CORS_ORIGINS` | ajouter l'origine exacte (schéma + domaine, sans `/` final) et redémarrer l'API |
| Le front appelle `localhost:4000` en prod | `NEXT_PUBLIC_API_URL` absent au build | définir la variable puis **rebuild** sans cache |
| Cookies de session non envoyés | pas de HTTPS ou domaines différents | HTTPS partout, `NODE_ENV=production`, front et API sur le même domaine parent |
| Webhook Stripe 400 « Signature webhook invalide » | mauvais `STRIPE_WEBHOOK_SECRET` (test vs live) ou corps modifié par un proxy | utiliser le secret de l'endpoint Live ; ne pas transformer le corps |
| Emails jamais reçus | `EMAIL_PROVIDER=console` (défaut) | `EMAIL_PROVIDER=resend` + clé valide + domaine vérifié |
| Vidéos bloquées « en attente de revue » | pas d'`OPENAI_API_KEY` sur le worker ou worker arrêté | renseigner la clé, vérifier les logs du worker et `REDIS_URL` |
| Sur VPS, `api` ne démarre pas | `migrate` en échec | `docker compose -f docker-compose.prod.yml logs migrate` |
| Certificat Caddy non émis | DNS non propagé ou ports 80/443 fermés | `dig +short nour-play.app`, `ufw status`, `journalctl -u caddy -n 100` |
| Déploiement GitHub Actions rouge après le SSH | health check `/api/health` inexistant | voir § 15 point 1 |

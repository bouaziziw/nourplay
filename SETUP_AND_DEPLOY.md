# Guide de Configuration et de Déploiement — NourPlay

> **Version :** 1.0.0  
> **Date de référence :** 2026  
> **Auteur :** Lead Developer & Équipe DevOps NourPlay  
> **Projet :** Plateforme de curation vidéo privée pour parents et enseignants

---

## Table des Matières

1. [Vue d'ensemble de la stack technique](#1-vue-densemble-de-la-stack-technique)
2. [Cartographie des composants et des ports](#2-cartographie-des-composants-et-des-ports)
3. [Matrice des variables d'environnement](#3-matrice-des-variables-denvironnement)
4. [Guide d'installation en local (Développement)](#4-guide-dinstallation-en-local-développement)
   - [4.1 Prérequis système](#41-prérequis-système)
   - [4.2 Clônage et installation des dépendances](#42-clônage-et-installation-des-dépendances)
   - [4.3 Configuration de l'environnement local](#43-configuration-de-lenvironnement-local)
   - [4.4 Démarrage des conteneurs de services (Docker Compose)](#44-démarrage-des-conteneurs-de-services-docker-compose)
   - [4.5 Initialisation et seeding de la base de données](#45-initialisation-et-seeding-de-la-base-de-données)
   - [4.6 Lancement des applications et workers](#46-lancement-des-applications-et-workers)
   - [4.7 Lancement de l'application Mobile (Expo)](#47-lancement-de-lapplication-mobile-expo)
   - [4.8 Exécution des tests (Unitaires, Intégration, E2E)](#48-exécution-des-tests-unitaires-intégration-e2e)
   - [4.9 Annuaire des accès locaux et interfaces d'administration](#49-annuaire-des-accès-locaux-et-interfaces-dadministration)
5. [Guide de déploiement en production](#5-guide-de-déploiement-en-production)
   - [5.1 Architecture cible et stratégies d'hébergement](#51-architecture-cible-et-stratégies-dhébergement)
   - [5.2 Option A : Déploiement Cloud Managé (Best-of-Breed PaaS / Serverless)](#52-option-a--déploiement-cloud-managé-best-of-breed-paas--serverless)
     - [5.2.1 Base de données relationnelle : Supabase / Neon PostgreSQL](#521-base-de-données-relationnelle--supabase--neon-postgresql)
     - [5.2.2 Cache et Files de jobs : Upstash Redis / Redis Cloud](#522-cache-et-files-de-jobs--upstash-redis--redis-cloud)
     - [5.2.3 Backend API & Worker IA : Render / Railway](#523-backend-api--worker-ia--render--railway)
     - [5.2.4 Frontend Web & Admin : Vercel](#524-frontend-web--admin--vercel)
     - [5.2.5 Stockage d'objets : Cloudflare R2 / AWS S3](#525-stockage-dobjets--cloudflare-r2--aws-s3)
     - [5.2.6 Envoi d'emails transactionnels : Resend](#526-envoi-demails-transactionnels--resend)
     - [5.2.7 Modération IA : OpenAI](#527-modération-ia--openai)
     - [5.2.8 Abonnements et Facturation : Stripe](#528-abonnements-et-facturation--stripe)
     - [5.2.9 Applications Mobiles : Expo Application Services (EAS)](#529-applications-mobiles--expo-application-services-eas)
   - [5.3 Option B : Déploiement sur Serveur Dédié / VPS (Docker Compose + Caddy SSL)](#53-option-b--déploiement-sur-serveur-dédié--vps-docker-compose--caddy-ssl)
     - [5.3.1 Provisionnement et durcissement du serveur (Ubuntu 24.04 LTS)](#531-provisionnement-et-durcissement-du-serveur-ubuntu-2404-lts)
     - [5.3.2 Configuration du Reverse-Proxy Caddy (SSL automatique Let's Encrypt)](#532-configuration-du-reverse-proxy-caddy-ssl-automatique-lets-encrypt)
     - [5.3.3 Déploiement de la stack via Docker Compose Prod](#533-déploiement-de-la-stack-via-docker-compose-prod)
     - [5.3.4 Stratégie de sauvegarde automatisée de PostgreSQL (S3 / R2)](#534-stratégie-de-sauvegarde-automatisée-de-postgresql-s3--r2)
   - [5.4 Pipeline CI/CD GitHub Actions & Déploiement Continu](#54-pipeline-cicd-github-actions--déploiement-continu)
   - [5.5 Monitoring, Observabilité et Alerting en Production](#55-monitoring-observabilité-et-alerting-en-production)
   - [5.6 Checklist de pré-mise en production (Go-Live Runbook)](#56-checklist-de-pré-mise-en-production-go-live-runbook)

---

## 1. Vue d'ensemble de la stack technique

NourPlay est structuré sous la forme d'un **Monorepo** géré par **Turborepo** et **pnpm workspaces** :

```
nourplay/
├── apps/
│   ├── web/               # Next.js 14 (App Router) — Application Parents / Enseignants / Enfants
│   ├── admin/             # Next.js 14 (App Router) — Back-office Administrateur & Modération
│   └── mobile/            # Expo 53 / React Native 0.79 — Application Mobile & TV
├── packages/
│   ├── api/               # NestJS 10 — API REST backend versionnée (/api/v1)
│   ├── db/                # Prisma 5 — Schéma de données, migrations et client partagé
│   ├── i18n/              # Configurations multilingues (fr, en, ar, es avec RTL)
│   └── ui/                # Composants UI partagés
├── workers/
│   └── video-validator/   # Worker BullMQ — Analyse & validation IA des vidéos (OpenAI)
├── scripts/               # Scripts d'initialisation DB et observabilité (Grafana, Tempo, Loki)
├── docs/                  # Documentation légale, RGPD et architecture
├── docker-compose.yml     # Stack d'infrastructure pour le développement local
└── docker-compose.prod.yml# Stack de conteneurs pour la production VPS
```

---

## 2. Cartographie des composants et des ports

| Service / Application | Rôle | Port par défaut | URL locale |
|---|---|---|---|
| **Web Frontend** | Interface publique, parent et espace enfant | `3000` | `http://localhost:3000` |
| **Admin Dashboard** | Back-office d'administration et de conformité | `3001` | `http://localhost:3001` |
| **Backend API** | API REST NestJS & Webhooks | `4000` | `http://localhost:4000/api/v1` |
| **Swagger API Docs** | Documentation interactive OpenAPI | `4000` | `http://localhost:4000/api/docs` |
| **PostgreSQL** | Base de données relationnelle principale | `5432` | `localhost:5432` |
| **Redis** | Cache distribué, sessions et queues BullMQ | `6379` | `localhost:6379` |
| **Adminer** | IHM Web de gestion de PostgreSQL | `8080` | `http://localhost:8080` |
| **Redis Commander** | IHM Web de visualisation des clés Redis et BullMQ | `8081` | `http://localhost:8081` |
| **MailHog** | Serveur SMTP & Webmail de test local | `1025` (SMTP) / `8025` (HTTP) | `http://localhost:8025` |
| **Grafana** | Tableaux de bord unifiés (Logs, Métriques, Traces) | `3002` | `http://localhost:3002` |
| **Prometheus** | Collecteur de métriques système | `9090` | `http://localhost:9090` |
| **Loki** | Collecteur de logs structurés | `3100` | `http://localhost:3100` |
| **Tempo** | Récepteur de traces distribuées OpenTelemetry (OTLP) | `4317` (gRPC) / `4318` (HTTP) | `http://localhost:3200` |

---

## 3. Matrice des variables d'environnement

Créez le fichier `.env` à la racine du projet à partir du modèle fourni `.env.example`.

```bash
cp .env.example .env
```

### Détail des variables d'environnement :

| Variable | Description | Requis en Local | Valeur recommandée en Production |
|---|---|:---:|---|
| `NODE_ENV` | Environnement d'exécution | Oui | `production` |
| `APP_NAME` | Nom de l'application | Oui | `NourPlay` |
| `APP_URL` | URL de l'application web principale | Oui | `https://nourplay.app` |
| `API_URL` | URL publique de l'API backend | Oui | `https://api.nourplay.app` |
| `ADMIN_URL` | URL du tableau de bord admin | Oui | `https://admin.nourplay.app` |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL principale | Oui | `postgresql://user:pwd@host:5432/dbname?sslmode=require` |
| `DATABASE_URL_TEST` | Chaîne de connexion PostgreSQL pour les tests | Non | Utilisé uniquement en CI/Tests locaux |
| `REDIS_URL` | Chaîne de connexion Redis | Oui | `rediss://default:pwd@host:6379` (TLS) |
| `JWT_ACCESS_SECRET` | Clé secrète de signature des tokens Access (min 32 car.) | Oui | Généré via `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET`| Clé secrète de signature des tokens Refresh (min 32 car.)| Oui | Généré via `openssl rand -base64 32` |
| `JWT_ACCESS_TTL` | Durée de vie du JWT Access Token en secondes | Oui | `900` (15 minutes) |
| `JWT_REFRESH_TTL` | Durée de vie du JWT Refresh Token en secondes | Oui | `604800` (7 jours) |
| `COOKIE_SECRET` | Clé secrète de chiffrement des cookies de session | Oui | Généré via `openssl rand -base64 32` |
| `BCRYPT_ROUNDS` | Coût de hachage des PIN et mots de passe secondaires | Oui | `12` |
| `TOTP_ISSUER` | Nom de l'émetteur TOTP affiché dans Google Auth / Authy | Oui | `NourPlay` |
| `GOOGLE_CLIENT_ID` | Client ID OAuth 2.0 Google | Non | Clé console Google Cloud Platform |
| `GOOGLE_CLIENT_SECRET` | Client Secret OAuth 2.0 Google | Non | Clé console Google Cloud Platform |
| `GOOGLE_CALLBACK_URL` | URL de retour OAuth Google | Non | `https://api.nourplay.app/api/v1/auth/google/callback` |
| `EMAIL_PROVIDER` | Provider d'email (`resend` ou `smtp`) | Oui | `resend` |
| `RESEND_API_KEY` | Clé API Resend | Non (Local: MailHog) | `re_xxxxxxxxxxxx` |
| `EMAIL_FROM` | Adresse d'expéditeur certifiée SPF/DKIM | Oui | `NourPlay <noreply@nourplay.app>` |
| `S3_ENDPOINT` | Point de terminaison S3 compatible (ex: Cloudflare R2) | Non | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | Identifiant de clé d'accès S3 / R2 | Non | Clé Cloudflare R2 / AWS IAM |
| `S3_SECRET_ACCESS_KEY`| Clé secrète S3 / R2 | Non | Clé Cloudflare R2 / AWS IAM |
| `S3_BUCKET` | Nom du bucket pour les avatars et exports RGPD | Non | `nourplay-production-assets` |
| `S3_PUBLIC_URL` | URL du CDN public pour les avatars | Non | `https://assets.nourplay.app` |
| `YOUTUBE_API_KEY` | Clé Google Cloud pour les métadonnées et l’import de playlists YouTube | Optionnelle, requise pour importer une playlist | Clé YouTube Data API v3 |
| `VIMEO_ACCESS_TOKEN` | Jeton d'accès API Vimeo | Non (Mocks dispo) | Token développeur Vimeo |
| `OPENAI_API_KEY` | Clé API OpenAI pour la validation IA | Non (sans clé, revue humaine obligatoire) | Clé OpenAI |
| `AI_MODERATION_MODEL` | Modèle OpenAI | Non | `gpt-4o-mini` |
| `OPENAI_TIMEOUT_MS` | Timeout de l'analyse OpenAI | Non | `45000` |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe pour les abonnements | Non | `sk_live_xxxx` |
| `STRIPE_WEBHOOK_SECRET` | Clé secrète de signature des webhooks Stripe | Non | `whsec_xxxx` |
| `VAPID_PUBLIC_KEY` | Clé publique pour les notifications Web Push | Non | Clé générée par `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY`| Clé privée Web Push | Non | Clé générée par `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | Contact émetteur Web Push (RFC 8292) | Non | `mailto:security@nourplay.app` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Point d'ingestion OpenTelemetry | Non | `http://tempo:4318` ou Grafana Cloud OTLP |
| `CORS_ORIGINS` | Origines autorisées (séparées par une virgule) | Oui | `https://nourplay.app,https://admin.nourplay.app` |

---

## 4. Guide d'installation en local (Développement)

### 4.1 Prérequis système

Vérifiez que votre environnement dispose des outils suivants :

- **Node.js :** `>= 20.12.0 LTS` ([Télécharger Node.js](https://nodejs.org/))
- **pnpm :** `>= 9.0.0` (`npm install -g pnpm`)
- **Docker & Docker Compose :** Docker Desktop 4.x ou Docker Engine 24+ avec le plugin `docker compose`
- **Git :** `>= 2.40`
- **OpenSSL :** (Requis pour générer des secrets cryptographiques fiables)

```bash
# Vérification des prérequis
node -v    # Doit afficher v20.x ou supérieur
pnpm -v    # Doit afficher 9.x ou supérieur
docker -v  # Doit afficher Docker version 24.x ou supérieur
docker compose version
```

---

### 4.2 Clônage et installation des dépendances

```bash
# 1. Clôner le projet
git clone https://github.com/votre-orga/nourplay.git
cd nourplay

# 2. Installer toutes les dépendances du monorepo
pnpm install
```

---

### 4.3 Configuration de l'environnement local

Générez automatiquement les clés secrètes sécurisées dans votre fichier `.env` :

```bash
# Sous Linux / macOS / Git Bash :
cp .env.example .env

# Génération des secrets JWT et Cookies dans le .env
sed -i "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -base64 32)|g" .env
sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -base64 32)|g" .env
sed -i "s|COOKIE_SECRET=.*|COOKIE_SECRET=$(openssl rand -base64 32)|g" .env
```

*Sous Windows PowerShell :*
```powershell
Copy-Item .env.example .env

# Génération automatique des secrets via Node.js :
node -e "const crypto = require('crypto'), fs = require('fs'); let c = fs.readFileSync('.env', 'utf8'); c = c.replace(/JWT_ACCESS_SECRET=.*/, 'JWT_ACCESS_SECRET=' + crypto.randomBytes(32).toString('base64')).replace(/JWT_REFRESH_SECRET=.*/, 'JWT_REFRESH_SECRET=' + crypto.randomBytes(32).toString('base64')).replace(/COOKIE_SECRET=.*/, 'COOKIE_SECRET=' + crypto.randomBytes(32).toString('base64')); fs.writeFileSync('.env', c); console.log('Secrets générés avec succès !');"
```

---

### 4.4 Démarrage des conteneurs de services (Docker Compose)

Lancez l'ensemble des services d'infrastructure locaux (PostgreSQL, Redis, Adminer, MailHog, Loki, Tempo, Prometheus, Grafana) :

```bash
# Démarrer les services d'infrastructure en arrière-plan
docker compose up -d

# Vérifier la santé des conteneurs
docker compose ps
```

---

### 4.5 Initialisation et seeding de la base de données

Générez le client Prisma, appliquez les migrations et injectez le jeu de données de test (comptes administrateur, parents, profils enfants, sources vidéo YouTube/Vimeo autorisées, playlists éducatives et documents légaux) :

```bash
# 1. Générer le client Prisma typé
pnpm --filter @nourplay/db generate

# 2. Exécuter les migrations Prisma
pnpm db:migrate

# 3. Injecter les données de démarrage (Seed)
pnpm db:seed
```

> 🔑 **Comptes créés lors du seed :**
> - **Super Admin :** `admin@nourplay.local` | Mot de passe : `Admin1234!`
> - **Parent de test :** `parent@nourplay.local` | Mot de passe : `Parent1234!` (avec profils enfants & PIN `1234`)
> - **Enseignant :** `teacher@nourplay.local` | Mot de passe : `Teacher1234!`

# Comptes de test disponibles :
> - Rôle	Email	Mot de passe	Détails
> - Super Admin	admin@nourplay.local	Admin1234!	Accès back-office
> - Parent de test	parent@nourplay.local	Parent1234!	Profils enfants inclus (PIN: 1234)
> - Enseignant	teacher@nourplay.local	Teacher1234!	Gestion playlists pédagogiques
# Étape suivante

> - Vous pouvez maintenant lancer l'ensemble des applications (API, Web, Admin) en exécutant :

powershell
pnpm dev
Frontend Web (Parent & Enfant) : http://localhost:3000
Back-office Admin : http://localhost:3001
API NestJS : http://localhost:4000
MailHog (emails locaux) : http://localhost:8025

Une fois démarré, vous aurez accès à :

Application Web (Parent / Enfant) : http://localhost:3000
Back-office Admin : http://localhost:3001
API NestJS & Swagger : http://localhost:4000/api/docs
MailHog (boîte mail de dev) : http://localhost:8025
Adminer (gestionnaire PostgreSQL) : http://localhost:8080

---

### 4.6 Lancement des applications et workers

Vous pouvez démarrer l'ensemble des applications simultanément avec Turborepo :

```bash
# Lance API (:4000), Web (:3000), Admin (:3001) et Worker en parallèle
pnpm dev
```

Ou lancer chaque composant individuellement dans des terminaux séparés si nécessaire :

```bash
# Terminal 1 — Backend API (NestJS)
pnpm --filter @nourplay/api dev

# Terminal 2 — Worker de validation vidéo IA (BullMQ)
pnpm --filter @nourplay/video-validator dev

# Terminal 3 — Frontend Web Parent/Enfant (Next.js)
pnpm --filter @nourplay/web dev

# Terminal 4 — Back-office Admin (Next.js)
pnpm --filter @nourplay/admin dev
```

---

### 4.7 Lancement de l'application Mobile (Expo)

Pour exécuter l'application mobile et TV sur simulateur ou terminal physique :

```bash
cd apps/mobile

# Démarrer le serveur Metro Expo
pnpm start

# Pour lancer directement sur simulateur Android
pnpm android

# Pour lancer directement sur simulateur iOS (macOS requis)
pnpm ios
```

> Sur un téléphone physique, connectez le téléphone et l'ordinateur au même réseau Wi-Fi. L'application utilise automatiquement l'adresse réseau du serveur Metro pour joindre l'API sur le port `4000`. Si nécessaire, définissez `EXPO_PUBLIC_API_URL` (par exemple `http://192.168.1.200:4000/api/v1`) avant de lancer Expo. Vérifiez également que le pare-feu autorise les connexions entrantes sur le port `4000`.
>
> Le lecteur YouTube mobile utilise `https://nourplay.app` comme origine/référent pour éviter l'erreur 153. Si l'application est servie sous un autre domaine, définissez `EXPO_PUBLIC_APP_URL` avec son origine HTTPS.
>
> Les liens qui tentent de faire sortir le lecteur vidéo vers YouTube, Vimeo, Dailymotion ou une autre page externe sont bloqués dans l'application mobile.

> **Support TV :** L'application est optimisée pour la navigation D-Pad (Focus TV) pour Android TV, Fire TV et Apple TV.

---

### 4.8 Exécution des tests (Unitaires, Intégration, E2E)

```bash
# 1. Vérification du typage statique
pnpm typecheck

# 2. Analyse statique (Linter)
pnpm lint

# 3. Tests unitaires (Vitest avec couverture de code)
pnpm test

# 4. Tests d'intégration API (Supertest + DB)
pnpm --filter @nourplay/api test:e2e

# 5. Tests de bout en bout Web (Playwright)
pnpm test:e2e

# 6. Tests E2E Mobile (Maestro)
pnpm --filter @nourplay/mobile test:e2e
```

---

### 4.9 Annuaire des accès locaux et interfaces d'administration

- 🌐 **Application Web :** [http://localhost:3000](http://localhost:3000)
- 🛡️ **Tableau de bord Admin :** [http://localhost:3001](http://localhost:3001)
- 🔌 **API REST Swagger Docs :** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- 🗄️ **Adminer (Gestionnaire PostgreSQL) :** [http://localhost:8080](http://localhost:8080) *(Système: PostgreSQL, Serveur: postgres, Utilisateur: nourplay, Base: nourplay, Pwd: secret)*
- ⚡ **Redis Commander :** [http://localhost:8081](http://localhost:8081)
- 📬 **MailHog (Boîte de réception d'emails de test) :** [http://localhost:8025](http://localhost:8025)
- 📊 **Grafana (Logs Loki & Traces Tempo) :** [http://localhost:3002](http://localhost:3002) *(Login: admin / admin)*

---

## 5. Guide de déploiement en production

---

### 5.1 Architecture cible et stratégies d'hébergement

NourPlay prend en charge deux modèles d'hébergement en production :

1. **Modèle Cloud Managé (PaaS / Serverless / Best-of-Breed) :**  
   Idéal pour une scalabilité automatique, une haute disponibilité sans maintenance d'OS et une séparation stricte des responsabilités (Vercel pour les fronts Next.js, Render/Railway pour l'API et les workers, Supabase/Neon pour PostgreSQL, Upstash pour Redis).

2. **Modèle VPS / Serveur Dédié (Docker Compose + Caddy SSL) :**  
   Idéal pour la souveraineté complète des données (RGPD / CNIL), la maîtrise des coûts prédictibles et l'hébergement au sein de l'Union Européenne (ex: serveurs Hetzner, OVHcloud ou Scaleway à Paris/Francfort).

---

### 5.2 Option A : Déploiement Cloud Managé (Best-of-Breed PaaS / Serverless)

```
                       ┌─────────────────────────┐
                       │     Cloudflare DNS      │
                       │     & WAF (Edge)        │
                       └────────────┬────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Vercel (Edge)   │      │  Vercel (Edge)   │      │ Render / Railway │
│  apps/web        │      │  apps/admin      │      │ packages/api     │
│  nourplay.app    │      │ admin.nourplay   │      │ api.nourplay.app │
└──────────────────┘      └──────────────────┘      └────────┬─────────┘
                                                             │
                  ┌─────────────────────────┬────────────────┼─────────────────────────┐
                  ▼                         ▼                ▼                         ▼
        ┌──────────────────┐      ┌──────────────────┐ ┌──────────┐          ┌──────────────────┐
        │ Supabase / Neon  │      │ Upstash Redis    │ │ Workers  │          │ Cloudflare R2    │
        │ PostgreSQL 16    │      │ BullMQ & Cache   │ │ BullMQ   │          │ Avatars / Assets │
        └──────────────────┘      └──────────────────┘ └──────────┘          └──────────────────┘
```

---

#### 5.2.1 Base de données relationnelle : Supabase / Neon PostgreSQL

1. **Création du projet :**
   - Créez un projet PostgreSQL 16 chez [Supabase](https://supabase.com) ou [Neon](https://neon.tech) dans une région UE (ex: `eu-west-3` Paris ou `eu-central-1` Francfort).
2. **Configuration du Connection Pooling :**
   - Utilisez l'URL avec Pooler (port `6543` sur Supabase / PgBouncer) pour l'API.
   - Conservez l'URL directe (port `5432`) pour les migrations Prisma.
3. **Variables d'environnement à définir :**
   ```ini
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true&sslmode=require"
   DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
   ```
4. **Exécution des migrations initiales :**
   ```bash
   pnpm db:migrate:prod
   ```

---

#### 5.2.2 Cache et Files de jobs : Upstash Redis / Redis Cloud

1. Créez une instance Redis sur [Upstash](https://upstash.com) ou [Redis Cloud](https://redis.com) (Région Europe).
2. Activez le chiffrement TLS et définissez la politique d'éviction sur `noeviction` (obligatoire pour garantir l'intégrité des files de messages BullMQ).
3. **Variable d'environnement :**
   ```ini
   REDIS_URL="rediss://default:[PASSWORD]@[HOST]:[PORT]"
   ```

---

#### 5.2.3 Backend API & Worker IA : Render / Railway

##### Déploiement de l'API NestJS (`packages/api`) :
1. Créez un nouveau **Web Service** connecté à votre dépôt GitHub.
2. Définissez le **Root Directory** sur le projet racine.
3. **Build Command :**
   ```bash
   pnpm install --frozen-lockfile && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/api build
   ```
4. **Start Command :**
   ```bash
   pnpm --filter @nourplay/api start:prod
   ```
5. **Health Check Path :** `/api/health`
6. Renseignez l'ensemble des variables d'environnement (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, etc.).

##### Déploiement du Worker BullMQ (`workers/video-validator`) :
1. Créez un **Background Worker** sur Render ou un Service séparé sur Railway.
2. **Build Command :**
   ```bash
   pnpm install --frozen-lockfile && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/video-validator build
   ```
3. **Start Command :**
   ```bash
   pnpm --filter @nourplay/video-validator start:prod
   ```
4. Injectez les variables `REDIS_URL`, `DATABASE_URL` et `OPENAI_API_KEY`.

---

#### 5.2.4 Frontend Web & Admin : Vercel

##### Application Web (`apps/web`) :
1. Importez le dépôt sur [Vercel](https://vercel.com).
2. **Root Directory :** `apps/web`
3. **Framework Preset :** `Next.js`
4. **Build Command :** `cd ../.. && pnpm --filter @nourplay/web build`
5. **Output Directory :** `.next`
6. **Variables d'environnement Vercel :**
   ```ini
   NEXT_PUBLIC_API_URL="https://api.nourplay.app/api/v1"
   NEXT_PUBLIC_APP_URL="https://nourplay.app"
   ```

##### Application Admin (`apps/admin`) :
1. Créez un second projet Vercel pointant sur `apps/admin`.
2. **Variables d'environnement Vercel :**
   ```ini
   NEXT_PUBLIC_API_URL="https://api.nourplay.app/api/v1"
   NEXT_PUBLIC_ADMIN_URL="https://admin.nourplay.app"
   ```

---

#### 5.2.5 Stockage d'objets : Cloudflare R2 / AWS S3

1. Créez un bucket R2 nommé `nourplay-assets` (Région `WNAM` ou `WEUR` / Localisation UE).
2. Configurez les règles **CORS** sur le bucket :
   ```json
   [
     {
       "AllowedOrigins": ["https://nourplay.app", "https://admin.nourplay.app"],
       "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. Associez un nom de domaine personnalisé au bucket : `assets.nourplay.app`.
4. Renseignez les identifiants R2 (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`).

---

#### 5.2.6 Envoi d'emails transactionnels : Resend

1. Ajoutez votre domaine `nourplay.app` sur [Resend](https://resend.com).
2. Configurez vos enregistrements DNS chez votre registrar :
   - **DKIM :** Clé TXT `resend._domainkey.nourplay.app`
   - **SPF :** Enregistrement TXT `v=spf1 include:amazonses.com ~all`
   - **DMARC :** Enregistrement TXT `_dmarc.nourplay.app` avec valeur `v=DMARC1; p=reject; rua=mailto:dmarc@nourplay.app`
3. Générez une clé API de production avec permissions d'envoi et configurez `RESEND_API_KEY`.

---

#### 5.2.7 Modération IA : OpenAI

1. Configurez un compte OpenAI avec accès au modèle de modération sélectionné.
2. Définissez une limite de dépenses mensuelles pour maîtriser les coûts.
3. Configurez `OPENAI_API_KEY` et, si nécessaire, `AI_MODERATION_MODEL`.

---

#### 5.2.8 Abonnements et Facturation : Stripe

1. Dans le Dashboard Stripe en mode Live :
   - Créez les produits et tarifs récurrents (ex: *Pass Famille*, *Pass Établissement Scolaire*).
   - Configurez un Webhook pointant vers `https://api.nourplay.app/api/v1/subscription/webhook`.
   - Sélectionnez les événements : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
2. Récupérez la clé de signature du webhook (`whsec_...`) et assignez-la à `STRIPE_WEBHOOK_SECRET`.

---

#### 5.2.9 Applications Mobiles : Expo Application Services (EAS)

1. **Installation du CLI EAS :**
   ```bash
   npm install -g eas-cli
   cd apps/mobile
   eas login
   ```
2. **Configuration du projet (`eas.json`) :**
   ```json
   {
     "cli": { "version": ">= 12.0.0" },
     "build": {
       "preview": { "distribution": "internal" },
       "production": { "channel": "production" }
     },
     "submit": {
       "production": {}
     }
   }
   ```
3. **Génération des builds de production :**
   ```bash
   # Build Android (AAB pour Google Play Store)
   eas build --platform android --profile production

   # Build iOS (IPA pour TestFlight / App Store)
   eas build --platform ios --profile production
   ```
4. **Soumission automatique aux stores :**
   ```bash
   eas submit --platform all
   ```

---

### 5.3 Option B : Déploiement sur Serveur Dédié / VPS (Docker Compose + Caddy SSL)

---

#### 5.3.1 Provisionnement et durcissement du serveur (Ubuntu 24.04 LTS)

Connectez-vous à votre serveur VPS (ex: Hetzner Cloud CPX31, 4 vCPU, 8 Go RAM) en SSH :

```bash
# 1. Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# 2. Configurer le pare-feu UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (Caddy Let's Encrypt challenge)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# 3. Installer Docker Engine & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 4. Installer Caddy (Reverse Proxy avec SSL automatique)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y
```

---

#### 5.3.2 Configuration du Reverse-Proxy Caddy (SSL automatique Let's Encrypt)

Éditez le fichier `/etc/caddy/Caddyfile` :

```caddy
# ── Configuration Globale ────────────────────────────────────
{
    email security@nourplay.app
    admin off
}

# ── Frontend Web ─────────────────────────────────────────────
nourplay.app, www.nourplay.app {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
    reverse_proxy localhost:3000
}

# ── Back-office Admin ────────────────────────────────────────
admin.nourplay.app {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "DENY"
    }
    reverse_proxy localhost:3001
}

# ── Backend API ──────────────────────────────────────────────
api.nourplay.app {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Access-Control-Allow-Credentials "true"
    }
    reverse_proxy localhost:4000 {
        header_up X-Forwarded-Proto https
        header_up X-Real-IP {remote_host}
    }
}
```

Rechargez Caddy pour activer la génération automatique des certificats TLS :
```bash
sudo systemctl reload caddy
```

---

#### 5.3.3 Déploiement de la stack via Docker Compose Prod

1. Créez le répertoire de production :
   ```bash
   sudo mkdir -p /opt/nourplay && sudo chown -R $USER:$USER /opt/nourplay
   cd /opt/nourplay
   ```
2. Clônez le dépôt et créez le fichier de production `.env` :
   ```bash
   git clone https://github.com/votre-orga/nourplay.git .
   cp .env.example .env
   # Remplir impérativement toutes les clés de production dans .env
   ```
3. Lancez la stack de conteneurs :
   ```bash
   # Téléchargement et compilation des conteneurs
   docker compose -f docker-compose.prod.yml up -d --build

   # Vérifier le statut des conteneurs
   docker compose -f docker-compose.prod.yml ps
   ```

---

#### 5.3.4 Stratégie de sauvegarde automatisée de PostgreSQL (S3 / R2)

Créez le script `/opt/nourplay/scripts/backup-db.sh` :

```bash
#!/bin/bash
set -eo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/opt/nourplay/backups"
BACKUP_FILE="${BACKUP_DIR}/nourplay_pg_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# 1. Dump et compression à la volée
docker exec -t nourplay-postgres pg_dump -U nourplay -d nourplay | gzip > "$BACKUP_FILE"

# 2. Upload vers Cloudflare R2 / AWS S3 chiffré
if command -v aws &> /dev/null; then
    aws s3 cp "$BACKUP_FILE" "s3://nourplay-backups/postgres/${TIMESTAMP}.sql.gz" --endpoint-url "$S3_ENDPOINT"
fi

# 3. Purge locale des sauvegardes de plus de 7 jours
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"
```

Rendez le script exécutable et planifiez-le dans le `crontab` :
```bash
chmod +x /opt/nourplay/scripts/backup-db.sh
# Ouvrir crontab
crontab -e
# Ajouter une sauvegarde quotidienne à 02h30 du matin
30 2 * * * /opt/nourplay/scripts/backup-db.sh >> /var/log/nourplay-backup.log 2>&1
```

---

### 5.4 Pipeline CI/CD GitHub Actions & Déploiement Continu

Le dépôt comprend un pipeline complet et sécurisé sous `.github/workflows/` :

1. **`ci.yml` (Intégration Continue) :**
   - Se déclenche sur chaque `push` et `pull_request`.
   - Exécute en parallèle : **Linting & Typecheck**, **Tests Unitaires Vitest**, **Tests d'intégration avec services PostgreSQL & Redis**, **Audit de vulnérabilité Trivy**.
2. **`e2e.yml` (Tests End-to-End) :**
   - Installe les navigateurs Playwright sous environnement conteneurisé et valide le parcours complet d'authentification, de création de profils et de lecture vidéo.
3. **`deploy.yml` (Déploiement Continu) :**
   - Construit les images Docker multi-stage optimisées et les publie sur **GitHub Container Registry (`ghcr.io`)**.
   - Déclenche le déploiement sécurisé sur le serveur de `Staging` (automatique) ou `Production` (après validation manuelle) via SSH sans interruption de service.

#### Secrets GitHub requis dans votre dépôt (`Settings > Secrets and variables > Actions`) :

| Nom du Secret | Description |
|---|---|
| `GHCR_READ_TOKEN` | Jeton d'accès GitHub Packages pour le téléchargement d'images |
| `PROD_SSH_HOST` | Adresse IP ou FQDN du serveur de production |
| `PROD_SSH_USER` | Utilisateur SSH de déploiement (ex: `deploy` ou `ubuntu`) |
| `PROD_SSH_KEY` | Clé privée SSH (Ed25519) autorisée sur le serveur |
| `CODECOV_TOKEN` | Jeton Codecov pour le reporting de couverture |

---

### 5.5 Monitoring, Observabilité et Alerting en Production

1. **Collecte des logs structurés (Loki + Pino) :**
   - L'API NestJS produit des logs JSON structurés avec correlation ID (`trace_id`, `span_id`).
   - Aucune donnée personnelle d'enfant (PII) n'est injectée dans les logs (pseudonymisation native).
2. **Traces distribuées (Tempo + OpenTelemetry) :**
   - Traçage du cycle de vie des requêtes HTTP et des jobs asynchrones BullMQ.
3. **Métriques système & métiers (Prometheus) :**
   - Taux d'erreurs HTTP 4xx/5xx, latence P95/P99, taille des queues BullMQ, taux de validation IA des vidéos.
4. **Alerting recommandé :**
   - Configurer un service externe de surveillance de disponibilité (ex: [Better Uptime](https://betteruptime.com) ou [UptimeRobot](https://uptimerobot.com)) pointant sur :
     - `https://nourplay.app`
     - `https://api.nourplay.app/api/health`
     - `https://admin.nourplay.app`
   - Alerte immédiate (SMS / Slack / PagerDuty) si le code HTTP n'est pas `200` pendant plus de 60 secondes.

---

### 5.6 Checklist de pré-mise en production (Go-Live Runbook)

Avant d'ouvrir la plateforme au public, vérifiez impérativement chaque point :

- [ ] **Sécurité & Cryptographie :**
  - [ ] Les clés `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` et `COOKIE_SECRET` font au moins 32 caractères aléatoires et sont distinctes.
  - [ ] `BCRYPT_ROUNDS` est configuré à `12`.
  - [ ] La politique CORS restreint strictement les origines autorisées aux domaines de production.
- [ ] **Base de données & Migrations :**
  - [ ] `pnpm db:migrate:prod` a été exécuté sans erreur.
  - [ ] Le pooling de connexions (PgBouncer) est actif pour absorber les pics de charge.
  - [ ] Le cron de sauvegarde quotidienne de PostgreSQL vers S3/R2 est testé et validé.
- [ ] **Conformité RGPD & Protection des mineurs :**
  - [ ] Les versions officielles des CGU, Mentions Légales et Politique de Confidentialité sont publiées via le back-office (`LegalDocument`).
  - [ ] Les formulaires de consentement parental et de double opt-in sont actifs.
  - [ ] Le registre des traitements et l'AIPD sont archivés et consultables par le DPO.
- [ ] **Intégrations Externes :**
  - [ ] Quotas YouTube API vérifiés et augmentés si nécessaire auprès de Google Cloud.
  - [ ] Clé OpenAI provisionnée avec limite de dépense mensuelle configurée.
  - [ ] Domaine d'envoi Resend validé (SPF, DKIM, DMARC au vert).
  - [ ] Webhooks Stripe validés avec le secret de signature en mode Live.
- [ ] **DNS & Réseau :**
  - [ ] Certificats SSL/TLS 1.3 valides avec HSTS activé.
  - [ ] Enregistrements DNS propagés (`nourplay.app`, `api.nourplay.app`, `admin.nourplay.app`, `assets.nourplay.app`).
- [ ] **Tests de bascule :**
  - [ ] Test d'inscription parent complet + validation d'email.
  - [ ] Test d'ajout d'une vidéo YouTube/Vimeo et passage par le worker de validation IA.
  - [ ] Test de verrouillage par code PIN et lecture en profil enfant.

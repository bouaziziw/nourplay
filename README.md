# NourPlay

> Plateforme de curation vidéo privée pour parents et enseignants

NourPlay est une plateforme web, mobile et TV permettant aux parents et enseignants de sélectionner, organiser et diffuser des vidéos éducatives adaptées aux enfants — sans jamais ré-uploader de contenu. Les vidéos restent hébergées sur leurs plateformes d'origine (YouTube, Vimeo, Dailymotion) et sont intégrées via lecteurs officiels embarqués.

**Cible :** familles et établissements scolaires, France et Europe en priorité — multilingue dès le premier commit (🇫🇷 🇬🇧 🇸🇦 🇪🇸).

---

## Table des matières

1. [Architecture](#1-architecture)
2. [Stack technique](#2-stack-technique)
3. [Prérequis](#3-prérequis)
4. [Installation locale (Docker Compose)](#4-installation-locale-docker-compose)
5. [Structure du projet](#5-structure-du-projet)
6. [Variables d'environnement](#6-variables-denvironnement)
7. [Commandes disponibles](#7-commandes-disponibles)
8. [API — Documentation](#8-api--documentation)
9. [Tests](#9-tests)
10. [Déploiement en production](#10-déploiement-en-production)
11. [CI/CD](#11-cicd)
12. [Conformité RGPD / CNIL](#12-conformité-rgpd--cnil)
13. [Roadmap](#13-roadmap)
14. [Contribuer](#14-contribuer)

---

## 1. Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Web (3000)  │  │ Admin (3001) │  │  Mobile (iOS / Android)  │  │
│  │  Next.js 14  │  │  Next.js 14  │  │    Expo / React Native   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
└─────────┼─────────────────┼───────────────────────┼────────────────┘
          │                 │                        │
          └─────────────────┴────────────────────────┘
                            │ HTTP / REST
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API (NestJS :4000)                            │
│                                                                     │
│  ┌────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Auth  │ │ User │ │ Playlist │ │  Video   │ │  Moderation  │   │
│  └────────┘ └──────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌─────────┐ ┌──────┐ ┌──────────────┐ ┌───────────┐              │
│  │ Consent │ │ GDPR │ │ Notification │ │   Admin   │              │
│  └─────────┘ └──────┘ └──────────────┘ └───────────┘              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           BullMQ Jobs (Redis)                               │   │
│  │  video-validation  •  email-send  •  gdpr-export            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────────────────┘
             │
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
┌────────────┐  ┌─────────────┐
│ PostgreSQL  │  │    Redis    │
│    :5432    │  │    :6379    │
└────────────┘  └─────────────┘
                               
┌──────────────────────────────┐
│      Services externes       │
│  YouTube API  •  Vimeo API   │
│  OpenAI (modération vidéo)     │
│  Resend (email)              │
│  S3 / Cloudflare R2          │
└──────────────────────────────┘
```

### Diagramme des composants (Mermaid)

```mermaid
graph TB
  subgraph Clients
    W[Web — Next.js 14<br/>:3000]
    A[Admin — Next.js 14<br/>:3001]
    M[Mobile — Expo<br/>iOS / Android]
  end

  subgraph API["API — NestJS :4000"]
    Auth[Auth<br/>JWT · 2FA · OAuth]
    Users[User<br/>Profiles · PIN]
    Playlists[Playlist<br/>Share · Reorder]
    Videos[Video<br/>Submit · Search]
    Moderation[Moderation<br/>AI · Reports]
    GDPR[GDPR<br/>Export · Delete]
    Consent[Consent<br/>RGPD Records]
    Notifications[Notification]
    AdminMod[Admin<br/>RBAC]
  end

  subgraph Workers
    VV[video-validator<br/>BullMQ + OpenAI]
  end

  subgraph Data
    PG[(PostgreSQL 16)]
    RD[(Redis 7)]
  end

  subgraph External
    YT[YouTube Data API]
    VM[Vimeo API]
    AI[OpenAI]
    EM[Resend Email]
    S3[S3 / R2 Storage]
  end

  W & A & M -->|REST /api/v1| API
  API -->|BullMQ| RD
  API -->|Prisma| PG
  VV -->|Consume queue| RD
  VV -->|Update status| PG
  VV -->|Analyse| AI
  Videos -->|Metadata| YT & VM
  Notifications -->|Email| EM
  Users -->|Avatar| S3
```

### Modèle de données — Entités principales

| Entité | Description |
|---|---|
| `User` | Compte adulte (parent / enseignant), soft delete, 2FA, OAuth |
| `ChildProfile` | Profil enfant avec PIN, groupe d'âge, limites temps, planning horaire |
| `RefreshToken` | Tokens JWT avec fingerprint et rotation automatique |
| `VideoSource` | Configuration des plateformes source (YouTube, Vimeo…) |
| `Video` | Métadonnées vidéo, statut de validation IA, note d'âge |
| `Tag` | Tags multilingues |
| `Playlist` | Collection de vidéos, visibilité, groupes d'âge cibles, partage |
| `PlaylistVideo` | Lien ordonné vidéo ↔ playlist |
| `PlaylistAccess` | Permissions de partage par utilisateur (VIEWER / EDITOR) |
| `Category` | Catégories et sous-catégories dans les playlists |
| `WatchHistory` | Historique de visionnage par profil enfant |
| `UserBlock` | Listes blanches / noires de chaînes et mots-clés |
| `ConsentRecord` | Enregistrement des consentements RGPD avec versionnement |
| `GdprRequest` | Demandes d'export ou de suppression de données |
| `VideoReport` | Signalements de contenu par les utilisateurs |
| `Notification` | Notifications in-app et email |
| `AuditLog` | Journal d'audit immuable (insert-only) |

---

## 2. Stack technique

| Domaine | Technologie | Justification |
|---|---|---|
| **Web / Admin** | Next.js 14 (App Router) | SSR/SSG, routing intégré, Turbopack |
| **Mobile** | Expo 53 / React Native 0.79 | Base de code unifiée iOS / Android |
| **Backend** | NestJS 10 (TypeScript) | Cohérence TypeScript full-stack, modules/décorateurs structurants |
| **ORM** | Prisma 5 | Type-safety bout-en-bout, migrations versionnées |
| **Base de données** | PostgreSQL 16 | Relationnel robuste, recherche plein texte native |
| **Cache / Sessions** | Redis 7 | Files BullMQ, blacklist tokens, sessions |
| **File de jobs** | BullMQ | Validation IA, envoi emails, export RGPD |
| **Email** | Resend | API REST simple, templates réactifs |
| **Stockage objets** | S3 / Cloudflare R2 | Avatars, thumbnails — jamais les vidéos |
| **Validation IA** | OpenAI `gpt-4o-mini` | Sortie contrôlée; preuve média incomplète = revue humaine |
| **Auth** | Argon2id · JWT · TOTP · OAuth Google | Argon2id = winner PHC, résistant GPU |
| **I18n** | next-intl | fr · en · ar · es, RTL natif pour l'arabe |
| **Tests** | Vitest · Playwright · Supertest | Unit, E2E web, intégration API |
| **CI/CD** | GitHub Actions | Pipeline lint → test → build → security |
| **Observabilité** | OpenTelemetry | Traces, logs structurés, métriques |
| **Monorepo** | Turborepo + pnpm workspaces | Cache de build incrémental, scripts parallèles |

---

## 3. Prérequis

| Outil | Version minimale | Installation |
|---|---|---|
| **Node.js** | 20 LTS | [nodejs.org](https://nodejs.org) |
| **pnpm** | 9.x | `npm install -g pnpm` |
| **Docker Desktop** | 4.x | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com) |

> Les clés API externes (YouTube, Vimeo, OpenAI, Resend) sont **optionnelles** pour le démarrage local — sans clé OpenAI, la validation bascule en revue humaine.

---

## 4. Installation locale (Docker Compose)

### Étape 1 — Cloner le dépôt

```bash
git clone https://github.com/<org>/nourplay.git
cd nourplay
```

### Étape 2 — Copier les variables d'environnement

```bash
cp .env.example .env
```

Seules les valeurs suivantes sont **obligatoires** pour démarrer :

```env
# Générés automatiquement par Docker Compose
DATABASE_URL=postgresql://nourplay:secret@localhost:5432/nourplay
DATABASE_URL_TEST=postgresql://nourplay:secret@localhost:5432/nourplay_test
REDIS_URL=redis://:secret@localhost:6379

# À changer dès la première utilisation (min 32 caractères)
JWT_ACCESS_SECRET=changeme-dev-access-secret-min-32-chars
JWT_REFRESH_SECRET=changeme-dev-refresh-secret-min-32-chars
COOKIE_SECRET=changeme-dev-cookie-secret-min-32-chars
```

### Étape 3 — Démarrer l'infrastructure

```bash
# Lance PostgreSQL, Redis, Adminer, Redis Commander, MailHog
docker compose up -d
```

Vérifier que tous les services sont `healthy` :

```bash
docker compose ps
```

Interfaces disponibles après démarrage :

| Service | URL |
|---|---|
| Adminer (DB UI) | http://localhost:8080 |
| Redis Commander | http://localhost:8081 |
| MailHog (emails) | http://localhost:8025 |

### Étape 4 — Installer les dépendances

```bash
pnpm install
```

### Étape 5 — Préparer la base de données

```bash
# Applique les migrations et génère le client Prisma
pnpm db:migrate

# Insère les données de test (sources vidéo, rôles, consentements)
pnpm db:seed
```

### Étape 6 — Démarrer les applications en développement

```bash
# Démarre toutes les apps en parallèle via Turborepo
pnpm dev
```

| Application | URL |
|---|---|
| Web (parents/enseignants) | http://localhost:3000 |
| Admin (back-office) | http://localhost:3001 |
| API NestJS | http://localhost:4000/api |
| Swagger (dev uniquement) | http://localhost:4000/api/docs |

> **Tip :** pour démarrer uniquement une app spécifique :
>
> ```bash
> pnpm --filter @nourplay/api dev      # API seule
> pnpm --filter nourplay-web dev       # Web seul
> pnpm --filter nourplay-admin dev     # Admin seul
> ```

### Étape 7 — Démarrer le worker de validation IA

Le worker doit rester lancé en parallèle de l'API pour traiter immédiatement les vidéos approuvées.
La commande `pnpm dev` le lance automatiquement avec les autres applications. Pour le lancer seul :

```bash
pnpm --filter @nourplay/video-validator dev
```

> Sans clé `OPENAI_API_KEY`, ou si l’analyse est invalide/incomplète, le worker passe la vidéo en `NEEDS_REVIEW`. Les métadonnées et une miniature ne suffisent jamais à approuver une vidéo sans échantillonnage vidéo et transcription audio fiables.

---

## 5. Structure du projet

```
nourplay/
├── apps/
│   ├── admin/              # Back-office administrateur (Next.js 14)
│   │   └── src/app/
│   │       ├── dashboard/
│   │       │   ├── users/          # Gestion utilisateurs
│   │       │   ├── moderation/     # File de modération + rapports
│   │       │   └── audit/          # Journal d'audit
│   │       └── login/
│   ├── mobile/             # Application iOS / Android (Expo 53)
│   │   └── src/
│   │       ├── screens/            # Écrans React Native
│   │       ├── navigation/         # React Navigation
│   │       ├── components/         # Composants natifs
│   │       ├── hooks/              # Hooks personnalisés
│   │       └── api/                # Client API
│   └── web/                # Interface parent / enseignant (Next.js 14)
│       ├── e2e/                    # Tests Playwright
│       ├── messages/               # Traductions (fr, en, ar, es)
│       └── src/
│           ├── app/[locale]/
│           │   ├── (auth)/         # Login, register, vérification
│           │   ├── (dashboard)/    # Playlists, vidéos, profils
│           │   └── (child)/        # Interface enfant (accès restreint)
│           ├── components/         # VideoPlayer, PinModal, etc.
│           ├── hooks/              # useAuth, useChildSession
│           ├── lib/api.ts          # Client API typé
│           └── middleware.ts       # Auth + locale detection
│
├── packages/
│   ├── api/                # API NestJS
│   │   └── src/
│   │       ├── common/             # Guards, décorateurs, Prisma, Redis, BullMQ
│   │       └── modules/
│   │           ├── auth/           # Auth, JWT, 2FA, OAuth, reset password
│   │           ├── user/           # Profils enfants, historique, PIN
│   │           ├── playlist/       # CRUD + partage
│   │           ├── video/          # Soumission, recherche, reporting
│   │           ├── moderation/     # IA, approbation/rejet
│   │           ├── consent/        # Consentements RGPD
│   │           ├── gdpr/           # Export + suppression données
│   │           ├── notification/   # In-app + email
│   │           └── admin/          # Gestion utilisateurs, audit
│   ├── db/                 # Prisma (schéma + migrations)
│   │   └── prisma/
│   │       ├── schema.prisma       # 17 modèles, 9 enums
│   │       ├── migrations/         # Migrations versionnées
│   │       └── generated/          # Client Prisma auto-généré
│   ├── i18n/               # Configuration next-intl (fr/en/ar/es)
│   └── ui/                 # Composants React partagés (Button, Input, VideoCard…)
│
├── workers/
│   └── video-validator/    # Worker BullMQ — pipeline validation IA
│
├── docs/
│   ├── phases/             # Documentation de chaque phase de développement
│   ├── architecture/       # Schémas et décisions d'architecture
│   └── compliance/         # Documentation RGPD / CNIL
│
├── .github/workflows/ci.yml    # Pipeline CI/CD
├── docker-compose.yml          # Environnement de développement local
├── docker-compose.prod.yml     # Déploiement production
├── .env.example                # Template des variables d'environnement
├── turbo.json                  # Configuration Turborepo
├── pnpm-workspace.yaml         # Workspaces pnpm
└── tsconfig.base.json          # TypeScript base partagé
```

---

## 6. Variables d'environnement

Copier `.env.example` → `.env` et renseigner les valeurs. Les colonnes **Requis** et **Défaut** indiquent si la variable est obligatoire pour démarrer en local.

### Application

| Variable | Défaut | Requis | Description |
|---|---|---|---|
| `NODE_ENV` | `development` | — | Environnement d'exécution |
| `APP_NAME` | `NourPlay` | — | Nom de l'application |
| `APP_URL` | `http://localhost:3000` | — | URL publique web |
| `API_URL` | `http://localhost:4000` | — | URL publique API |
| `ADMIN_URL` | `http://localhost:3001` | — | URL back-office |

### Base de données

| Variable | Exemple | Requis | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://nourplay:secret@localhost:5432/nourplay` | ✅ | URL PostgreSQL principale |
| `DATABASE_URL_TEST` | `…/nourplay_test` | Tests | URL PostgreSQL pour les tests d'intégration |

### Redis

| Variable | Exemple | Requis | Description |
|---|---|---|---|
| `REDIS_URL` | `redis://:secret@localhost:6379` | ✅ | URL Redis (sessions + BullMQ) |

### Authentification — JWT

| Variable | Défaut | Requis | Description |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | — | ✅ | Secret token d'accès (≥ 32 chars) |
| `JWT_REFRESH_SECRET` | — | ✅ | Secret refresh token (≥ 32 chars) |
| `JWT_ACCESS_TTL` | `900` | — | Durée access token en secondes (15 min) |
| `JWT_REFRESH_TTL` | `604800` | — | Durée refresh token en secondes (7 jours) |
| `COOKIE_SECRET` | — | ✅ | Secret de signature des cookies (≥ 32 chars) |

### Authentification — 2FA (TOTP)

| Variable | Défaut | Description |
|---|---|---|
| `TOTP_APP_NAME` | `NourPlay` | Nom affiché dans l'app TOTP (Google Authenticator…) |
| `TOTP_ISSUER` | `NourPlay` | Émetteur TOTP |

### Authentification — OAuth Google

| Variable | Requis | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth | Client ID Google OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | OAuth | Client Secret Google OAuth 2.0 |
| `GOOGLE_CALLBACK_URL` | OAuth | `http://localhost:4000/auth/google/callback` |

> Obtenir les credentials sur [Google Cloud Console](https://console.cloud.google.com/).

### Email (Resend)

| Variable | Description |
|---|---|
| `EMAIL_PROVIDER` | Fournisseur email (`resend`) |
| `EMAIL_FROM` | Adresse expéditeur |
| `RESEND_API_KEY` | Clé API Resend — [resend.com](https://resend.com) |

> Sans cette clé, les emails sont capturés par MailHog (`localhost:8025`).

### Stockage S3 / Cloudflare R2

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | URL endpoint S3 ou R2 |
| `S3_ACCESS_KEY_ID` | Clé d'accès |
| `S3_SECRET_ACCESS_KEY` | Clé secrète |
| `S3_BUCKET` | Nom du bucket (`nourplay-assets`) |
| `S3_PUBLIC_URL` | URL publique CDN des assets |

### Sources vidéo

| Variable | Description |
|---|---|
| `YOUTUBE_API_KEY` | YouTube Data API v3 — [console.cloud.google.com](https://console.cloud.google.com) |
| `VIMEO_ACCESS_TOKEN` | Token OAuth Vimeo — [developer.vimeo.com](https://developer.vimeo.com) |

> Sans ces clés, les vidéos sont créées avec les métadonnées minimales (URL uniquement).

### Validation IA (OpenAI)

| Variable | Défaut | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Clé API OpenAI |
| `AI_MODERATION_MODEL` | `gpt-4o-mini` | Modèle de modération |
| `OPENAI_TIMEOUT_MS` | `45000` | Timeout de l'analyse |

### Observabilité (OpenTelemetry)

| Variable | Défaut | Description |
|---|---|---|
| `OTEL_SERVICE_NAME` | `nourplay-api` | Nom du service dans les traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Endpoint OTLP (Grafana Agent, Jaeger…) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | Protocole OTLP |

### Sécurité

| Variable | Défaut | Description |
|---|---|---|
| `RATE_LIMIT_TTL` | `60` | Fenêtre de rate limiting en secondes |
| `RATE_LIMIT_MAX` | `100` | Nombre maximum de requêtes par fenêtre |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Origines CORS autorisées (séparées par virgule) |
| `BCRYPT_ROUNDS` | `12` | Rounds bcrypt (non utilisé — Argon2id est le défaut) |

---

## 7. Commandes disponibles

### Développement

```bash
pnpm dev                    # Démarrer toutes les apps en parallèle
pnpm build                  # Build de production (Turborepo)
pnpm lint                   # ESLint sur tout le monorepo
pnpm typecheck              # tsc --noEmit sur tous les packages
pnpm format                 # Prettier sur TS/TSX/JSON/MD
```

### Base de données

```bash
pnpm db:migrate             # Appliquer les migrations (dev)
pnpm db:migrate:prod        # Appliquer les migrations (production)
pnpm db:seed                # Insérer les données initiales
pnpm db:studio              # Ouvrir Prisma Studio (interface BDD)
```

### Tests

```bash
pnpm test                   # Tous les tests unitaires (Vitest)
pnpm test:e2e               # Tests d'intégration API + Playwright web
pnpm --filter @nourplay/api test          # Tests unitaires API seuls
pnpm --filter @nourplay/api test:e2e      # Tests intégration API (nécessite DB)
pnpm --filter nourplay-web test:e2e       # Tests Playwright web
```

### Tests E2E mobile (Maestro)

```bash
# Installer Maestro CLI (une fois)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Copier et remplir les credentials de test
cp apps/mobile/.maestro/.env.example apps/mobile/.maestro/.env

# Lancer l'émulateur / simulateur puis l'app
cd apps/mobile && pnpm start

# Dans un autre terminal : lancer tous les flows
pnpm --filter @nourplay/mobile test:e2e

# Ou un flow individuel
maestro test apps/mobile/.maestro/flows/01_login.yaml
```

Les flows Maestro se trouvent dans [apps/mobile/.maestro/flows/](apps/mobile/.maestro/flows/) :

| Flow | Scénario couvert |
|---|---|
| `01_login.yaml` | Connexion email/mot de passe → sélecteur de profils |
| `02_parent_navigation.yaml` | Navigation par onglets (Accueil, Playlists, Vidéos, Compte) |
| `03_video_library.yaml` | Recherche dans la vidéothèque parentale |
| `04_child_mode.yaml` | Sélection de profil + saisie PIN → mode enfant → sortie |

### Docker

```bash
docker compose up -d        # Démarrer l'infra locale (PG, Redis, Adminer…)
docker compose down         # Arrêter et supprimer les conteneurs
docker compose down -v      # Supprimer aussi les volumes (données perdues)
docker compose logs -f api  # Suivre les logs d'un service
```

### Utilitaires

```bash
pnpm --filter @nourplay/db generate     # Régénérer le client Prisma
pnpm --filter @nourplay/db studio       # Prisma Studio
pnpm --filter video-validator dev       # Worker de validation IA
```

---

## 8. API — Documentation

### Swagger (Développement)

La documentation Swagger interactive est disponible en développement et staging :

```
http://localhost:4000/api/docs
```

### Format des réponses

Toutes les réponses suivent le format standard :

```json
{
  "data": { ... },
  "meta": { "timestamp": "2026-05-27T10:00:00.000Z" }
}
```

Les erreurs retournent :

```json
{
  "statusCode": 400,
  "message": "Description de l'erreur",
  "error": "Bad Request"
}
```

### Versioning

L'API est versionnée via le préfixe d'URL :

```
/api/v1/<resource>
```

### Authentification

La plupart des routes requièrent un Bearer Token JWT :

```http
Authorization: Bearer <access_token>
```

Le refresh token est transmis via un cookie HttpOnly `refresh_token`.

### Endpoints principaux

#### Auth

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Créer un compte | Public |
| `POST` | `/api/v1/auth/login` | Se connecter | Public |
| `POST` | `/api/v1/auth/logout` | Se déconnecter | ✅ |
| `POST` | `/api/v1/auth/refresh` | Renouveler les tokens | Cookie |
| `GET` | `/api/v1/auth/verify-email` | Vérifier l'email | Public |
| `POST` | `/api/v1/auth/forgot-password` | Demander reset mdp | Public |
| `POST` | `/api/v1/auth/reset-password` | Réinitialiser mdp | Public |
| `POST` | `/api/v1/auth/2fa/setup` | Activer le TOTP | ✅ |
| `POST` | `/api/v1/auth/2fa/verify` | Vérifier code TOTP | ✅ |
| `GET` | `/api/v1/auth/google` | Redirect OAuth Google | Public |
| `GET` | `/api/v1/auth/google/callback` | Callback OAuth Google | Public |

#### Utilisateurs & Profils enfants

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Profil de l'utilisateur connecté | ✅ |
| `PATCH` | `/api/v1/users/me` | Modifier son profil | ✅ |
| `DELETE` | `/api/v1/users/me` | Supprimer son compte | ✅ |
| `GET` | `/api/v1/users/me/profiles` | Lister les profils enfants | ✅ |
| `POST` | `/api/v1/users/me/profiles` | Créer un profil enfant | ✅ |
| `GET` | `/api/v1/users/me/profiles/:id` | Détail d'un profil | ✅ |
| `PATCH` | `/api/v1/users/me/profiles/:id` | Modifier un profil | ✅ |
| `DELETE` | `/api/v1/users/me/profiles/:id` | Supprimer un profil (soft) | ✅ |
| `POST` | `/api/v1/users/me/profiles/:id/verify-pin` | Vérifier le PIN | ✅ |
| `GET` | `/api/v1/users/me/profiles/:id/history` | Historique de visionnage | ✅ |
| `DELETE` | `/api/v1/users/me/profiles/:id/history` | Effacer l'historique | ✅ |

#### Playlists

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/playlists` | Lister ses playlists | ✅ |
| `POST` | `/api/v1/playlists` | Créer une playlist | ✅ |
| `GET` | `/api/v1/playlists/:id` | Détail + vidéos | ✅ / Public |
| `PATCH` | `/api/v1/playlists/:id` | Modifier | ✅ Owner |
| `DELETE` | `/api/v1/playlists/:id` | Supprimer (soft) | ✅ Owner |
| `POST` | `/api/v1/playlists/:id/videos` | Ajouter une vidéo | ✅ Owner/Editor |
| `DELETE` | `/api/v1/playlists/:id/videos/:videoId` | Retirer une vidéo | ✅ Owner/Editor |
| `PATCH` | `/api/v1/playlists/:id/videos/reorder` | Réordonner les vidéos | ✅ Owner/Editor |
| `POST` | `/api/v1/playlists/:id/share` | Partager avec un utilisateur | ✅ Owner |
| `DELETE` | `/api/v1/playlists/:id/share/:userId` | Révoquer l'accès | ✅ Owner |
| `POST` | `/api/v1/playlists/:id/share-link` | Générer un lien de partage | ✅ Owner |
| `GET` | `/api/v1/public/playlists/:token` | Voir une playlist partagée | Public |

#### Vidéos

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/videos/search` | Rechercher des vidéos | ✅ |
| `GET` | `/api/v1/videos/:id` | Détail d'une vidéo | ✅ |
| `POST` | `/api/v1/videos` | Soumettre une URL vidéo | ✅ |
| `POST` | `/api/v1/videos/:id/report` | Signaler une vidéo | ✅ |

#### Modération (MODERATOR / ADMIN)

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/moderation/queue` | File d'attente de modération | MODERATOR+ |
| `POST` | `/api/v1/moderation/:id/approve` | Approuver une vidéo | MODERATOR+ |
| `POST` | `/api/v1/moderation/:id/reject` | Rejeter une vidéo | MODERATOR+ |
| `GET` | `/api/v1/moderation/reports` | Signalements utilisateurs | MODERATOR+ |
| `POST` | `/api/v1/moderation/reports/:id/resolve` | Résoudre un signalement | MODERATOR+ |

#### Consentement RGPD

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/consent` | Enregistrer un consentement | ✅ |
| `DELETE` | `/api/v1/consent/:type` | Révoquer un consentement | ✅ |
| `GET` | `/api/v1/consent/current` | Consentements en cours | ✅ |
| `GET` | `/api/v1/consent/history` | Historique des consentements | ✅ |

#### RGPD — Droits des personnes

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/gdpr/export` | Demander l'export de données | ✅ |
| `POST` | `/api/v1/gdpr/delete` | Demander la suppression du compte | ✅ |
| `GET` | `/api/v1/gdpr/requests/:id` | Statut d'une demande | ✅ |
| `GET` | `/api/v1/gdpr/my-data` | Accès immédiat aux données personnelles | ✅ |

#### Notifications

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Lister les notifications | ✅ |
| `PATCH` | `/api/v1/notifications/:id/read` | Marquer comme lu | ✅ |
| `DELETE` | `/api/v1/notifications/:id` | Supprimer | ✅ |

#### Administration (ADMIN uniquement)

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | Lister tous les utilisateurs | ADMIN |
| `GET` | `/api/v1/admin/users/:id` | Détail utilisateur | ADMIN |
| `PATCH` | `/api/v1/admin/users/:id/role` | Modifier le rôle | ADMIN |
| `DELETE` | `/api/v1/admin/users/:id` | Désactiver un compte | ADMIN |
| `GET` | `/api/v1/admin/audit-logs` | Journal d'audit | ADMIN |

---

## 9. Tests

### Stratégie de tests

```
┌─────────────────────────────────────────────┐
│  Tests unitaires (Vitest)                   │
│  packages/api/src/**/*.spec.ts              │
│  Couverture cible : 70% lignes/fonctions    │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Tests d'intégration API (Vitest + Supertest)│
│  packages/api/test/**/*.e2e-spec.ts         │
│  Base de données PostgreSQL réelle          │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Tests E2E Web (Playwright)                 │
│  apps/web/e2e/**/*.spec.ts                  │
│  Navigateur Chromium, locale fr-FR          │
└─────────────────────────────────────────────┘
```

### Exécution des tests unitaires

```bash
# Tous les tests unitaires
pnpm test

# Avec couverture de code
pnpm --filter @nourplay/api exec vitest run --coverage

# En mode watch (développement)
pnpm --filter @nourplay/api exec vitest
```

### Tests d'intégration API

Les tests d'intégration nécessitent une base PostgreSQL et Redis en cours d'exécution.

```bash
# Démarrer l'infra de test
docker compose up -d postgres redis

# Lancer les tests d'intégration
pnpm --filter @nourplay/api test:e2e
```

### Tests E2E Playwright

```bash
# Nécessite l'application en cours d'exécution (pnpm dev)
pnpm --filter nourplay-web test:e2e

# Avec interface graphique Playwright
pnpm --filter nourplay-web exec playwright test --ui

# Générer un rapport HTML
pnpm --filter nourplay-web exec playwright show-report
```

### Seuils de couverture (API)

| Métrique | Seuil |
|---|---|
| Lines | 70% |
| Functions | 70% |
| Statements | 70% |
| Branches | 60% |

---

## 10. Déploiement en production

### Prérequis infrastructure

- Serveur Linux (Ubuntu 22.04 LTS recommandé) ou cluster Kubernetes
- Docker Engine + Docker Compose v2
- Domaine avec certificat TLS (Let's Encrypt ou équivalent)
- Variables d'environnement stockées dans un gestionnaire de secrets (Vault, Doppler, AWS Secrets Manager…)

### Étape 1 — Préparer les variables d'environnement de production

```env
NODE_ENV=production
APP_URL=https://nourplay.app
API_URL=https://api.nourplay.app
ADMIN_URL=https://admin.nourplay.app

DATABASE_URL=postgresql://nourplay:<PASSWORD>@<DB_HOST>:5432/nourplay
REDIS_URL=redis://:<PASSWORD>@<REDIS_HOST>:6379

# Secrets forts générés pour la production
JWT_ACCESS_SECRET=<secret-min-64-chars>
JWT_REFRESH_SECRET=<secret-min-64-chars>
COOKIE_SECRET=<secret-min-64-chars>

# Services externes
RESEND_API_KEY=<production-key>
YOUTUBE_API_KEY=<production-key>
OPENAI_API_KEY=<production-key>

# CORS restreint aux domaines de production
CORS_ORIGINS=https://nourplay.app,https://admin.nourplay.app
```

> **Sécurité :** ne jamais commit les secrets en clair. Utiliser des variables d'environnement injectées par le CI/CD ou un gestionnaire de secrets.

### Étape 2 — Build et déploiement Docker

```bash
# Construire les images de production
docker compose -f docker-compose.prod.yml build

# Démarrer (migrations auto avant l'API)
docker compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs -f
```

### Services Docker en production

| Service | Image | Port | Description |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 (interne) | Base de données |
| `redis` | `redis:7-alpine` | 6379 (interne) | Cache + queues |
| `migrate` | `api` | — | Migration Prisma (one-shot) |
| `api` | `packages/api` | 4000 | API NestJS |
| `web` | `apps/web` | 3000 | Next.js Web |

### Étape 3 — Reverse proxy (Nginx / Caddy)

Exemple de configuration Caddy :

```caddyfile
nourplay.app {
  reverse_proxy web:3000
}

api.nourplay.app {
  reverse_proxy api:4000
}

admin.nourplay.app {
  reverse_proxy admin:3001
}
```

### Étape 4 — Migrations de production

Les migrations sont appliquées automatiquement par le service `migrate` au démarrage via `docker-compose.prod.yml`. Pour les appliquer manuellement :

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
# ou en direct dans le conteneur api :
docker exec -it nourplay-api pnpm db:migrate:prod
```

### Surveillance et maintenance

```bash
# Santé des services
docker compose -f docker-compose.prod.yml ps

# Mise à jour sans interruption (rolling update)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --no-deps api web

# Backup de la base de données
docker exec nourplay-postgres pg_dump -U nourplay nourplay > backup_$(date +%Y%m%d).sql
```

---

## 11. CI/CD

### Pipeline GitHub Actions

Le fichier [.github/workflows/ci.yml](.github/workflows/ci.yml) définit 6 jobs déclenchés sur chaque push et pull request vers `main` / `develop` :

```
push / PR
    │
    ├── lint ──────────────────────────────────────────┐
    │   └── ESLint + TypeScript (pnpm lint typecheck)  │
    │                                                   ├── build ──── deploy-staging
    ├── test-unit ─────────────────────────────────────┘   (main only)
    │   └── Vitest + coverage → Codecov
    │
    ├── test-integration
    │   └── Vitest E2E API (services : postgres + redis)
    │
    └── security
        ├── pnpm audit (vulnérabilités npm)
        └── Trivy (scan image Docker — CRITICAL/HIGH)
```

### Variables secrets GitHub requises

À configurer dans **Settings → Secrets and variables → Actions** :

| Secret | Description |
|---|---|
| `DATABASE_URL` | URL PostgreSQL de test |
| `DATABASE_URL_TEST` | URL PostgreSQL de test isolation |
| `REDIS_URL` | URL Redis de test |
| `JWT_ACCESS_SECRET` | Secret JWT pour les tests |
| `JWT_REFRESH_SECRET` | Secret JWT pour les tests |
| `COOKIE_SECRET` | Secret cookie pour les tests |
| `CODECOV_TOKEN` | Token Codecov (couverture de code) |

---

## 12. Conformité RGPD / CNIL

NourPlay a été conçu avec le principe de **Privacy by Design** conformément au RGPD et aux recommandations de la CNIL, notamment pour les services traitant des données de mineurs.

### Minimisation des données

- `ChildProfile.birthYear` : seule l'**année de naissance** est stockée (pas la date complète)
- Pas de tracking comportemental fin sur les enfants
- Métriques d'usage **anonymisées et agrégées** uniquement

### Consentement

- Enregistrement de chaque consentement avec : version du texte, horodatage, IP hashée (SHA-256 non réversible), user-agent
- Types de consentement gérés : `TERMS`, `PRIVACY`, `COOKIE_ANALYTICS`, `COOKIE_FUNCTIONAL`, `PARENTAL_CONSENT`
- Révocation possible à tout moment (`DELETE /api/v1/consent/:type`)
- Double opt-in pour les comptes enfants

### Droits des personnes

| Droit | Implémentation |
|---|---|
| Accès aux données | `GET /api/v1/gdpr/my-data` — export JSON immédiat |
| Portabilité | `POST /api/v1/gdpr/export` — export complet asynchrone |
| Effacement | `POST /api/v1/gdpr/delete` — suppression en cascade + soft delete |
| Rectification | `POST /api/v1/gdpr/rectification` |
| Historique de visionnage | `DELETE /api/v1/users/me/profiles/:id/history` |

### Sécurité des données

- **Soft delete** sur `User` et `ChildProfile` : les données sont conservées le temps légal avant suppression définitive
- **AuditLog** immuable : insert-only, aucun UPDATE/DELETE autorisé en application
- Chiffrement du `twoFactorSecret` en base (application-level encryption)
- Tokens de refresh hashés en base (le token brut n'est jamais persisté)
- **Argon2id** pour les mots de passe et PINs enfants (64 MB mémoire, 3 itérations)

### Validation du contenu

Pipeline de validation IA avant publication :
1. Chaque vidéo soumise, y compris depuis une playlist, est envoyée automatiquement dans BullMQ.
2. OpenAI renvoie une décision, une confiance, des violations horodatées et son analyse audio.
3. Approbation seulement avec une confiance élevée, un âge compatible et des preuves vidéo/audio complètes.
4. Rejet seulement si une violation grave avec preuve est suffisamment certaine; les cas ambigus vont en `NEEDS_REVIEW`.
5. Erreur fournisseur, sortie invalide ou analyse média incomplète → `NEEDS_REVIEW`.

Le worker actuel ne reçoit qu'une miniature et les métadonnées; il n'extrait pas encore de frames ni de transcript. Il ne peut donc pas approuver automatiquement une vidéo sur ces seules preuves. Chaque vidéo d'une playlist est évaluée séparément.

Seules les vidéos avec statut `APPROVED` sont visibles dans les playlists partagées.

### Vérification des sources

Chaque `VideoSource` dispose d'un champ `embedPolicy` et `cguVersion` permettant de tracer la version des CGU acceptées lors de la configuration de la source. Les vidéos dont la source a une politique d'embed restrictive sont bloquées à la soumission.

### Journal d'audit

Toutes les actions sensibles (connexion, modification de rôle, accès aux données personnelles, décisions de modération) sont enregistrées dans `AuditLog` avec : acteur, rôle, action, IP, user-agent, timestamp.

---

## 13. Roadmap

### Phase MVP — Phases 1 à 7 ✅ Complétées

| Phase | Contenu |
|---|---|
| 01 | Initialisation monorepo, schéma BDD complet, infrastructure Docker, CI/CD |
| 02 | API core : profils enfants, playlists, vidéos, soumission, consentement RGPD |
| 03 | Auth complète : vérification email, 2FA TOTP, OAuth Google, tests intégration |
| 04 | Back-office : modération, notifications, historique de visionnage |
| 05A | Interface enfant : lecteur vidéo, navigation restreinte, mode enfant |
| 05B | Interface parent : gestion des profils, constructeur de playlists, vidéothèque |
| 05C | Application mobile (Expo) : interface enfant iOS / Android |
| 05D | Dashboard administrateur : utilisateurs, modération, audit |
| 06 | Partage de playlists, notifications, page compte RGPD |
| 07 | Visionneuse de playlists publiques, tests E2E Playwright complets |

### Phase V1 — En cours / Planifié

| Phase | Contenu | Statut |
|---|---|---|
| 08 | Filtres de contenu, notifications email automatiques sur revue | ✅ |
| 09 | Reset mot de passe, pages 2FA complètes | ✅ |
| 10 | Ajout à playlist depuis la vidéothèque, interface de signalement | ✅ |
| 11 | Dockerfiles production, docker-compose.prod | ✅ |
| 12 | Page d'accueil publique (landing page) avec i18n | ✅ |
| 13 | Tests unitaires vidéos, playlists, services utilisateurs | ✅ |
| 14 | Analytiques de visionnage sur les profils enfants | ✅ |
| 15 | Support TV (Android TV / Apple TV) — nécessite react-native-tvos, hors Expo managed workflow | 🚧 Hors scope |
| 16 | Magic link authentication | ✅ |
| 17 | Favoris par profil enfant (API + schéma) | ✅ |
| 18 | Stack d'observabilité complète (Grafana + Loki + Tempo + Prometheus) | ✅ |
| 19 | Application mobile complète (navigation adulte, playlists, recherche) | ✅ |
| 20 | Tests E2E mobile avec Maestro (compatible Expo managed workflow, remplace Detox) | ✅ |

### Phase Scale — Long terme

| Objectif | Description |
|---|---|
| **Abonnements premium** | Système d'abonnement avec Stripe (socle technique en place) |
| **Scaling horizontal** | Kubernetes, HPA, read replicas PostgreSQL |
| **CDN assets** | Cloudflare CDN pour thumbnails et assets statiques |
| **Recommandations curatoriales** | Suggestions basées sur les playlists de l'adulte (pas d'algo opaque) |
| **Import de playlists** | Import depuis YouTube, Vimeo en masse |
| **API partenaires** | Intégration établissements scolaires (SSO, SAML) |
| **Conformité DSA / CSAM** | Conformité Digital Services Act, détection CSAM |

---

## 14. Contribuer

### Convention de commits

Ce projet suit la convention **[Conventional Commits](https://www.conventionalcommits.org/)** :

```
<type>(<scope>): <description>

[body optionnel]

[footer optionnel]
```

**Types autorisés :**

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `style` | Formatage, pas de changement logique |
| `refactor` | Refactoring sans nouvelle fonctionnalité ni bug |
| `test` | Ajout ou modification de tests |
| `chore` | Maintenance, dépendances, tooling |
| `perf` | Amélioration de performance |
| `ci` | Changements CI/CD |

**Exemples :**

```bash
feat(auth): add TOTP two-factor authentication
fix(playlist): prevent duplicate videos in reorder endpoint
docs(readme): add complete installation guide
test(api): add integration tests for auth module
chore(deps): upgrade Prisma to 5.20
```

### Branches

| Branche | Usage |
|---|---|
| `main` | Production — protégée, PR uniquement |
| `dev` | Développement actif — branche par défaut |
| `feat/*` | Nouvelles fonctionnalités |
| `fix/*` | Corrections de bugs |
| `docs/*` | Documentation |

### Process de contribution

1. Créer une branche depuis `dev` : `git checkout -b feat/ma-fonctionnalite`
2. Développer avec des commits Conventional Commits
3. S'assurer que `pnpm lint && pnpm typecheck && pnpm test` passent
4. Ouvrir une Pull Request vers `dev`
5. Attendre la review et le passage du CI

### Accessibilité

Le projet vise la conformité **WCAG 2.1 AA** :
- Contraste de couleurs ≥ 4.5:1
- Navigation clavier complète
- Attributs ARIA sur les composants interactifs
- Tests d'accessibilité dans les specs Playwright

---

## Licence

Ce projet est à usage privé. Toute reproduction ou distribution est interdite sans accord explicite des auteurs.

---

*Plateforme développée dans le respect des recommandations CNIL et du RGPD — Privacy by Design.*

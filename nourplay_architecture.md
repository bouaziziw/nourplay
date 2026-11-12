# NourPlay — Architecture Logicielle Complète

> Plateforme de curation vidéo privée pour parents et enseignants  
> Document d'architecture — État du projet au 20 août 2026 (Phase 30 complétée)

---

## Table des matières

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Stack technique retenue et justifications](#2-stack-technique-retenue-et-justifications)
3. [Modèle de données](#3-modèle-de-données)
4. [Liste des API](#4-liste-des-api)
5. [Approche sécurité et conformité](#5-approche-sécurité-et-conformité)
6. [Roadmap MVP → V1 → Scale](#6-roadmap-mvp--v1--scale)
7. [Manuel d'installation local et production](#7-manuel-dinstallation-local-et-production)
8. [Stratégie de tests et de CI/CD](#8-stratégie-de-tests-et-de-cicd)
9. [Stratégie de commits et de documentation](#9-stratégie-de-commits-et-de-documentation)

---

## 1. Vue d'ensemble de l'architecture

### Schéma des composants

```mermaid
graph TB
  subgraph Clients["Clients (Couche présentation)"]
    W["Web Parent/Enseignant<br/>Next.js 14 · :3000"]
    A["Admin Back-office<br/>Next.js 14 · :3001"]
    M["Mobile iOS/Android<br/>Expo 53 · React Native"]
    TV["TV (futur)<br/>React Native TV"]
  end

  subgraph Gateway["Couche API"]
    API["API NestJS 10<br/>:4000<br/>REST /api/v1"]
  end

  subgraph Modules["Modules NestJS"]
    Auth["Auth<br/>JWT · 2FA · OAuth · Magic Link"]
    User["User<br/>Profils enfants · PIN · Avatar"]
    Playlist["Playlist<br/>CRUD · Partage · Catégories"]
    Video["Video<br/>Soumission · Recherche · Filtres"]
    Mod["Moderation<br/>Pipeline IA · Reports"]
    Consent["Consent<br/>Enregistrement RGPD"]
    GDPR["GDPR<br/>Export · Delete · Rectification"]
    Notif["Notification<br/>In-app · Email · Push"]
    Admin["Admin<br/>RBAC · Audit · Gestion users"]
    Sub["Subscription<br/>Plans · Stripe · Limites"]
    Storage["Storage<br/>S3/R2 · Presigned URLs"]
    Legal["Legal<br/>Documents juridiques versionnés"]
  end

  subgraph Workers["Workers asynchrones"]
    VV["video-validator<br/>BullMQ · OpenAI gpt-4o-mini"]
    EmailW["email-worker<br/>BullMQ · Resend"]
    GdprW["gdpr-export<br/>BullMQ · S3"]
    Cron["Scheduled Tasks<br/>@nestjs/schedule · Cron"]
  end

  subgraph Data["Couche données"]
    PG[("PostgreSQL 16<br/>20 modèles · 12 enums")]
    RD[("Redis 7<br/>Cache · Sessions · Queues")]
    S3[("S3 / Cloudflare R2<br/>Avatars · Thumbnails")]
  end

  subgraph Observability["Observabilité"]
    OT["OpenTelemetry SDK"]
    Loki["Grafana Loki<br/>Logs"]
    Tempo["Grafana Tempo<br/>Traces"]
    Prom["Prometheus<br/>Métriques"]
    Graf["Grafana<br/>:3002<br/>Dashboards"]
  end

  subgraph External["Services externes"]
    YT["YouTube Data API v3"]
    VM["Vimeo API"]
    AI["OpenAI gpt-4o-mini"]
    EM["Resend Email"]
    Stripe["Stripe<br/>Paiements"]
    EPush["Expo Push"]
    Google["Google OAuth"]
  end

  W & A & M --> |REST /api/v1| API
  TV -.-> |REST /api/v1| API
  API --> Modules
  API --> |Prisma ORM| PG
  API --> |ioredis| RD
  API --> |BullMQ enqueue| RD
  Workers --> |Consume BullMQ| RD
  Workers --> |Prisma| PG
  VV --> |Analyse contenu| AI
  Video --> |Métadonnées| YT & VM
  Notif --> |Email| EM
  Notif --> |Push mobile| EPush
  Storage --> |Upload/Download| S3
  Sub --> |Checkout · Webhooks| Stripe
  Auth --> |OAuth 2.0| Google
  OT --> Loki & Tempo & Prom
  Loki & Tempo & Prom --> Graf
```

### Communication entre services

| Flux | Protocole | Description |
|------|-----------|-------------|
| Client → API | HTTPS REST | Toutes les apps communiquent via `/api/v1/*` |
| API → PostgreSQL | TCP (Prisma) | ORM type-safe, connection pooling |
| API → Redis | TCP (ioredis) | Cache applicatif, sessions, blacklist tokens |
| API → BullMQ | Redis Pub/Sub | File de jobs asynchrones |
| Workers → Redis | BullMQ Consumer | Traitement des jobs en background |
| Workers → PostgreSQL | Prisma | Mise à jour des statuts (vidéos, GDPR) |
| Workers → OpenAI | HTTPS REST | Classification du contenu et des preuves média disponibles |
| API → YouTube/Vimeo | HTTPS REST | Récupération des métadonnées |
| API → Resend | HTTPS REST | Envoi d'emails transactionnels |
| API → Expo Push | HTTPS REST | Notifications push mobile |
| API → Stripe | HTTPS REST + Webhooks | Gestion des abonnements |
| API → S3/R2 | HTTPS (AWS SDK) | Upload/download d'avatars |

### Stratégie d'hébergement

| Composant | Recommandation MVP/V1 | Recommandation Scale |
|-----------|----------------------|---------------------|
| API NestJS | VPS (Hetzner/OVH) + Docker | Kubernetes (HPA) |
| Web Next.js | Même VPS ou Vercel | Vercel ou K8s |
| Admin Next.js | Même VPS | K8s (accès restreint IP) |
| PostgreSQL | Managed (Supabase/Neon) ou VPS | Managed + Read replicas |
| Redis | VPS local | Managed (Upstash/ElastiCache) |
| S3 | Cloudflare R2 (0 egress) | R2 + CDN Cloudflare |
| Workers | Même VPS (process séparé) | K8s (Jobs/CronJobs) |
| Observabilité | Grafana Cloud (free tier) | Grafana Cloud Pro |

### Scaling horizontal

```mermaid
graph LR
  subgraph LB["Load Balancer (Caddy/Nginx)"]
    TLS["TLS Termination"]
  end

  subgraph API["API Pods (x N)"]
    A1["API #1"]
    A2["API #2"]
    A3["API #N"]
  end

  subgraph Workers["Worker Pods"]
    W1["video-validator #1"]
    W2["video-validator #2"]
  end

  subgraph DB["Données"]
    PG_W[("PG Primary<br/>Write")]
    PG_R1[("PG Replica #1<br/>Read")]
    PG_R2[("PG Replica #2<br/>Read")]
    Redis_C[("Redis Cluster")]
  end

  TLS --> A1 & A2 & A3
  A1 & A2 & A3 --> PG_W
  A1 & A2 & A3 --> PG_R1 & PG_R2
  A1 & A2 & A3 --> Redis_C
  W1 & W2 --> Redis_C
  W1 & W2 --> PG_W
```

**Points clés du scaling :**
- **API stateless** : chaque instance est identique, sessions Redis partagées
- **BullMQ** : plusieurs consumers en parallèle, distribution automatique des jobs
- **PostgreSQL** : read replicas pour les requêtes de lecture (recherche, listing)
- **Redis Cluster** : pour le cache, les sessions et les queues à haute disponibilité
- **CDN** : Cloudflare devant les assets statiques et les thumbnails S3

---

## 2. Stack technique retenue et justifications

### Choix du backend : NestJS (TypeScript) plutôt que FastAPI (Python)

| Critère | NestJS ✅ | FastAPI |
|---------|----------|---------|
| **Cohérence full-stack** | TypeScript bout-en-bout (front + back + mobile) | Python = langage supplémentaire |
| **Écosystème** | BullMQ, Prisma, Passport, class-validator natifs | Équivalents existent mais écosystème fragmenté |
| **Structure** | Modules/Guards/Pipes/Interceptors imposent une architecture propre | Plus flexible mais moins structurant |
| **Types partagés** | Prisma génère les types partagés entre API et clients | Nécessite une couche de sérialisation |
| **Performance** | Suffisante (Node.js v20, V8 optimisé) | Légèrement supérieure en raw throughput |
| **Équipe** | Un seul langage à maîtriser | Deux langages à gérer |

> [!TIP]
> **Verdict** : NestJS 10 est retenu pour la cohérence TypeScript full-stack, l'écosystème Node.js mature (BullMQ, Prisma), et la structure modulaire imposée qui facilite la maintenance sur un projet complexe.

### Stack complète

| Domaine | Technologie | Version | Justification |
|---------|-------------|---------|---------------|
| **Monorepo** | Turborepo + pnpm workspaces | Turbo 2.3, pnpm 9 | Cache de build incrémental, exécution parallèle des tâches |
| **Web** | Next.js (App Router) | 14 | SSR/SSG, routing basé fichiers, Turbopack, React Server Components |
| **Admin** | Next.js (App Router) | 14 | Même stack que le web, séparation logique par app |
| **Mobile** | Expo + React Native | Expo 53, RN 0.79 | Managed workflow, OTA updates, base de code unifiée iOS/Android |
| **Backend** | NestJS | 10 | Modules, décorateurs, DI, guards, interceptors |
| **ORM** | Prisma | 5 | Type-safety, migrations versionnées, introspection |
| **BDD relationnelle** | PostgreSQL | 16 | Full-text search natif, JSON, robustesse |
| **Cache/Sessions** | Redis | 7 | Performances, BullMQ, sessions distribuées |
| **File de jobs** | BullMQ | 5 | Jobs asynchrones fiables, retry, priorité, cron |
| **Email** | Resend | — | API simple, templates HTML, deliverability |
| **Stockage objet** | Cloudflare R2 / S3 | — | Compatible S3, 0 egress fees |
| **IA modération** | OpenAI gpt-4o-mini | — | JSON structuré et revue humaine si les preuves média sont incomplètes |
| **Auth** | Argon2id + JWT + TOTP | — | Argon2id (winner PHC), résistant GPU |
| **I18n** | next-intl | — | ICU MessageFormat, RTL arabe natif |
| **CSS** | Tailwind CSS | 3 | Utility-first, purge en production, design system |
| **Tests unitaires** | Vitest | — | Compatible Vite, rapide, API Jest |
| **Tests E2E web** | Playwright | — | Multi-navigateur, captures, assertions visuelles |
| **Tests E2E mobile** | Maestro | — | Compatible Expo managed workflow, YAML flows |
| **Tests intégration** | Vitest + Supertest | — | Tests HTTP sur l'API avec DB réelle |
| **CI/CD** | GitHub Actions | — | 6 jobs parallèles, déploiement automatisé |
| **Sécurité scan** | Trivy + pnpm audit | — | Scan vulnérabilités images Docker + dépendances npm |
| **Observabilité** | OpenTelemetry + Grafana + Loki + Tempo + Prometheus | — | Stack open-source complète, traces + logs + métriques |
| **Push mobile** | Expo Push | — | Intégré à Expo, pas de Firebase nécessaire |
| **Paiements** | Stripe | — | Checkout, webhooks, abonnements récurrents |

---

## 3. Modèle de données

### Diagramme Entité-Relation

```mermaid
erDiagram
    User ||--o{ ChildProfile : "possède"
    User ||--o{ Playlist : "crée"
    User ||--o{ PlaylistAccess : "reçoit accès"
    User ||--o{ RefreshToken : "a"
    User ||--o{ ConsentRecord : "donne"
    User ||--o{ AuditLog : "acteur"
    User ||--o{ UserBlock : "configure"
    User ||--o{ Notification : "reçoit"
    User ||--o{ GdprRequest : "demande"
    User ||--o{ VideoReport : "signale"
    User ||--o| Subscription : "souscrit"
    User ||--o{ DeviceToken : "enregistre"
    User ||--o{ WebPushSubscription : "souscrit"
    User ||--o{ WatchParty : "héberge"

    ChildProfile ||--o{ WatchHistory : "historique"
    ChildProfile ||--o{ VideoFavorite : "favori"
    ChildProfile ||--o{ VideoProgress : "progression"
    ChildProfile ||--o{ VideoRating : "évalue"
    ChildProfile ||--o{ ProfileCategoryLimit : "limite"
    ChildProfile ||--o{ ParentalApprovalRequest : "demande"

    VideoSource ||--o{ Video : "héberge"
    Video ||--o{ PlaylistVideo : "dans"
    Video ||--o{ VideoTag : "tagué"
    Video ||--o{ WatchHistory : "visionnée"
    Video ||--o{ VideoReport : "signalée"
    Video ||--o{ VideoFavorite : "favorisée"
    Video ||--o{ VideoProgress : "en cours"
    Video ||--o{ VideoRating : "évaluée"
    Video ||--o{ ParentalApprovalRequest : "requiert"

    Tag ||--o{ VideoTag : "appliqué"
    Tag ||--o{ ProfileCategoryLimit : "catégorise"

    Playlist ||--o{ PlaylistVideo : "contient"
    Playlist ||--o{ Category : "organise"
    Playlist ||--o{ PlaylistAccess : "partagée"
    Playlist ||--o{ WatchParty : "diffusée"

    Category ||--o{ Category : "sous-catégorie"

    SubscriptionPlan ||--o{ Subscription : "offre"
```

### Entités détaillées

#### Core — Utilisateurs et authentification

| Entité | Champs clés | Notes |
|--------|-------------|-------|
| **User** | `id` (UUID), `email` (unique), `passwordHash?`, `role` (PARENT/TEACHER/MODERATOR/ADMIN), `emailVerified`, `twoFactorEnabled`, `twoFactorSecret?` (chiffré), `googleId?`, `locale`, `stripeCustomerId?`, `deletedAt?` | Soft delete RGPD, index sur email et deletedAt |
| **ChildProfile** | `id`, `userId` (FK), `displayName`, `birthYear?` (minimisation), `ageGroup` (enum), `avatarKey?` (S3), `pinHash` (Argon2id), `viewingSchedule` (JSON), `dailyLimitMin?`, `sessionLimitMin?`, `deletedAt?` | Planning horaire JSON par jour de semaine |
| **RefreshToken** | `id`, `userId` (FK), `tokenHash` (SHA-256), `fingerprint` (hash UA+IP), `expiresAt`, `revokedAt?` | Token brut jamais persisté, rotation automatique |

#### Contenu — Vidéos et playlists

| Entité | Champs clés | Notes |
|--------|-------------|-------|
| **VideoSource** | `id`, `name`, `slug`, `baseUrl`, `embedAllowed`, `cguVersion?`, `cguCheckedAt?`, `embedPolicy` (JSON), `isActive` | Vérification embed par source |
| **Video** | `id`, `sourceId` (FK), `externalId`, `embedUrl`, `title`, `description?`, `durationSec?`, `thumbnailUrl?`, `language?`, `ageRating` (enum), `validationStatus` (PENDING/APPROVED/REJECTED/NEEDS_REVIEW), `validationScore?` (0.0→1.0), `validationLog` (JSON), `submittedById?` | Unique sur (sourceId, externalId) |
| **Tag** | `id`, `name`, `locale` | Unique sur (name, locale) pour le multilingue |
| **VideoTag** | `videoId`, `tagId` | Table pivot M:N |
| **Playlist** | `id`, `ownerId` (FK), `name`, `description?`, `visibility` (PRIVATE/SHARED_LINK/SHARED_USERS), `targetAgeGroup[]`, `languages[]`, `shareToken?` (unique), `scheduledPublishAt?`, `deletedAt?` | Partage par lien ou par utilisateur |
| **PlaylistVideo** | `id`, `playlistId`, `videoId`, `position` (int), `addedById?` | Unique sur (playlistId, videoId), index sur position |
| **PlaylistAccess** | `id`, `playlistId`, `grantedTo` (userId), `role` (VIEWER/EDITOR) | Unique sur (playlistId, grantedTo) |
| **Category** | `id`, `playlistId`, `parentId?`, `name`, `slug` | Arbre auto-référencé, unique (playlistId, slug) |

#### Engagement — Historique et favoris

| Entité | Champs clés | Notes |
|--------|-------------|-------|
| **WatchHistory** | `id`, `profileId`, `videoId`, `watchedAt`, `durationWatchedSec`, `completed` | Index sur (profileId, watchedAt) |
| **VideoProgress** | `profileId`, `videoId`, `positionSec`, `completed` | PK composite, position de reprise |
| **VideoFavorite** | `id`, `profileId`, `videoId` | Unique (profileId, videoId) |
| **VideoRating** | `profileId`, `videoId`, `rating` (THUMBS_UP/THUMBS_DOWN) | PK composite |
| **ProfileCategoryLimit** | `id`, `profileId`, `tagId`, `dailyLimitMin` | Limite de temps par catégorie par profil |
| **ParentalApprovalRequest** | `id`, `profileId`, `videoId`, `status` (PENDING/APPROVED/DENIED) | File d'approbation parentale |

#### Conformité — RGPD et audit

| Entité | Champs clés | Notes |
|--------|-------------|-------|
| **ConsentRecord** | `id`, `userId`, `type` (TERMS/PRIVACY/COOKIE_*/PARENTAL_CONSENT), `version`, `consentedAt`, `ipHash` (SHA-256), `userAgent?`, `revokedAt?` | Versions tracées, IP hashée |
| **GdprRequest** | `id`, `userId`, `type` (EXPORT/DELETE/RECTIFICATION), `status` (PENDING/PROCESSING/COMPLETED/REJECTED), `exportUrl?` (S3 signée TTL 24h) | Traitement asynchrone |
| **AuditLog** | `id`, `actorId?`, `actorRole?`, `action`, `resourceType`, `resourceId?`, `metadata` (JSON), `ip?`, `userAgent?`, `occurredAt` | **Insert-only** — jamais modifié |
| **LegalDocument** | `id`, `type`, `version`, `content` (Markdown), `publishedAt?`, `createdById?` | Versionnement des textes légaux |

#### Monétisation et engagement

| Entité | Champs clés | Notes |
|--------|-------------|-------|
| **SubscriptionPlan** | `id`, `name`, `slug`, `priceEur` (centimes), `interval`, `features` (JSON), `stripePriceId?` | Plans Free/Family/School |
| **Subscription** | `id`, `userId` (unique), `planId`, `status`, `startedAt`, `expiresAt?`, `externalId?` (Stripe) | Un abonnement actif par utilisateur |
| **UserBlock** | `id`, `userId`, `profileId?` (null = tous), `type` (CHANNEL_*/KEYWORD_*), `value` | Listes blanches/noires |
| **Notification** | `id`, `userId`, `type`, `payload` (JSON), `readAt?` | In-app, types variés |
| **DeviceToken** | `id`, `userId`, `token` (Expo Push Token), `platform` | Push mobile |
| **WebPushSubscription** | `id`, `userId`, `endpoint`, `p256dh`, `auth` | Push web (VAPID) |
| **WatchParty** | `id`, `code` (6 chars), `hostId`, `playlistId`, `expiresAt` | Co-visionnage, expire 24h |
| **VideoReport** | `id`, `videoId`, `reportedBy`, `reason`, `description?`, `resolved`, `resolvedAt?` | Signalements utilisateurs |

### Statistiques du schéma

- **20 modèles** Prisma
- **12 enums** (`UserRole`, `AgeGroup`, `PlaylistVisibility`, `PlaylistAccessRole`, `VideoValidationStatus`, `AgeRating`, `ConsentType`, `BlockType`, `VideoRatingValue`, `ApprovalStatus`, `GdprRequestType/Status`, `SubscriptionStatus`, `PlanInterval`)
- **Migrations versionnées** dans `packages/db/prisma/migrations/`
- **Client auto-généré** dans `packages/db/generated/client/`

---

## 4. Liste des API

### Choix : REST plutôt que GraphQL

| Critère | REST ✅ | GraphQL |
|---------|--------|---------|
| **Complexité** | Simple pour les CRUD (majorité des endpoints) | Over-engineering pour ce cas d'usage |
| **Cache** | HTTP caching natif (ETags, CDN) | Nécessite un cache applicatif spécifique |
| **Sécurité** | Rate limiting trivial par route | Requêtes imbriquées difficiles à limiter |
| **Mobile** | Payloads prévisibles, bandwidth optimisé | Flexibilité utile mais complexité accrue |
| **Swagger** | Documentation auto-générée par NestJS | Nécessite un outil séparé (Apollo Studio) |

> [!TIP]
> **Verdict** : REST avec versioning par URL (`/api/v1/`) est le choix optimal. La majorité des opérations sont des CRUD classiques. Le cache HTTP natif est un avantage majeur pour les performances. Swagger est généré automatiquement à [localhost:4000/api/docs](http://localhost:4000/api/docs).

### Catalogue complet des endpoints

#### 🔐 Auth (`/api/v1/auth`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/register` | Créer un compte (email + mot de passe) | Public |
| `POST` | `/login` | Connexion (retourne access + refresh tokens) | Public |
| `POST` | `/logout` | Déconnexion (blacklist refresh token) | ✅ |
| `POST` | `/refresh` | Renouveler les tokens (cookie HttpOnly) | Cookie |
| `GET` | `/verify-email` | Vérification email via token | Public |
| `POST` | `/forgot-password` | Demande de reset mot de passe | Public |
| `POST` | `/reset-password` | Réinitialisation mot de passe | Public |
| `POST` | `/magic-link` | Envoi d'un lien de connexion | Public |
| `GET` | `/magic-link/verify` | Vérification du magic link | Public |
| `POST` | `/2fa/setup` | Générer le secret TOTP + QR code | ✅ |
| `POST` | `/2fa/verify` | Vérifier le code TOTP | ✅ |
| `POST` | `/2fa/disable` | Désactiver la 2FA | ✅ |
| `GET` | `/google` | Redirection OAuth Google | Public |
| `GET` | `/google/callback` | Callback OAuth Google | Public |

---

#### 👤 Utilisateurs (`/api/v1/users`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/me` | Profil de l'utilisateur connecté | ✅ |
| `PATCH` | `/me` | Modifier son profil (nom, locale, digest) | ✅ |
| `DELETE` | `/me` | Supprimer son compte (soft delete) | ✅ |
| `GET` | `/me/profiles` | Lister ses profils enfants | ✅ |
| `POST` | `/me/profiles` | Créer un profil enfant | ✅ |
| `GET` | `/me/profiles/:id` | Détail d'un profil enfant | ✅ |
| `PATCH` | `/me/profiles/:id` | Modifier un profil (limites, planning, PIN) | ✅ |
| `DELETE` | `/me/profiles/:id` | Supprimer un profil (soft delete) | ✅ |
| `POST` | `/me/profiles/:id/verify-pin` | Vérifier le PIN d'un profil | ✅ |
| `GET` | `/me/profiles/:id/history` | Historique de visionnage | ✅ |
| `DELETE` | `/me/profiles/:id/history` | Effacer l'historique | ✅ |
| `GET` | `/me/profiles/:id/favorites` | Favoris du profil | ✅ |
| `POST` | `/me/profiles/:id/favorites` | Ajouter un favori | ✅ |
| `DELETE` | `/me/profiles/:id/favorites/:videoId` | Retirer un favori | ✅ |
| `GET` | `/me/profiles/:id/stats` | Statistiques de visionnage | ✅ |
| `GET` | `/me/profiles/:id/progress` | Progression des vidéos | ✅ |
| `PUT` | `/me/profiles/:id/progress/:videoId` | Mettre à jour la progression | ✅ |
| `GET` | `/me/blocks` | Lister les filtres (whitelist/blacklist) | ✅ |
| `POST` | `/me/blocks` | Ajouter un filtre | ✅ |
| `DELETE` | `/me/blocks/:id` | Supprimer un filtre | ✅ |

---

#### 📋 Playlists (`/api/v1/playlists`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/` | Lister ses playlists (+ partagées avec moi) | ✅ |
| `POST` | `/` | Créer une playlist | ✅ |
| `GET` | `/:id` | Détail d'une playlist + vidéos | ✅ / Public (si partagée) |
| `PATCH` | `/:id` | Modifier (nom, description, visibilité, âges) | ✅ Owner |
| `DELETE` | `/:id` | Supprimer (soft delete) | ✅ Owner |
| `POST` | `/:id/videos` | Ajouter une vidéo à la playlist | ✅ Owner/Editor |
| `DELETE` | `/:id/videos/:videoId` | Retirer une vidéo | ✅ Owner/Editor |
| `PATCH` | `/:id/videos/reorder` | Réordonner les vidéos | ✅ Owner/Editor |
| `POST` | `/:id/share` | Partager avec un utilisateur (email) | ✅ Owner |
| `DELETE` | `/:id/share/:userId` | Révoquer l'accès d'un utilisateur | ✅ Owner |
| `POST` | `/:id/share-link` | Générer/régénérer un lien de partage | ✅ Owner |
| `DELETE` | `/:id/share-link` | Désactiver le lien de partage | ✅ Owner |
| `GET` | `/public/:token` | Voir une playlist partagée par lien | Public |

---

#### 🎥 Vidéos (`/api/v1/videos`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/` | Soumettre une URL vidéo (déclenche validation IA) | ✅ |
| `GET` | `/search` | Recherche avancée (filtres: âge, thème, langue, durée, source) | ✅ |
| `GET` | `/:id` | Détail d'une vidéo (métadonnées, statut validation) | ✅ |
| `POST` | `/:id/report` | Signaler une vidéo (raison + description) | ✅ |
| `POST` | `/:id/rate` | Évaluer une vidéo (thumbs up/down) | ✅ |

---

#### 🛡️ Modération (`/api/v1/moderation`) — MODERATOR / ADMIN

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/queue` | File d'attente de modération (PENDING + NEEDS_REVIEW) | MODERATOR+ |
| `POST` | `/:id/approve` | Approuver une vidéo | MODERATOR+ |
| `POST` | `/:id/reject` | Rejeter une vidéo (avec motif) | MODERATOR+ |
| `GET` | `/reports` | Signalements utilisateurs | MODERATOR+ |
| `POST` | `/reports/:id/resolve` | Résoudre un signalement | MODERATOR+ |

---

#### 📜 Consentement RGPD (`/api/v1/consent`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/` | Enregistrer un consentement (type + version) | ✅ |
| `DELETE` | `/:type` | Révoquer un consentement | ✅ |
| `GET` | `/current` | Consentements actifs de l'utilisateur | ✅ |
| `GET` | `/history` | Historique complet des consentements | ✅ |

---

#### 🔒 RGPD — Droits des personnes (`/api/v1/gdpr`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/my-data` | Accès immédiat aux données personnelles (JSON) | ✅ |
| `POST` | `/export` | Demander un export complet (async, lien S3 TTL 24h) | ✅ |
| `POST` | `/delete` | Demander la suppression du compte | ✅ |
| `POST` | `/rectification` | Demander une rectification | ✅ |
| `GET` | `/requests/:id` | Statut d'une demande RGPD | ✅ |

---

#### 🔔 Notifications (`/api/v1/notifications`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/` | Lister les notifications (paginé) | ✅ |
| `GET` | `/unread-count` | Nombre de notifications non lues | ✅ |
| `PATCH` | `/:id/read` | Marquer comme lue | ✅ |
| `POST` | `/read-all` | Tout marquer comme lu | ✅ |
| `DELETE` | `/:id` | Supprimer une notification | ✅ |

---

#### 📱 Push Notifications (`/api/v1/push`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/device-token` | Enregistrer un token Expo Push | ✅ |
| `DELETE` | `/device-token/:token` | Supprimer un token | ✅ |
| `POST` | `/web-push/subscribe` | S'abonner aux push web (VAPID) | ✅ |
| `DELETE` | `/web-push/unsubscribe` | Se désabonner | ✅ |

---

#### 👑 Administration (`/api/v1/admin`) — ADMIN uniquement

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/users` | Lister tous les utilisateurs (paginé, recherche) | ADMIN |
| `GET` | `/users/:id` | Détail d'un utilisateur | ADMIN |
| `PATCH` | `/users/:id/role` | Modifier le rôle d'un utilisateur | ADMIN |
| `DELETE` | `/users/:id` | Désactiver un compte (soft delete) | ADMIN |
| `GET` | `/audit-logs` | Journal d'audit (filtres: acteur, action, dates) | ADMIN |
| `GET` | `/stats` | Métriques agrégées anonymisées | ADMIN |
| `GET` | `/gdpr/requests` | Demandes RGPD en attente | ADMIN |
| `PATCH` | `/gdpr/requests/:id` | Traiter une demande RGPD | ADMIN |

---

#### 💳 Abonnements (`/api/v1/subscriptions`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/plans` | Lister les plans disponibles | Public |
| `GET` | `/current` | Abonnement actuel de l'utilisateur | ✅ |
| `POST` | `/checkout` | Créer une session Stripe Checkout | ✅ |
| `POST` | `/portal` | Créer un lien vers le portail Stripe | ✅ |
| `POST` | `/webhook` | Webhook Stripe (événements) | Stripe signature |

---

#### 📦 Stockage (`/api/v1/storage`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/presigned-url` | Obtenir une URL pré-signée pour upload | ✅ |
| `DELETE` | `/avatar` | Supprimer un avatar | ✅ |

---

#### ⚖️ Documents légaux (`/api/v1/legal`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/documents/:type` | Dernier document publié (CGU, politique…) | Public |
| `GET` | `/documents/:type/versions` | Historique des versions | Public |
| `POST` | `/documents` | Créer un document légal | ADMIN |
| `PATCH` | `/documents/:id/publish` | Publier un document | ADMIN |

---

#### 🎉 Watch Party (`/api/v1/watch-party`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/` | Créer une watch party (code 6 chars) | ✅ |
| `GET` | `/:code` | Rejoindre/voir une watch party | Public |

---

**Total : ~85 endpoints** organisés en 14 domaines fonctionnels.

---

## 5. Approche sécurité et conformité

### 5.1 Authentification

| Mécanisme | Implémentation |
|-----------|---------------|
| **Hash des mots de passe** | Argon2id (mémoire: 64 MB, itérations: 3, parallélisme: 1) — winner PHC |
| **Hash des PINs enfants** | Argon2id (mêmes paramètres) |
| **JWT Access Token** | Signé HS256, TTL 15 min, inclut userId + role |
| **JWT Refresh Token** | SHA-256 hashé en base, TTL 7 jours, cookie HttpOnly/Secure/SameSite=Lax |
| **Rotation des tokens** | Chaque refresh génère un nouveau refresh token et révoque l'ancien |
| **Fingerprinting** | Hash du User-Agent + subnet IP attaché au refresh token |
| **2FA TOTP** | RFC 6238, secret chiffré en base (AES-256), compatible Google Authenticator |
| **OAuth Google** | Passport.js, création de compte automatique si non existant |
| **Magic Link** | Token JWT signé à usage unique, TTL 15 min, envoyé par email |
| **Blacklist tokens** | Tokens révoqués stockés dans Redis (TTL = durée restante du token) |

### 5.2 Autorisation — RBAC

```mermaid
graph TD
    subgraph Roles["Hiérarchie des rôles"]
        ADMIN["ADMIN<br/>Accès total"]
        MODERATOR["MODERATOR<br/>Modération + lecture admin"]
        TEACHER["TEACHER<br/>Fonctions utilisateur + partage classe"]
        PARENT["PARENT<br/>Fonctions utilisateur de base"]
    end

    ADMIN --> MODERATOR
    MODERATOR --> TEACHER
    TEACHER --> PARENT
```

| Rôle | Permissions |
|------|------------|
| **PARENT** | CRUD playlists/profils, soumettre vidéos, gérer consentements, export RGPD |
| **TEACHER** | Idem PARENT + partage avec classes, catégories enrichies |
| **MODERATOR** | Idem TEACHER + modération vidéos, résolution signalements |
| **ADMIN** | Tout accès : gestion users, rôles, audit, RGPD, plans, documents légaux |

**Implémentation :**
- **Guards NestJS** : `@Roles(UserRole.ADMIN)` décorateur personnalisé
- **Ownership check** : les playlists/profils vérifient que `ownerId === currentUser.id`
- **PlaylistAccess** : VIEWER (lecture seule) ou EDITOR (ajout/retrait vidéos)
- **PIN enfant** : vérifié avant d'entrer en mode enfant

### 5.3 Gestion des sessions

| Aspect | Implémentation |
|--------|---------------|
| **Sessions** | Stateless JWT + refresh token en cookie HttpOnly |
| **Durée access token** | 15 minutes (configurable `JWT_ACCESS_TTL`) |
| **Durée refresh token** | 7 jours (configurable `JWT_REFRESH_TTL`) |
| **Stockage sessions** | Redis pour la blacklist et le cache |
| **Session enfant** | Côté client uniquement (localStorage), pas de JWT enfant |
| **Déconnexion** | Révocation du refresh token + blacklist de l'access token dans Redis |

### 5.4 Protection des comptes enfants

| Mesure | Détail |
|--------|--------|
| **Pas de compte enfant** | Les enfants n'ont pas de compte — ils ont un `ChildProfile` rattaché au parent |
| **PIN Argon2id** | Code PIN (4-6 chiffres) hashé avec Argon2id pour déverrouiller le profil |
| **Périmètre restreint** | L'enfant ne voit que les playlists assignées par l'adulte |
| **Pas de recherche externe** | Pas d'accès à la recherche vidéo en mode enfant |
| **Pas de commentaires** | Aucun système de commentaires dans la plateforme |
| **Pas de publicité** | Aucune publicité, aucun tracking tiers |
| **Limites de temps** | `dailyLimitMin`, `sessionLimitMin` appliqués côté client + vérifié API |
| **Planning horaire** | `viewingSchedule` JSON par jour de semaine |
| **Limites par catégorie** | `ProfileCategoryLimit` par tag |
| **Minimisation données** | Seul `birthYear` stocké, jamais la date de naissance complète |
| **Métriques anonymisées** | Pas de tracking comportemental fin, agrégation uniquement |

### 5.5 Sécurité réseau et applicative

| Mesure | Implémentation |
|--------|---------------|
| **Rate limiting** | Global : 100 req/60s par IP (configurable). Routes sensibles (login, register) : 5 req/60s |
| **CORS** | Origins explicites uniquement (`CORS_ORIGINS`) |
| **CSRF** | Tokens CSRF pour les mutations cookie-based |
| **Headers de sécurité** | `Helmet.js` — CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy |
| **Chiffrement en transit** | TLS 1.3 via reverse proxy (Caddy/Nginx) |
| **Chiffrement au repos** | PostgreSQL: encryption at rest (provider-level). Application: AES-256 pour `twoFactorSecret` |
| **Secrets management** | Variables d'environnement injectées (jamais de secrets en dur). Production : gestionnaire de secrets (Vault/Doppler/AWS SM) |
| **Audit dépendances** | `pnpm audit` + Trivy scan dans le CI |
| **Validation d'entrée** | `class-validator` sur tous les DTOs NestJS |
| **SQL Injection** | Prisma ORM avec paramètres préparés |
| **IP banning** | Configurable via back-office admin |

### 5.6 Conformité RGPD / CNIL — Privacy by Design

#### Principes appliqués

| Principe RGPD | Implémentation |
|---------------|---------------|
| **Minimisation** | `birthYear` uniquement (pas date complète), pas de tracking fin, IP hashée en SHA-256 |
| **Limitation finalité** | Données utilisées uniquement pour le service, jamais vendues ni partagées |
| **Durée conservation** | Soft delete → suppression définitive après délai légal |
| **Consentement explicite** | Chaque consentement enregistré avec : type, version, horodatage, IP hashée, user-agent |
| **Consentement parental** | Double opt-in pour les profils enfants, type `PARENTAL_CONSENT` |
| **Droit d'accès** | `GET /api/v1/gdpr/my-data` — export JSON immédiat |
| **Droit à la portabilité** | `POST /api/v1/gdpr/export` — export complet asynchrone (JSON, lien S3 TTL 24h) |
| **Droit à l'effacement** | `POST /api/v1/gdpr/delete` — soft delete + suppression en cascade planifiée |
| **Droit de rectification** | `POST /api/v1/gdpr/rectification` — demande traitée par l'admin |
| **Révocation consentement** | `DELETE /api/v1/consent/:type` — à tout moment |
| **Registre des traitements** | Documentation dans `docs/compliance/` |
| **DPA sous-traitants** | Template DPA pour chaque sous-traitant, dont OpenAI |

#### Où sont stockées les données

| Donnée | Stockage | Chiffrement | Suppression |
|--------|----------|-------------|-------------|
| Données utilisateur | PostgreSQL | Transit (TLS) + repos (provider) | Soft delete → hard delete (cron) |
| Mots de passe | PostgreSQL (hash Argon2id) | Hash irréversible | Avec le compte |
| Sessions/tokens | Redis (TTL) | Transit (TLS) | Expiration automatique |
| Avatars | S3/R2 | Transit (HTTPS) + repos (provider) | Suppression sur demande |
| Logs d'audit | PostgreSQL (insert-only) | Transit + repos | Rétention légale puis purge |
| Consentements | PostgreSQL | Transit + repos | Jamais supprimés (obligation légale) |
| Secret 2FA | PostgreSQL | AES-256 application-level | Avec le compte |

#### Conformité majorité numérique française

- Pas de compte pour les moins de 15 ans (les enfants n'ont pas de compte, seulement des profils contrôlés par un adulte)
- Consentement parental explicite requis pour créer un profil enfant
- Information claire et accessible sur les droits (CGU et politique de confidentialité multilingues)

#### Validation du contenu

```mermaid
flowchart TD
    Submit["Utilisateur soumet une URL vidéo"] --> Extract["Extraction métadonnées<br/>YouTube/Vimeo API"]
    Extract --> CheckSource{"Source autorise<br/>l'embed ?"}
    CheckSource -->|Non| Blocked["❌ Vidéo bloquée"]
    CheckSource -->|Oui| Queue["→ File BullMQ<br/>video-validation"]
    Queue --> AI["Pipeline IA<br/>OpenAI gpt-4o-mini"]
    AI --> Score{"Confiance +<br/>preuves suffisantes"}
    Score -->|"Confiance élevée, preuves complètes"| Approved["✅ APPROVED<br/>Publication automatique"]
    Score -->|"Ambigu, incomplet ou confiance insuffisante"| Review["⚠️ NEEDS_REVIEW<br/>File modération humaine"]
    Score -->|"Violation grave prouvée, confiance suffisante"| Rejected["❌ REJECTED"]
    AI -->|"Erreur API"| Fallback["⚠️ NEEDS_REVIEW<br/>Fallback gracieux"]
```

**Le pipeline IA analyse les éléments fournis :**
1. Titre, description, langue, tags et contexte de playlist
2. Miniature et frames horodatées si elles sont fournies
3. Transcript audio si disponible

Le worker actuel ne télécharge ni ne décode les médias : seule la miniature est fournie aujourd'hui. Les métadonnées/miniature seules ne permettent pas une approbation automatique; une extraction média et une transcription fiables sont nécessaires pour activer ce chemin.
4. Classification par âge et détection de contenu inapproprié

---

## 6. Roadmap MVP → V1 → Scale

### Phase MVP (Phases 1–7) ✅ Complétées

> Objectif : valider le concept avec un produit fonctionnel minimum.

| Phase | Contenu | Commit |
|-------|---------|--------|
| 01 | Monorepo (Turborepo + pnpm), schéma Prisma complet (17 modèles), Docker Compose (PG + Redis + Adminer + MailHog), CI/CD GitHub Actions, seed initial | `feat(phase-01)` |
| 02 | API core NestJS : profils enfants (CRUD + PIN), playlists (CRUD + vidéos + réordonnement), vidéos (soumission + recherche), consentement RGPD (enregistrement + révocation) | `feat(phase-02)` |
| 03 | Auth complète : register + login + verify-email + refresh tokens, 2FA TOTP (setup + verify), OAuth Google (Passport), tests d'intégration API | `feat(phase-03)` |
| 04 | Back-office API : modération (queue + approve/reject), notifications (CRUD + email), historique de visionnage (enregistrement + liste + purge), pipeline validation IA (BullMQ + OpenAI gpt-4o-mini) | `feat(phase-04)` |
| 05A | Interface enfant web : mode enfant, lecteur vidéo embarqué, navigation restreinte aux playlists autorisées | `feat(phase-05a)` |
| 05B | Interface parent web : gestion des profils, constructeur de playlists, vidéothèque | `feat(phase-05b)` |
| 05C | App mobile Expo : interface enfant iOS/Android, navigation React Navigation, sélecteur de profil + PIN | `feat(phase-05c)` |
| 05D | Dashboard administrateur : gestion utilisateurs, file de modération, journal d'audit | `feat(phase-05d)` |
| 06 | Partage de playlists (par utilisateur + par lien), notifications in-app + email, page compte RGPD (export/delete) | `feat(phase-06)` |
| 07 | Visionneuse de playlists publiques, tests E2E Playwright complets | `feat(phase-07)` |

### Phase V1 (Phases 8–20) ✅ Complétées

> Objectif : version publique complète, prête au déploiement.

| Phase | Contenu | Statut |
|-------|---------|--------|
| 08 | Filtres de contenu (whitelist/blacklist chaînes + mots-clés), notifications email sur revue | ✅ |
| 09 | Reset mot de passe (forgot + reset), pages 2FA complètes (setup + disable) | ✅ |
| 10 | Ajout à playlist depuis la vidéothèque, interface de signalement vidéo | ✅ |
| 11 | Dockerfiles production (multi-stage), docker-compose.prod.yml, standalone Next.js output | ✅ |
| 12 | Landing page publique (hero, features, steps, CTA) avec i18n complète (fr/en/ar/es) | ✅ |
| 13 | Tests unitaires : services vidéos, playlists, utilisateurs (couverture cible 70%) | ✅ |
| 14 | Analytiques de visionnage par profil enfant (stats tab, graphiques par jour) | ✅ |
| 15 | Favoris par profil enfant (API + schéma), modèle d'abonnement (plans Free/Family/School) | ✅ |
| 16 | Magic link authentication, documents légaux versionnés | ✅ |
| 17 | App mobile parent : navigation adulte, playlists, recherche | ✅ |
| 18–22 | Stripe integration complète : checkout, webhooks, portail client, gestion abonnements | ✅ |
| 23 | Admin abonnements : gestion plans, seed des plans, Dependabot | ✅ |
| 24 | Push notifications Expo : token registration, push auto sur notification | ✅ |
| 25 | Upload avatar S3/R2 : presigned URL, upload direct, suppression | ✅ |
| 26 | Security hardening : rate limiting global, headers HTTP stricts (Helmet) | ✅ |
| 27 | Feature gating : limites de profils et playlists par plan d'abonnement | ✅ |
| 28 | CI hardening : Playwright E2E dans le CI, workflow de déploiement Docker | ✅ |
| 29 | Cache Redis applicatif : CacheService générique wrapping ioredis | ✅ |
| 30 | Scheduled jobs : expiration abonnements (cron), rappels email 7j avant expiration | ✅ |

### Phase Scale — Long terme 🚧

> Objectif : supporter des millions d'utilisateurs avec haute disponibilité.

| Objectif | Description | Priorité |
|----------|-------------|----------|
| **Support TV** | Android TV / Apple TV via react-native-tvos (nécessite eject d'Expo managed) | 🔴 Haute |
| **Kubernetes** | Migration Docker → K8s, HPA sur API et workers, rollback automatique | 🔴 Haute |
| **Read replicas** | PostgreSQL read replicas pour la recherche et les listings | 🟡 Moyenne |
| **CDN assets** | Cloudflare CDN devant R2 pour thumbnails et assets statiques | 🟡 Moyenne |
| **Recommandations curatoriales** | Suggestions basées sur les playlists de l'adulte (transparentes, pas d'algo opaque) | 🟡 Moyenne |
| **Import de playlists** | Import en masse depuis YouTube/Vimeo playlists | 🟡 Moyenne |
| **SSO / SAML** | Intégration établissements scolaires (annuaires LDAP, SSO) | 🟡 Moyenne |
| **Conformité DSA / CSAM** | Digital Services Act, détection CSAM, trusted flaggers | 🟢 Basse |
| **Micro-services** | Découpage en services indépendants si nécessaire (vidéo, auth, notification) | 🟢 Basse |
| **Multi-région** | Déploiement multi-région pour la latence (EU + MENA + LatAm) | 🟢 Basse |

---

## 7. Manuel d'installation local et production

### 7.1 Installation locale (Docker Compose)

#### Prérequis

| Outil | Version minimale | Installation |
|-------|-----------------|--------------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | 9.x | `npm install -g pnpm` |
| Docker Desktop | 4.x | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |

#### Étape 1 — Cloner le dépôt

```bash
git clone https://github.com/<org>/nourplay.git
cd nourplay
```

#### Étape 2 — Variables d'environnement

```bash
cp .env.example .env
```

Variables **obligatoires** pour démarrer :

```env
DATABASE_URL=postgresql://nourplay:secret@localhost:5432/nourplay
DATABASE_URL_TEST=postgresql://nourplay:secret@localhost:5432/nourplay_test
REDIS_URL=redis://:secret@localhost:6379

JWT_ACCESS_SECRET=changeme-dev-access-secret-min-32-chars
JWT_REFRESH_SECRET=changeme-dev-refresh-secret-min-32-chars
COOKIE_SECRET=changeme-dev-cookie-secret-min-32-chars
```

Variables **optionnelles** (fonctionnalités dégradées sans elles) :

| Variable | Impact sans elle |
|----------|-----------------|
| `YOUTUBE_API_KEY` | Vidéos créées avec métadonnées minimales (URL seule) |
| `VIMEO_ACCESS_TOKEN` | Idem |
| `OPENAI_API_KEY` | Worker met les vidéos en `NEEDS_REVIEW` si OpenAI est indisponible ou les preuves média sont incomplètes |
| `RESEND_API_KEY` | Emails capturés par MailHog (localhost:8025) |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth Google désactivé |
| `S3_*` | Upload d'avatar désactivé |
| `STRIPE_*` | Abonnements payants désactivés |

#### Étape 3 — Démarrer l'infrastructure

```bash
# Lance PostgreSQL, Redis, Adminer, Redis Commander, MailHog, Grafana stack
docker compose up -d

# Vérifier que tous les services sont healthy
docker compose ps
```

Interfaces disponibles :

| Service | URL |
|---------|-----|
| Adminer (DB UI) | http://localhost:8080 |
| Redis Commander | http://localhost:8081 |
| MailHog (emails) | http://localhost:8025 |
| Grafana (observabilité) | http://localhost:3002 (admin/admin) |
| Prometheus | http://localhost:9090 |

#### Étape 4 — Installer les dépendances

```bash
pnpm install
```

#### Étape 5 — Préparer la base de données

```bash
# Applique les migrations et génère le client Prisma
pnpm db:migrate

# Insère les données de test (sources vidéo, plans, rôles)
pnpm db:seed
```

#### Étape 6 — Démarrer les applications

```bash
# Toutes les apps en parallèle (Turborepo)
pnpm dev
```

| Application | URL |
|-------------|-----|
| Web (parents/enseignants) | http://localhost:3000 |
| Admin (back-office) | http://localhost:3001 |
| API NestJS | http://localhost:4000/api |
| Swagger | http://localhost:4000/api/docs |

Pour démarrer une app spécifique :

```bash
pnpm --filter @nourplay/api dev      # API seule
pnpm --filter nourplay-web dev       # Web seul
pnpm --filter nourplay-admin dev     # Admin seul
pnpm --filter video-validator dev    # Worker IA
```

#### Étape 7 — App mobile (optionnel)

```bash
cd apps/mobile
pnpm start    # Lance Expo dev server
# Scanner le QR code avec Expo Go (iOS/Android)
```

---

### 7.2 Installation production

#### Infrastructure requise

- **Serveur** : Linux Ubuntu 22.04 LTS (min 4 vCPU, 8 GB RAM) ou cluster Kubernetes
- **Docker Engine** + Docker Compose v2
- **Domaine** avec certificat TLS (Let's Encrypt via Caddy)
- **Gestionnaire de secrets** : Vault, Doppler, ou AWS Secrets Manager

#### Étape 1 — Variables d'environnement de production

```env
NODE_ENV=production
APP_URL=https://nourplay.app
API_URL=https://api.nourplay.app
ADMIN_URL=https://admin.nourplay.app

DATABASE_URL=postgresql://nourplay:<PASSWORD>@<DB_HOST>:5432/nourplay
REDIS_URL=redis://:<PASSWORD>@<REDIS_HOST>:6379

# Secrets forts (min 64 chars, générés avec openssl rand -hex 32)
JWT_ACCESS_SECRET=<secret-64-chars>
JWT_REFRESH_SECRET=<secret-64-chars>
COOKIE_SECRET=<secret-64-chars>

# Services externes
RESEND_API_KEY=<production-key>
YOUTUBE_API_KEY=<production-key>
OPENAI_API_KEY=<production-key>
AI_MODERATION_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=<production-key>
STRIPE_WEBHOOK_SECRET=<production-key>

# CORS restreint
CORS_ORIGINS=https://nourplay.app,https://admin.nourplay.app
```

> [!CAUTION]
> Ne jamais commit les secrets en clair. Utiliser des variables d'environnement injectées par le CI/CD ou un gestionnaire de secrets.

#### Étape 2 — Build et déploiement Docker

```bash
# Build des images de production (multi-stage, optimisées)
docker compose -f docker-compose.prod.yml build

# Démarrer (migrations automatiques via le service migrate)
docker compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs -f
```

Services Docker en production :

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `postgres` | `postgres:16-alpine` | 5432 (interne) | Base de données |
| `redis` | `redis:7-alpine` | 6379 (interne) | Cache + queues |
| `migrate` | build `packages/api` | — | Migration Prisma (one-shot) |
| `api` | build `packages/api` | 4000 | API NestJS |
| `web` | build `apps/web` | 3000 | Next.js Web |

#### Étape 3 — Reverse proxy (Caddy)

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

> Caddy gère automatiquement les certificats TLS via Let's Encrypt.

#### Étape 4 — Surveillance et maintenance

```bash
# Santé des services
docker compose -f docker-compose.prod.yml ps

# Mise à jour sans interruption (rolling update)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --no-deps api web

# Backup base de données
docker exec nourplay-postgres pg_dump -U nourplay nourplay > backup_$(date +%Y%m%d).sql
```

#### Infrastructure as Code (futur)

Pour le passage à Kubernetes, prévoir :
- **Helm charts** pour chaque service (api, web, admin, workers)
- **HPA** (Horizontal Pod Autoscaler) sur l'API et les workers
- **Secrets** Kubernetes injectés depuis Vault/AWS SM
- **Ingress** Nginx avec cert-manager pour TLS
- **PVC** pour les volumes PostgreSQL

---

## 8. Stratégie de tests et de CI/CD

### 8.1 Pyramide de tests

```
┌───────────────────────────────────────────┐
│         Tests E2E Mobile (Maestro)        │  ← 4 flows
│         apps/mobile/.maestro/flows/       │
├───────────────────────────────────────────┤
│         Tests E2E Web (Playwright)        │  ← ~15 specs
│         apps/web/e2e/**/*.spec.ts         │
├───────────────────────────────────────────┤
│     Tests d'intégration API               │  ← Auth, Playlists, GDPR
│     packages/api/test/**/*.e2e-spec.ts    │
├───────────────────────────────────────────┤
│     Tests unitaires (Vitest)              │  ← Services, Guards, Pipes
│     packages/api/src/**/*.spec.ts         │
│     Couverture cible : 70%               │
└───────────────────────────────────────────┘
```

### 8.2 Tests unitaires

- **Framework** : Vitest (compatible Vite, API Jest)
- **Couverture cible** : 70% lignes/fonctions, 60% branches
- **Scope** : services NestJS, guards, pipes, utilitaires

```bash
pnpm test                                        # Tout le monorepo
pnpm --filter @nourplay/api test                 # API seule
pnpm --filter @nourplay/api exec vitest run --coverage  # Avec couverture
```

Seuils configurés dans [vitest.config.ts](file:///d:/DEV/nourplay/packages/api/vitest.config.ts) :

| Métrique | Seuil |
|----------|-------|
| Lines | 70% |
| Functions | 70% |
| Statements | 70% |
| Branches | 60% |

### 8.3 Tests d'intégration API

- **Framework** : Vitest + Supertest
- **Environnement** : PostgreSQL + Redis réels (Docker)
- **Scope** : endpoints HTTP complets, auth flows, GDPR

```bash
docker compose up -d postgres redis    # Infra requise
pnpm --filter @nourplay/api test:e2e   # Lancer les tests
```

### 8.4 Tests E2E Web (Playwright)

- **Navigateur** : Chromium
- **Locale** : fr-FR
- **Scope** : login, inscription, playlists, profils enfants, mode enfant, abonnements

```bash
pnpm --filter nourplay-web test:e2e              # Headless
pnpm --filter nourplay-web exec playwright test --ui  # Interface graphique
```

### 8.5 Tests E2E Mobile (Maestro)

Compatible Expo managed workflow (remplace Detox qui nécessite un eject) :

| Flow | Scénario |
|------|----------|
| `01_login.yaml` | Connexion email/mot de passe → sélecteur de profils |
| `02_parent_navigation.yaml` | Navigation par onglets (Accueil, Playlists, Vidéos, Compte) |
| `03_video_library.yaml` | Recherche dans la vidéothèque parentale |
| `04_child_mode.yaml` | Sélection profil + PIN → mode enfant → sortie |

```bash
maestro test apps/mobile/.maestro/flows/
```

### 8.6 Pipeline CI/CD (GitHub Actions)

```mermaid
graph LR
  subgraph Trigger["Trigger"]
    Push["push / PR<br/>main, dev"]
  end

  subgraph Jobs["Jobs parallèles"]
    Lint["Lint & Typecheck<br/>ESLint + tsc"]
    TestUnit["Unit Tests<br/>Vitest + coverage<br/>→ Codecov"]
    TestInteg["Integration Tests<br/>Vitest + Supertest<br/>(PG + Redis)"]
    Security["Security Audit<br/>pnpm audit +<br/>Trivy scan"]
  end

  subgraph Sequential["Séquentiel"]
    Build["Build<br/>Turborepo build<br/>Upload artifact"]
    Deploy["Deploy Staging<br/>(main only)<br/>Docker → GHCR<br/>SSH deploy VPS"]
  end

  Push --> Lint & TestUnit & TestInteg & Security
  Lint & TestUnit --> Build
  Build --> Deploy
```

**6 jobs** définis dans [ci.yml](file:///d:/DEV/nourplay/.github/workflows/ci.yml) :

| Job | Contenu | Déclencheur |
|-----|---------|-------------|
| `lint` | ESLint + `tsc --noEmit` | Chaque push/PR |
| `test-unit` | Vitest + couverture → Codecov | Chaque push/PR |
| `test-integration` | Vitest E2E API (services PG + Redis) | Chaque push/PR |
| `security` | `pnpm audit` + Trivy filesystem scan (CRITICAL/HIGH) | Chaque push/PR |
| `build` | Turborepo build, upload artifact web | Après lint + test-unit |
| `deploy` | Build Docker → GHCR push → SSH deploy VPS | Main uniquement |

**Secrets GitHub requis** : `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `COOKIE_SECRET`, `CODECOV_TOKEN`

---

## 9. Stratégie de commits et de documentation

### 9.1 Convention de commits

Le projet suit la convention **[Conventional Commits](https://www.conventionalcommits.org/)** :

```
<type>(<scope>): <description>

[body optionnel]

[footer optionnel]
```

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `style` | Formatage, pas de changement logique |
| `refactor` | Refactoring sans nouvelle fonctionnalité ni bug |
| `test` | Ajout ou modification de tests |
| `chore` | Maintenance, dépendances, tooling |
| `perf` | Amélioration de performance |
| `ci` | Changements CI/CD |

**Scopes** utilisés : `auth`, `user`, `playlist`, `video`, `moderation`, `consent`, `gdpr`, `notification`, `admin`, `subscription`, `storage`, `legal`, `deploy`, `phase-XX`, `api`, `web`, `mobile`, `db`, `deps`, `ci`

**Exemples du projet** :

```bash
feat(auth): add TOTP two-factor authentication
fix(playlist): prevent duplicate videos in reorder endpoint
feat(phase-30): scheduled jobs — subscription expiry reminders + auto-expire
feat(deploy): Docker-based CI/CD pipeline — ghcr.io push + VPS SSH deploy
test(api): unit tests for subscription service + tasks, fix stale specs
chore(deps): upgrade Prisma to 5.20
```

### 9.2 Stratégie de branches

| Branche | Usage |
|---------|-------|
| `main` | Production — protégée, PR uniquement |
| `dev` | Développement actif — branche par défaut |
| `feat/*` | Nouvelles fonctionnalités |
| `fix/*` | Corrections de bugs |
| `docs/*` | Documentation |

### 9.3 Documentation par phase

Chaque phase de développement produit un document dans [docs/phases/](file:///d:/DEV/nourplay/docs/phases/) qui décrit :

1. **Objectif** de la phase
2. **Nouveaux fichiers** créés (avec description)
3. **Modifications** apportées aux fichiers existants
4. **Dépendances** entre modules
5. **Comportement** attendu (scénarios d'usage)
6. **Tests** effectués et résultats

**29 documents de phase** déjà rédigés (Phase 01 → Phase 30).

Structure type d'un document de phase :

```markdown
# Phase XX — Nom de la phase

## Objectif
Description de ce qui est accompli.

## Nouveaux fichiers
### `chemin/vers/fichier.ts`
Description du fichier, responsabilités.

## Modifications
### `chemin/vers/fichier-existant.ts`
Ce qui a changé et pourquoi.

## Dépendances entre modules
Schéma des imports et injections.

## Comportement
Scénarios d'usage détaillés.

## Tests
Résultats des tests (typecheck, unit, intégration, E2E).
```

### 9.4 Documentation complémentaire

| Dossier | Contenu |
|---------|---------|
| [docs/architecture/](file:///d:/DEV/nourplay/docs/architecture/) | Schémas et décisions d'architecture (à peupler) |
| [docs/compliance/](file:///d:/DEV/nourplay/docs/compliance/) | Documentation RGPD / CNIL (à peupler) |
| [README.md](file:///d:/DEV/nourplay/README.md) | Guide complet (1096 lignes) : architecture, stack, installation, API, tests, déploiement, conformité, roadmap |
| [BRIEF.md](file:///d:/DEV/nourplay/BRIEF.md) | Brief initial du projet |

### 9.5 Processus de contribution

1. Créer une branche depuis `dev` : `git checkout -b feat/ma-fonctionnalite`
2. Développer avec des commits Conventional Commits
3. S'assurer que `pnpm lint && pnpm typecheck && pnpm test` passent
4. Rédiger/mettre à jour le document de phase dans `docs/phases/`
5. Ouvrir une Pull Request vers `dev`
6. Attendre la review et le passage du CI (6 jobs)
7. Merge squash vers `dev`, puis PR `dev` → `main` pour les releases

---

## Annexe — Résumé de l'état actuel

| Métrique | Valeur |
|----------|--------|
| **Phases complétées** | 30 |
| **Commits** | 30+ (Conventional Commits) |
| **Modèles Prisma** | 20 |
| **Enums** | 12 |
| **Endpoints API** | ~85 |
| **Modules NestJS** | 13 |
| **Apps front-end** | 3 (web, admin, mobile) |
| **Workers** | 1 (video-validator) |
| **Langues i18n** | 4 (fr, en, ar, es) |
| **Tests** | Unit (Vitest) + Integration (Supertest) + E2E Web (Playwright) + E2E Mobile (Maestro) |
| **CI/CD** | 6 jobs GitHub Actions + déploiement Docker automatisé |
| **Observabilité** | OpenTelemetry + Grafana + Loki + Tempo + Prometheus |
| **Conformité** | RGPD, CNIL, Privacy by Design, consentement parental, minimisation |

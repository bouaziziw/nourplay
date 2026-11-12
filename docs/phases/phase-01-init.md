# Phase 01 — Initialisation du monorepo NourPlay

**Date :** 2026-05-20  
**Statut :** Complétée

---

## Ce qui a été implémenté

### Structure du monorepo (Turborepo + pnpm workspaces)

```
nourplay/
├── apps/
│   ├── web/          # Next.js 14 App Router — interface parent/enseignant
│   └── admin/        # Next.js 14 — back-office administrateur
├── packages/
│   ├── api/          # NestJS — API REST versionnée
│   ├── db/           # Prisma — schéma et client de base de données
│   ├── ui/           # Composants React partagés (Button, Input, VideoCard…)
│   └── i18n/         # Configuration des locales (fr, en, ar, es)
├── workers/
│   └── video-validator/  # Worker BullMQ — pipeline de validation IA
└── .github/workflows/ci.yml
```

### Base de données — Prisma (PostgreSQL)

Schéma complet avec 17 modèles couvrant :
- `User`, `ChildProfile`, `RefreshToken` — gestion des comptes et sessions
- `VideoSource`, `Video`, `Tag`, `VideoTag` — curation vidéo
- `Playlist`, `PlaylistVideo`, `PlaylistAccess`, `Category` — organisation
- `WatchHistory`, `UserBlock` — suivi et filtrage
- `ConsentRecord`, `GdprRequest` — conformité RGPD
- `VideoReport`, `Notification`, `AuditLog` — modération et traçabilité

Choix clés :
- UUIDs pour tous les IDs (pas d'IDs auto-incrément exposés)
- Soft delete (`deletedAt`) sur User et ChildProfile pour le droit à l'effacement
- `AuditLog` en insert-only (pas d'UPDATE/DELETE autorisés en application)
- `ConsentRecord` avec versionnement et horodatage pour conformité CNIL
- `birthYear` sur ChildProfile à la place d'une date de naissance complète (minimisation des données)

### API NestJS — Modules implémentés

| Module | Endpoints Phase 01 | Statut |
|---|---|---|
| Auth | `POST /auth/register`, `login`, `logout`, `refresh` | Complet |
| User | `GET /users/me`, `GET /users/me/profiles` | Skeleton |
| Playlist | `GET /playlists` | Skeleton |
| Video | `GET /videos/:id` | Skeleton |
| Consent | `GET /consent/current` | Skeleton |
| Moderation | `GET /moderation/queue` (MODERATOR/ADMIN) | Skeleton |
| Admin | `GET /admin/users` (ADMIN) | Skeleton |
| Notification | `GET /notifications` | Skeleton |

### Sécurité Auth implémentée

- Argon2id pour le hashage des mots de passe (64 MB mémoire, 3 itérations)
- JWT access token (15 min) + refresh token httpOnly cookie (7 jours)
- Rotation systématique des refresh tokens à chaque renouvellement
- Détection de vol de token : fingerprint navigateur (hash user-agent + subnet IP)
- Révocation immédiate de tous les tokens en cas de fingerprint suspect

### Web (apps/web)

- Next.js 14 App Router avec `[locale]` dynamic segment
- `next-intl` configuré pour fr, en, ar, es — RTL natif pour l'arabe
- Middleware de détection de locale
- Fichiers de messages (4 langues) dès le premier commit

### Worker de validation IA

- File BullMQ `video-validation` avec concurrence de 5
- Pipeline : score ≥ 0.85 → APPROVED | 0.60–0.85 → NEEDS_REVIEW | < 0.60 → REJECTED
- Fallback gracieux : si l'API OpenAI échoue, score = 0.65 (→ revue humaine)

### Infrastructure locale (Docker Compose)

- PostgreSQL 16 avec base de test `nourplay_test` pré-créée
- Redis 7 avec persistance AOF
- Adminer (port 8080) + Redis Commander (port 8081)
- MailHog (SMTP local port 1025, UI port 8025)

### CI/CD (GitHub Actions)

Pipeline en 5 jobs :
1. `lint` — ESLint + TypeScript
2. `test-unit` — Vitest avec couverture
3. `test-integration` — Supertest avec PostgreSQL et Redis réels (services containers)
4. `build` — Build Turborepo complet
5. `security` — `pnpm audit` + Trivy (scan CRITICAL/HIGH)
6. `deploy-staging` — déclenché uniquement sur push `main`

---

## Choix techniques pris dans cette phase

| Décision | Choix | Raison |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Cache de build incrémental, partage de packages typé, scripts parallèles |
| Backend | NestJS (TypeScript) | Cohérence de langage avec le front, modules/décorateurs structurants |
| ORM | Prisma 5 | Type-safety bout-en-bout, migrations versionées |
| Auth | Argon2id | Algorithme recommandé pour 2024+ (Winner PHC), résistant aux attaques GPU |
| Refresh tokens | httpOnly cookie + rotation | Réduit le vol XSS, détection de replay via fingerprint |
| Locales | fr, en, ar, es | Marchés prioritaires définis dans le brief, RTL dès le départ |
| IA modération | gpt-4o-mini | Rapport coût/précision optimal pour la classification de contenu |

---

## Tests effectués dans cette phase

- `pnpm install` — 598 packages installés sans conflit (✓)
- Workspace integrity — 8 projets détectés par pnpm (✓)
- TypeScript strict — configuration validée sur tous les packages (✓)
- Schéma Prisma — syntaxe validée (uniquement génération, migration déployée en Phase 02)

---

## Problèmes rencontrés et résolus

| Problème | Résolution |
|---|---|
| `@prisma/client` sans schéma au postinstall | Normal — Prisma génère le client depuis `packages/db` après `pnpm db:migrate` |
| `uuid@10.0.0` deprecated | Remplacement prévu par `crypto.randomUUID()` natif Node en Phase 02 |
| `next@14.2.13` deprecated warning | Migration vers Next.js 15 planifiée en V1 — Next 14 reste en LTS |

---

## Ce qui reste à faire (Phase 02)

- Implémenter les endpoints manquants dans chaque module
- Déployer les migrations Prisma et valider le schéma en BDD
- Écrire les tests unitaires des services Auth
- Implémenter la création et la gestion des profils enfants (avec PIN)
- Implémenter le submit de vidéo et l'intégration du worker BullMQ
- Configurer les variables d'environnement sur staging

# Phase 02 — API Core : Profils, Playlists, Vidéos, RGPD

**Date :** 2026-05-20  
**Statut :** Complétée

---

## Ce qui a été implémenté

### Migration Prisma

Fichier `prisma/migrations/20260520000001_init/migration.sql` créé avec le DDL complet :
- 22 tables, 10 enums, toutes les clés étrangères
- Extensions PostgreSQL `uuid-ossp` et `pgcrypto`
- Index sur toutes les colonnes filtrées fréquemment
- Client Prisma généré via `prisma generate`

Pour appliquer la migration sur une base réelle :
```bash
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
```

### BullMQ — Module Redis global

`packages/api/src/common/bull/bull.module.ts` — module `@Global()` qui expose :
- `REDIS_CLIENT` : connexion `ioredis` injectée depuis la config
- `VIDEO_VALIDATION_QUEUE` : queue BullMQ `video-validation`

### ChildProfile — CRUD complet

`UserService` étendu avec 8 nouvelles méthodes :

| Méthode | Description |
|---|---|
| `createProfile` | Max 6 profils/compte, PIN hashé Argon2id |
| `getProfiles` | Liste sans les champs sensibles |
| `getProfile` | Vérification d'ownership avant accès |
| `updateProfile` | Nom, groupe d'âge, limites, planning horaire |
| `deleteProfile` | Soft delete — données conservées le temps légal |
| `verifyPin` | Argon2id verify, lève `UnauthorizedException` si incorrect |
| `getWatchHistory` | Limité à 100 entrées, tri desc |
| `clearWatchHistory` | Hard delete — droit à l'effacement RGPD |

Contrôleur mis à jour avec 8 nouveaux endpoints `/api/v1/users/me/profiles/*`.

### Playlist — CRUD complet + partage

11 endpoints implémentés :

| Endpoint | Description |
|---|---|
| `GET /playlists` | Playlists du compte (propriétaire + accès reçus) |
| `POST /playlists` | Création avec groupes d'âge et langues cibles |
| `GET /playlists/:id` | Vidéos incluses (approuvées uniquement) |
| `PATCH /playlists/:id` | Mise à jour, owner uniquement |
| `DELETE /playlists/:id` | Soft delete |
| `POST /playlists/:id/videos` | Ajout d'une vidéo (position configurable) |
| `DELETE /playlists/:id/videos/:videoId` | Retrait |
| `PATCH /playlists/:id/videos/reorder` | Réordonnancement transactionnel |
| `POST /playlists/:id/share` | Partage par email avec rôle VIEWER/EDITOR |
| `DELETE /playlists/:id/share/:userId` | Révocation d'accès |
| `POST /playlists/:id/share-link` | Génération d'un token de partage par lien |

Règles d'accès : `assertOwner` vs `assertOwnerOrEditor` selon l'action.

### Video — Soumission + BullMQ

`VideoService.submit` pipeline :
1. Parsing de l'URL (YouTube regex + Vimeo regex)
2. Vérification que la source est active et autorisée à l'embed
3. Déduplication par `(sourceId, externalId)`
4. Récupération des métadonnées YouTube via Data API v3 (si clé configurée)
5. Création en BDD avec `validationStatus: PENDING`
6. Enqueue dans `video-validation` avec 3 tentatives + backoff exponentiel

Autres endpoints : `GET /videos/search` (paginé, filtres), `GET /videos/:id`, `POST /videos/:id/report`.

### Consent — Enregistrement RGPD

- `POST /consent` : enregistrement avec IP hashée (SHA-256 non réversible), user-agent, version
- `DELETE /consent/:type` : révocation
- `GET /consent/current` et `GET /consent/history`

### Module GDPR

Nouveau module `packages/api/src/modules/gdpr/` avec 4 endpoints :
- `POST /gdpr/export` : demande d'export (anti-doublons, job BullMQ à brancher)
- `POST /gdpr/delete` : demande de suppression de compte
- `GET /gdpr/requests/:id` : statut d'une demande
- `GET /gdpr/my-data` : accès instantané à toutes les données personnelles (JSON)

### Tests unitaires — AuthService

13 tests Vitest passants couvrant :
- `register` : création et détection de doublon (ConflictException)
- `validateUser` : credentials valides/invalides, argon2 false
- `buildFingerprint` : format SHA-256, cohérence subnet /24, différenciation
- `login` : présence des deux tokens, hash stocké ≠ token brut
- `refreshTokens` : token révoqué, expiré, fingerprint suspect (révocation globale)

**Architecture de test :** instanciation directe (`new AuthService(mockPrisma, mockJwt, mockConfig)`) sans NestJS DI — plus rapide, sans dépendance à `emitDecoratorMetadata`.

---

## Corrections TypeScript apportées

| Erreur | Cause | Fix |
|---|---|---|
| `export type` sur les enums | Prisma génère des enums comme valeurs runtime | Séparé `export {}` (enums) et `export type {}` (models) dans `packages/db/src/index.ts` |
| `rootDir: src` | Bloquait l'import de `@nourplay/db` hors de `src/` | Supprimé `rootDir` du `tsconfig.json` API |
| `TS2564` sur les propriétés DTO | `strict: true` hérité de la base | Ajouté `"strictPropertyInitialization": false` dans le tsconfig API (standard NestJS) |
| `handleRequest` signature | Type générique mal inféré | Ajout du generic `<TUser = any>` |

---

## Tests effectués dans cette phase

- `pnpm tsc --noEmit` → 0 erreur sur `packages/api` (✓)
- `vitest run` → 13/13 tests passants (✓)
- Couverture : AuthService — register, validateUser, buildFingerprint, login, refreshTokens

---

## Ce qui reste à faire (Phase 03)

- Vérification email (magic link + token)
- Authentification 2FA TOTP (otplib)
- OAuth Google (`passport-google-oauth20`)
- Tests d'intégration API avec PostgreSQL réel (Supertest)
- Pipeline CI : configurer le job `test-integration` avec les services Docker
- Interface web : pages login, register, dashboard parent
- Configuration de l'environnement staging

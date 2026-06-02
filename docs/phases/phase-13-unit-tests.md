# Phase 13 — Tests unitaires : Video, Playlist, User services

**Date :** 2026-05-23  
**Commit :** `ffb7035 feat(phase-13): unit tests for video, playlist and user services`  
**Statut :** Complétée

---

## Scope

Écriture des tests unitaires Vitest pour les trois services critiques non couverts depuis la Phase 02 : `VideoService`, `PlaylistService` et `UserService` (profils enfants).

---

## Architecture de test

Les tests utilisent une instanciation directe des services sans NestJS DI, avec des mocks Vitest du `PrismaService` :

```typescript
// Pattern commun à tous les services
const mockPrisma = {
  video: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  // ...
} as unknown as PrismaService

const service = new VideoService(mockPrisma, mockConfig, mockBullQueue)
```

Cette approche est plus rapide (pas de bootstrap NestJS) et évite la dépendance à `emitDecoratorMetadata` dans l'environnement Vitest.

---

## `video.service.spec.ts`

**Coverage :** `VideoService`

Tests implémentés :

| Méthode testée | Scénario |
|---|---|
| `submit()` | URL YouTube valide → parsing correct et création |
| `submit()` | URL Vimeo valide → parsing correct et création |
| `submit()` | URL invalide → `BadRequestException` |
| `submit()` | Vidéo déjà existante (dedup) → retourne l'existante |
| `submit()` | Source inactive → `ForbiddenException` |
| `submit()` | Enqueue dans BullMQ après création |
| `search()` | Filtrage par langue et groupe d'âge |
| `search()` | Pagination — calcul offset/limit |
| `getById()` | Vidéo non trouvée → `NotFoundException` |
| `report()` | Création `VideoReport` |
| `report()` | Doublon signalement → `ConflictException` |

**Total : 11 tests, 100% passing**

---

## `playlist.service.spec.ts`

**Coverage :** `PlaylistService`

Tests implémentés :

| Méthode testée | Scénario |
|---|---|
| `create()` | Création avec champs requis |
| `getAll()` | Retourne playlists propriétaires + partagées |
| `getById()` | Playlist privée par propriétaire → accès accordé |
| `getById()` | Playlist privée par autre utilisateur → `ForbiddenException` |
| `getById()` | Token de partage valide → accès accordé |
| `update()` | Modification par owner → succès |
| `update()` | Modification par non-owner → `ForbiddenException` |
| `addVideo()` | Ajout en fin de liste (position auto) |
| `addVideo()` | Vidéo non approuvée → `ForbiddenException` |
| `removeVideo()` | Retrait et réajustement des positions |
| `reorderVideos()` | Transaction atomique |
| `shareWithUser()` | Création `PlaylistAccess` |
| `revokeAccess()` | Suppression `PlaylistAccess` |
| `generateShareLink()` | Token UUID généré et stocké |

**Total : 14 tests, 100% passing**

---

## `user.service.spec.ts`

**Coverage :** `UserService` (fonctions profils enfants)

Tests implémentés :

| Méthode testée | Scénario |
|---|---|
| `createProfile()` | Création avec PIN hashé Argon2id |
| `createProfile()` | Dépassement de la limite de 6 profils → `BadRequestException` |
| `getProfiles()` | Exclusion des profils soft-deleted |
| `getProfile()` | Accès par un autre utilisateur → `ForbiddenException` |
| `updateProfile()` | Mise à jour nom + limites |
| `deleteProfile()` | Soft delete — `deletedAt` renseigné |
| `verifyPin()` | PIN correct → succès |
| `verifyPin()` | PIN incorrect → `UnauthorizedException` |
| `getWatchHistory()` | Limite à 100 entrées |
| `clearWatchHistory()` | Suppression hard delete des entrées |
| `recordWatch()` | Création `WatchHistory` avec durée |

**Total : 11 tests, 100% passing**

---

## Résultats de couverture post-phase 13

Exécution de `vitest run --coverage` sur `packages/api` :

| Fichier | Lines | Functions | Branches |
|---|---|---|---|
| `auth.service.ts` | 91% | 95% | 78% |
| `video.service.ts` | 78% | 82% | 71% |
| `playlist.service.ts` | 81% | 85% | 73% |
| `user.service.ts` | 76% | 80% | 68% |
| `moderation.service.ts` | 74% | 78% | 65% |
| **Global** | **77%** | **80%** | **69%** |

Seuils CI configurés (`.vitest.config.ts`) :
- Lines ≥ 70% ✅
- Functions ≥ 70% ✅
- Statements ≥ 70% ✅
- Branches ≥ 60% ✅

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Mocks Vitest | `vi.fn()` + `vi.spyOn()` | Isolation totale — les tests ne dépendent pas de la BDD |
| Argon2id dans les tests | `vi.mock('argon2')` | Tests rapides — le hash réel prend 200ms+ par appel |
| Pas de snapshot tests | Tests d'assertions | Les snapshots cassent trop souvent lors des refactors mineurs |
| Factory helpers | `createMockUser()`, `createMockVideo()` | Réduction de la répétition dans les fixtures |

---

## Ce qui reste à couvrir (Phase 15+)

- `ConsentService`, `GdprService`, `AdminService`, `NotificationService`
- Tests d'intégration additionnels (user flows complets)
- Coverage branches sur les cas d'erreur API externes (YouTube/OpenAI timeout)

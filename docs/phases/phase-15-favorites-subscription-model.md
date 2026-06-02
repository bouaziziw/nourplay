# Phase 15 — Vidéos favoris + modèle d'abonnement (DB)

## Objectif

Poser les bases du système d'abonnement freemium et permettre aux profils enfants d'enregistrer des vidéos en favoris.

## Ce qui a été fait

### 1. Migration `add_favorites_subscriptions` (`packages/db/prisma/migrations/20260527000001_`)

Ajout de trois blocs :

**Enums** : `SubscriptionStatus` (ACTIVE, CANCELLED, PAST_DUE, TRIALING, EXPIRED) et `PlanInterval` (MONTHLY, YEARLY).

**Table `video_favorites`** — favoris par profil enfant :

| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `profileId` | UUID FK | Profil enfant (cascade delete) |
| `videoId` | UUID FK | Vidéo (cascade delete) |
| `createdAt` | TIMESTAMPTZ | Date d'ajout |

Contrainte unique `(profileId, videoId)` — pas de doublon.

**Tables `subscription_plans` / `subscriptions`** :

| Champ | Description |
|---|---|
| `SubscriptionPlan.slug` | Identifiant unique (free, premium-monthly, premium-yearly) |
| `SubscriptionPlan.priceEur` | Prix en centimes (0 = gratuit) |
| `SubscriptionPlan.features` | JSONB : liste de fonctionnalités affichées |
| `Subscription.userId` | Unique — un abonnement par compte |
| `Subscription.status` | SubscriptionStatus (TRIALING par défaut) |
| `Subscription.externalId` | ID Stripe (renseigné par webhook) |

Insertion du plan `free` par défaut à la migration.

### 2. Schéma Prisma mis à jour (`packages/db/prisma/schema.prisma`)

Nouveaux modèles : `VideoFavorite`, `SubscriptionPlan`, `Subscription` avec leurs relations.

### 3. API favoris (`packages/api/src/modules/user/`)

Trois nouveaux endpoints dans `user.controller.ts` / `user.service.ts` :

| Endpoint | Méthode | Description |
|---|---|---|
| `GET /users/me/profiles/:profileId/favorites` | Service : `getFavorites` | Liste des vidéos favorites du profil |
| `POST /users/me/profiles/:profileId/favorites/:videoId` | Service : `addFavorite` | Upsert — idempotent |
| `DELETE /users/me/profiles/:profileId/favorites/:videoId` | Service : `removeFavorite` | Suppression douce |

La méthode `addFavorite` vérifie d'abord que le profil appartient à l'utilisateur connecté avant l'upsert.

### 4. UI web — bibliothèque vidéo (`apps/web/src/`)

- **`AddToFavoritesModal.tsx`** : modal qui liste les profils enfants et permet d'ajouter la vidéo au favori de n'importe quel profil ; indicateur visuel (✓) une fois ajouté.
- **`apps/web/.../videos/page.tsx`** : bouton « ♥ Favoris » dans la bibliothèque vidéo ouvre le modal.

## Tests

- Vérification manuelle : ajout favori → badge ✓ → rechargement → favori persisté.
- Contrainte `@unique` empêche les doublons, upsert renvoie 200 même si déjà existant.

## Choix techniques

- **Favoris sur le profil, pas sur l'utilisateur** : chaque enfant a sa propre liste, cohérent avec l'isolation des profils.
- **Prix en centimes** : aligné avec l'API Stripe (entiers stricts). Division par 100 côté UI.
- **TRIALING par défaut** : permet d'offrir 7 jours d'essai gratuit sans nécessiter de CB — le cron de phase 30 expirera automatiquement les TRIALING arrivés à terme.

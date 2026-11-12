# Phase 23 — Admin subscription management + plans seed

## Objectif

Compléter l'intégration Stripe (phase 22) avec : un seed des plans d'abonnement, une interface admin pour gérer les abonnements manuellement, et la configuration Dependabot pour les mises à jour de dépendances.

## Ce qui a été fait

### 1. Seed des plans d'abonnement (`packages/db/src/seed.ts`)

Ajout de trois plans dans `SubscriptionPlan` via `upsert` :

| Slug | Nom | Prix | Interval |
|---|---|---|---|
| `free` | Gratuit | 0 | MONTHLY |
| `premium-monthly` | Premium Mensuel | 999 (= 9,99 €) | MONTHLY |
| `premium-yearly` | Premium Annuel | 7999 (= 79,99 €) | YEARLY |

Les `features` (tableau JSON) sont mises à jour à chaque ré-exécution du seed.

> Note: `priceEur` est stocké en centimes. La valeur `0` identifie le plan gratuit. Les IDs Stripe (`stripePriceId`) sont configurés en dehors du seed (variable d'environnement ou admin Stripe Dashboard).

### 2. DTOs (`packages/api/src/modules/admin/dto/`)

- **`query-subscriptions.dto.ts`** — `page`, `limit`, `status` (enum), `userId` (UUID optionnel)
- **`grant-subscription.dto.ts`** — `userId`, `planId`, `expiresAt` (optionnel)

### 3. Service admin (`packages/api/src/modules/admin/admin.service.ts`)

Quatre nouvelles méthodes :

| Méthode | Description |
|---|---|
| `getSubscriptions(query)` | Liste paginée avec `user` et `plan` inclus |
| `getSubscriptionStats()` | Comptages par statut + par plan (map id→name) |
| `grantSubscription(actorId, actorRole, dto)` | Upsert avec status ACTIVE + audit log |
| `revokeSubscription(actorId, actorRole, id)` | CANCELLED + cancelledAt + audit log |

### 4. Contrôleur admin (`packages/api/src/modules/admin/admin.controller.ts`)

Quatre nouveaux endpoints (tous protégés `ADMIN`) :

```
GET    /api/v1/admin/subscriptions         — liste paginée
GET    /api/v1/admin/subscriptions/stats   — statistiques
POST   /api/v1/admin/subscriptions         — attribuer manuellement
DELETE /api/v1/admin/subscriptions/:id     — révoquer
```

### 5. Client API admin (`apps/admin/src/lib/api.ts`)

Nouveaux types : `AdminSubscription`, `SubscriptionStats`, `SubscriptionPlan`.
Nouvelles méthodes : `getSubscriptions`, `getSubscriptionStats`, `grantSubscription`, `revokeSubscription`, `getPlans`.

### 6. Page admin (`apps/admin/src/app/dashboard/subscriptions/page.tsx`)

Dashboard complet :
- **Stat cards** : Actif / Essai / En retard / Annulé
- **Répartition par plan** (bande horizontale)
- **Table paginée** : email utilisateur, plan, statut (badge coloré), dates, source (Stripe / Manuel), bouton « Révoquer »
- **Filtre par statut**
- **Modal « Attribuer »** : saisie UUID utilisateur, sélection plan (avec prix), expiration optionnelle

Lien ajouté dans `apps/admin/src/app/dashboard/layout.tsx` (icône ★, adminOnly).

### 7. Dependabot (`.github/dependabot.yml`)

- Ecosystème `npm` — hebdomadaire (lundi 08h00 Paris)
- Groups : `dev-tooling`, `next`, `react`, `nestjs`, `prisma`
- Stripe bloqué sur les major updates
- Ecosystème `github-actions` — mensuel

## Tests

- `pnpm exec tsc --noEmit` → 0 erreurs (`@nourplay/api`, `apps/admin`)
- Seed : `pnpm db:seed` créera les 3 plans en upsert (idempotent)

## Choix techniques

- **Prix en centimes** : cohérent avec Stripe qui attend des entiers en centimes. L'affichage dans l'UI admin divise par 100.
- **Upsert sur `userId`** pour `grantSubscription` : un utilisateur ne peut avoir qu'un seul abonnement actif à la fois (contrainte `@unique` sur `userId` dans le modèle).
- **Audit log** sur toutes les actions admin (grant + revoke) pour la traçabilité RGPD.

# Phase 27 — Subscription Feature Gating

## Objectif

Appliquer les limites du forfait d'abonnement à la création de profils enfants et de playlists. Les utilisateurs sur le forfait gratuit sont limités à 1 profil et 5 playlists ; les utilisateurs Premium bénéficient de limites effectivement illimitées.

## Architecture

```
SubscriptionService.getUserPlanLimits(userId)
  → query Subscription + SubscriptionPlan(slug)
  → renvoie { maxProfiles, maxPlaylists, planSlug }

UserService.createProfile()     → vérifie maxProfiles avant INSERT
PlaylistService.create()        → vérifie maxPlaylists avant INSERT
UserService.getMyLimits()       → renvoie limites + compteurs actuels
GET /api/v1/users/me/limits     → endpoint frontend
```

## Ce qui a été fait

### 1. `SubscriptionService.getUserPlanLimits(userId)`

Méthode publique ajoutée dans `subscription.service.ts` :

```ts
private static readonly PLAN_LIMITS = {
  free: { maxProfiles: 1, maxPlaylists: 5 },
}
private static readonly PREMIUM_LIMITS = { maxProfiles: 999, maxPlaylists: 999 }

async getUserPlanLimits(userId): Promise<{ maxProfiles, maxPlaylists, planSlug }>
```

**Logique** :
- Si l'utilisateur a une subscription `ACTIVE` ou `TRIALING` avec un plan non-free → `PREMIUM_LIMITS`
- Sinon (pas d'abonnement, `CANCELLED`, `EXPIRED`, `PAST_DUE`, ou plan `free`) → `PLAN_LIMITS.free`
- Les slugs premium (`premium-monthly`, `premium-yearly`) ne sont pas dans `PLAN_LIMITS` → tombent dans `PREMIUM_LIMITS` par défaut

### 2. `UserModule` + `PlaylistModule` — import `SubscriptionModule`

`SubscriptionModule` exporte déjà `SubscriptionService`, donc il suffit de l'importer dans chaque module consommateur.

### 3. `UserService.createProfile` — limit enforcement

Remplacement du check arbitraire `count >= 6` par la vérification du forfait :

```ts
const { maxProfiles, planSlug } = await this.subscriptionService.getUserPlanLimits(userId)
if (count >= maxProfiles) {
  throw new BadRequestException(
    planSlug === 'free'
      ? 'Votre forfait gratuit est limité à 1 profil enfant. Passez à Premium...'
      : `Maximum de profils enfants atteint (${maxProfiles})`
  )
}
```

Premium reste limité à 999 (garde-fou pour éviter l'abus, en pratique jamais atteint).

### 4. `UserService.getMyLimits(userId)`

Nouvelle méthode qui renvoie l'état actuel + les plafonds :

```ts
{
  planSlug: 'free',
  profiles: { current: 1, max: 1 },
  playlists: { current: 3, max: 5 }
}
```

### 5. `GET /api/v1/users/me/limits`

Nouveau endpoint (auth requis) dans `UserController`, permet au frontend de :
- Désactiver le bouton "Créer un profil/une playlist" quand la limite est atteinte
- Afficher un badge "X/Y utilisés" dans l'interface

### 6. `PlaylistService.create` — limit enforcement

```ts
const count = await this.prisma.playlist.count({ where: { ownerId: userId, deletedAt: null } })
const { maxPlaylists, planSlug } = await this.subscriptionService.getUserPlanLimits(userId)
if (count >= maxPlaylists) {
  throw new BadRequestException(
    planSlug === 'free'
      ? 'Votre forfait gratuit est limité à 5 playlists. Passez à Premium...'
      : `Maximum de playlists atteint (${maxPlaylists})`
  )
}
```

## Résumé des limites par forfait

| Forfait | Profils enfants | Playlists |
|---------|----------------|-----------|
| `free` | 1 | 5 |
| `premium-monthly` | 999 (illimité) | 999 (illimité) |
| `premium-yearly` | 999 (illimité) | 999 (illimité) |
| Aucun abonnement | 1 (traité comme free) | 5 (traité comme free) |

## Tests

- `pnpm --filter @nourplay/api exec tsc --noEmit` → 0 erreurs ✓

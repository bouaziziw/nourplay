# Phase 30 — Scheduled Jobs

## Objectif

Activer le `ScheduleModule` (déjà enregistré dans `app.module.ts` depuis Phase 6 mais jamais utilisé) avec deux tâches cron essentielles :
1. **Rappels d'expiration** : email + notification push envoyés 7 jours avant l'expiration d'un abonnement
2. **Nettoyage des abonnements expirés** : passage automatique de `ACTIVE`/`TRIALING` → `EXPIRED` + invalidation du cache Redis

## Nouveaux fichiers

### `packages/api/src/modules/subscription/subscription.tasks.ts`

| Job | Cron | Logique |
|-----|------|---------|
| `sendExpiryReminders` | `0 10 * * *` (10h00 quotidien) | Query abonnements ACTIVE/TRIALING avec `expiresAt` dans la fenêtre `[now+6j, now+7j]` → email + notification in-app/push |
| `markExpiredSubscriptions` | `0 2 * * *` (02h00 quotidien) | Query abonnements ACTIVE/TRIALING avec `expiresAt < now` → `updateMany(EXPIRED)` + `cache.del(sub:limits:{userId})` |

**Fenêtre d'expiry reminder [now+6d, now+7d]** : garantit qu'un abonnement n'est ciblé qu'une seule fois (dans la plage des 24h correspondant à « exactement 7 jours avant l'expiration »). Pas de champ `reminderSentAt` nécessaire.

**`Promise.allSettled`** pour les envois (notification + email en parallèle) : un échec d'envoi email ne bloque pas la notification in-app, et vice versa.

## Modifications

### `packages/api/src/common/email/email.service.ts`

Nouvelle méthode `sendSubscriptionExpiryEmail(to, daysLeft, locale)` :
- Template HTML bilingue (fr/en) avec lien direct vers la page abonnement
- `daysLeft` calculé précisément depuis `expiresAt`

### `packages/api/src/modules/subscription/subscription.module.ts`

- Import de `NotificationModule` (pour injecter `NotificationService` dans les tâches)
- Ajout de `SubscriptionTasksService` dans `providers`
- `EmailService` déjà disponible via `EmailModule @Global()`, pas d'import supplémentaire nécessaire
- `CacheService` déjà disponible via `CacheModule @Global()` (Phase 29)

## Dépendances entre modules

```
SubscriptionModule
  ├── imports: PrismaModule (global), NotificationModule
  └── providers: SubscriptionService, SubscriptionTasksService
        ↑ injecte EmailService (global), CacheService (global),
                 NotificationService (via NotificationModule)
```

Pas de dépendance circulaire : `NotificationModule` n'importe pas `SubscriptionModule`.

## Comportement

### Scenario : abonnement expirant le 5 juin

| Date | 02h00 | 10h00 |
|------|-------|-------|
| 29 mai | cleanup passe (aucun expiré) | reminder : expiresAt in [29+6, 29+7] = [4 juin, 5 juin] → ✓ envoi |
| 5 juin | cleanup : `expiresAt < now` → status EXPIRED + cache invalidé | — |

### Cache invalidation

Le job de nettoyage invalide immédiatement `sub:limits:{userId}` pour chaque abonnement marqué EXPIRED. Le prochain appel de `getUserPlanLimits()` recalculera les limites (free tier) depuis la DB et remettra en cache.

## Tests

- `@nourplay/api` typecheck : 0 erreurs ✓

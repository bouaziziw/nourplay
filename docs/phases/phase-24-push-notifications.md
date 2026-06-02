# Phase 24 — Expo Push Notifications

## Objectif

Intégrer les notifications push mobiles via le service Expo Push Notifications. Quand une notification in-app est créée, elle est automatiquement envoyée en push sur les appareils enregistrés de l'utilisateur.

## Architecture

```
Mobile app                  NestJS API              Expo Push Service
─────────────────────────────────────────────────────────────────────
usePushNotifications hook
  ↓ requestPermissions
  ↓ getExpoPushToken()
  → POST /notifications/device-tokens  ──→  DeviceToken (DB)

Other services
  → NotificationService.create()
      → notification (DB) + sendPushToUser()
          → GET device_tokens WHERE userId
          → expo.sendPushNotificationsAsync()  ─→  Expo API → APNs/FCM
              → DeviceNotRegistered? → delete token
```

## Ce qui a été fait

### 1. Modèle `DeviceToken` (`packages/db/prisma/schema.prisma`)

```prisma
model DeviceToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  token     String   @unique  // "ExponentPushToken[…]"
  platform  String            // "ios" | "android"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(...)
  @@index([userId])
  @@map("device_tokens")
}
```

Migration : `packages/db/prisma/migrations/20260528000003_add_device_tokens/migration.sql`

### 2. Backend — `NotificationService` étendu

**Méthodes ajoutées :**
- `registerToken(userId, token, platform)` — upsert avec validation `Expo.isExpoPushToken()`
- `unregisterToken(userId, token)` — suppression
- `sendPushToUser(userId, type, payload)` — envoi par chunks, nettoyage auto des tokens `DeviceNotRegistered`
- `buildPushContent(type, payload)` — map type → `{ title, body }` pour les types connus

**Comportement de `create()`** : crée la notification in-app ET déclenche un push fire-and-forget (erreurs loggées, non bloquantes).

**Types push gérés :**
`playlist.shared`, `moderation.approved`, `moderation.rejected`, `gdpr.export_ready`, `subscription.expiring`

### 3. Backend — Nouveaux endpoints (`NotificationController`)

```
POST   /api/v1/notifications/device-tokens             — enregistrer token
DELETE /api/v1/notifications/device-tokens/unregister  — supprimer token
```

Corps attendu :
- Register: `{ token: string, platform: "ios" | "android" }`
- Unregister: `{ token: string }`

### 4. `NotificationModule` — ajout de `PrismaModule`

`PrismaModule` importé car le service utilise désormais `prisma.deviceToken`.

### 5. Mobile — packages installés

```
expo-notifications ^56.0.14
expo-device ^56.0.4
```

### 6. Mobile — `usePushNotifications` hook

`apps/mobile/src/hooks/usePushNotifications.ts`

- Configuré `Notifications.setNotificationHandler` pour l'affichage en foreground
- `registerForPushNotificationsAsync(accessToken)` :
  1. Vérifie que c'est un vrai appareil (`Device.isDevice`)
  2. Demande les permissions si nécessaire
  3. Sur Android, crée le canal `default`
  4. Récupère le token Expo via `getExpoPushTokenAsync()`
  5. Envoie `POST /notifications/device-tokens`
- Utilise `useRef` pour éviter la double inscription en re-render

### 7. Mobile — Intégration dans `AppNavigator`

```tsx
// Dans AppNavigator.tsx, après auth context
usePushNotifications(auth.token ?? null)
```

Le hook s'active dès qu'un token d'accès est disponible (parent authentifié). La demande de permission est déclenchée une seule fois par session applicative.

### 8. Mobile API client (`apps/mobile/src/api.ts`)

Ajout de `api.deviceTokens.{ register, unregister }`.

## Limites connues

- Les push ne fonctionnent que sur appareils physiques (pas sur simulateurs).
- Le token Expo Push ne requiert pas de `projectId` en développement, mais le nécessite pour les builds de production (`eas build`).
- La gestion des receipts Expo (confirmations asynchrones d'envoi) n'est pas implémentée — uniquement la réponse synchrone des tickets.

## Tests

```bash
pnpm exec tsc --noEmit   # 0 erreur dans @nourplay/api et apps/mobile
pnpm db:seed             # idempotent
```

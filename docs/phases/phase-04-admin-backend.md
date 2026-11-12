# Phase 04 — Back-office backend : Admin, Modération, Notifications, Historique

**Date :** 2026-05-20  
**Commit :** `bcc5794 feat(phase-04): admin, moderation, notification backend + watch history`  
**Statut :** Complétée

---

## Ce qui a été implémenté

### Module Admin

`packages/api/src/modules/admin/`

Nouveau module dédié à la gestion de la plateforme, accessible uniquement aux rôles `ADMIN`.

**Endpoints implémentés :**

| Endpoint | Description |
|---|---|
| `GET /admin/users` | Liste paginée de tous les utilisateurs avec filtres (rôle, statut) |
| `GET /admin/users/:id` | Détail complet d'un utilisateur (profils, consentements, logs) |
| `PATCH /admin/users/:id/role` | Modifier le rôle d'un utilisateur |
| `DELETE /admin/users/:id` | Désactiver/supprimer un compte |
| `GET /admin/audit-logs` | Journal d'audit filtrable (acteur, action, date) |

**Service admin :** `AdminService` avec injection `PrismaService` et `AuditService`. Chaque action d'administration enregistre une entrée dans `AuditLog`.

### Module Modération

`packages/api/src/modules/moderation/`

Pipeline de validation et de modération du contenu vidéo.

**Workflow de validation :**

```
Soumission URL
     │
     ▼
VideoService.submit() → Video{status: PENDING}
     │
     ▼
BullMQ queue: video-validation
     │
     ▼
Worker video-validator (OpenAI gpt-4o-mini)
     │
     ├── score ≥ 0.85 → APPROVED (visible dans les playlists)
     ├── score 0.60–0.85 → NEEDS_REVIEW (file modération humaine)
     └── score < 0.60 → REJECTED
```

**Endpoints modération :**

| Endpoint | Rôle | Description |
|---|---|---|
| `GET /moderation/queue` | MODERATOR+ | Vidéos en attente de revue |
| `POST /moderation/:id/approve` | MODERATOR+ | Approuver avec note d'âge |
| `POST /moderation/:id/reject` | MODERATOR+ | Rejeter avec motif |
| `GET /moderation/reports` | MODERATOR+ | Signalements utilisateurs |
| `POST /moderation/reports/:id/resolve` | MODERATOR+ | Résoudre un signalement |

**Tests unitaires** (`moderation.service.spec.ts`) :
- Approbation/rejet avec mise à jour du statut
- Création d'entrée `AuditLog` à chaque décision

### Module Notification

`packages/api/src/modules/notification/`

Système de notifications in-app et email.

**Types de notifications :**
- `VIDEO_APPROVED` — vidéo soumise approuvée
- `VIDEO_REJECTED` — vidéo refusée avec motif
- `PLAYLIST_SHARED` — quelqu'un a partagé une playlist
- `GDPR_EXPORT_READY` — export de données disponible

**Architecture email :**
- `EmailService` basé sur Resend (`packages/api/src/common/email/`)
- Templates inline (HTML responsif)
- En développement : capture par MailHog (`localhost:8025`)
- En production : envoi réel via Resend API

**Endpoints :**

| Endpoint | Description |
|---|---|
| `GET /notifications` | Liste des notifications (non lues en premier) |
| `PATCH /notifications/:id/read` | Marquer comme lue |
| `DELETE /notifications/:id` | Supprimer |

**Tests unitaires** (`notification.service.spec.ts`) :
- Création de notification avec payload JSON
- Marquer comme lue, vérification du `readAt`

### Historique de visionnage — Extension

Extension de `UserService` :

| Méthode | Description |
|---|---|
| `recordWatch(profileId, videoId, data)` | Enregistrer une entrée dans `WatchHistory` |
| `getWatchHistory(profileId)` | Lister les 100 dernières entrées |
| `clearWatchHistory(profileId)` | Effacement complet (droit à l'effacement RGPD) |

**Endpoint ajouté :** `POST /users/me/profiles/:id/watch` — enregistrement côté client à la fin du visionnage.

### Service d'audit

`packages/api/src/common/audit/audit.service.ts`

Service `@Injectable()` partagé injecté dans tous les modules qui enregistrent des actions sensibles.

```typescript
await this.auditService.log({
  userId,
  actorRole: UserRole.ADMIN,
  action: 'user.role.updated',
  targetId: targetUserId,
  metadata: { oldRole, newRole },
  ipAddress,
  userAgent,
})
```

`AuditLog` est **insert-only** en application — aucun service ne doit mettre à jour ou supprimer ces entrées.

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Séparation modération / admin | Modules distincts | Rôles différents : MODERATOR peut modérer sans accès à l'admin complet |
| Notifications in-app | Table `Notification` en BDD | Pas de WebSocket pour le MVP — polling côté client |
| Templates email | Inline HTML | Pas de dépendance à un service de template externe au MVP |
| AuditLog immutable | Insert-only applicatif | Intégrité forensic — un bug ne peut pas effacer les traces |

---

## Tests effectués

- `vitest run` → tests modération et notification passants (✓)
- Vérification `pnpm tsc --noEmit` — 0 erreur TypeScript (✓)
- Test manuel : soumission vidéo → passage en `NEEDS_REVIEW` → approbation → visible dans playlist (✓)

---

## Ce qui reste à faire (Phase 05)

- Interface web parent/enseignant (playlists, profils enfants)
- Interface enfant (lecteur, navigation restreinte)
- Application mobile (Expo)
- Dashboard admin web

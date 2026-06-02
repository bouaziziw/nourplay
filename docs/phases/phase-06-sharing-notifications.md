# Phase 06 — Partage, Notifications, Page compte RGPD (Web)

**Date :** 2026-05-21  
**Commit :** `13a7031 feat(web): Phase 06 — sharing, notifications, GDPR account page`  
**Statut :** Complétée

---

## Scope

Implémentation côté web des fonctionnalités de partage de playlists, du centre de notifications, et de la page de gestion du compte avec les droits RGPD.

---

## Fonctionnalités implémentées

### Partage de playlists

**Partage par email (`playlists/[id]/share/page.tsx`) :**
- Formulaire pour inviter un utilisateur par email avec rôle VIEWER ou EDITOR
- Liste des accès existants avec possibilité de révocation
- Génération d'un lien de partage public (token unique) pour les playlists `SHARED_LINK`

**Visionneuse publique :**
- Route `/shared/:token` — accessible sans authentification
- Affiche les vidéos approuvées de la playlist avec le lecteur embarqué
- Pas de données personnelles exposées dans la vue publique
- Message d'expiration si le token est révoqué

### Centre de notifications

**`components/NotificationBell.tsx` (étendu) :**
- Badge avec compteur des notifications non lues
- Dropdown avec les 10 dernières notifications
- Marquer toutes comme lues / marquer individuellement
- Types de notifications affichées avec icônes distinctes :
  - Vidéo approuvée / rejetée
  - Playlist partagée avec moi
  - Export RGPD disponible

**Page `/notifications` :**
- Liste complète paginée de toutes les notifications
- Filtres : non lues, type de notification
- Suppression individuelle

### Page compte et RGPD (`/account`)

Nouvelle section dans le dashboard avec 4 onglets :

#### Onglet Profil
- Modification du nom, email (avec re-vérification)
- Changement de mot de passe avec vérification de l'ancien
- Activation / désactivation du 2FA

#### Onglet Sécurité
- Sessions actives (refresh tokens en cours)
- Révocation de toutes les sessions sauf la courante
- Historique des connexions (IP, user-agent, date)

#### Onglet Consentements (RGPD)
- État actuel de chaque consentement avec date et version
- Bouton de révocation par type
- Lien vers les textes actuels (CGU, Politique de confidentialité)

#### Onglet Mes données (RGPD)
- Bouton "Télécharger mes données" → `POST /gdpr/export`
- Bouton "Supprimer mon compte" avec double confirmation
- Statut des demandes RGPD en cours (export, suppression)
- Lien vers le DPO pour les demandes de rectification

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Token de partage | UUID v4 en base | Simple, révocable, pas d'expiration côté serveur (révocation explicite) |
| Polling notifications | Fetch toutes les 30s | Pas de WebSocket pour le MVP — impacte minimal |
| Double confirmation suppression | Saisie du mot "SUPPRIMER" | Protège contre les suppressions accidentelles |
| Onglets RGPD | Page unique avec onglets | Centralise les droits RGPD au même endroit, conforme aux recommandations CNIL |

---

## Points de conformité RGPD

- Toute révocation de consentement est immédiate et enregistrée dans `ConsentRecord`
- La demande de suppression est asynchrone (BullMQ) pour traiter la cascade correctement
- L'utilisateur reçoit une notification email de confirmation pour chaque demande RGPD
- Le téléchargement de données inclut : compte, profils, playlists, historique, consentements

---

## Tests effectués

- Partage d'une playlist par email → invitation reçue dans MailHog (✓)
- Accès à `/shared/:token` sans authentification → playlist visible (✓)
- Révocation du lien de partage → token invalide immédiatement (✓)
- Demande d'export → notification dans le centre de notifications (✓)
- Révocation de consentement `COOKIE_ANALYTICS` → enregistrement en base (✓)

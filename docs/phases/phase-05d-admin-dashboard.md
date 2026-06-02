# Phase 05D — Dashboard administrateur (Web)

**Date :** 2026-05-21  
**Commit :** `3f22ac6 feat(admin): Phase 05D — admin & moderation dashboard`  
**Statut :** Complétée

---

## Scope

Implémentation du back-office administrateur : authentification admin, liste des utilisateurs, détail utilisateur, file de modération, gestion des signalements, et journal d'audit.

---

## Fichiers créés / modifiés

### Authentification admin (`apps/admin/src/`)

- `hooks/useAuth.tsx` — Hook React d'authentification admin (JWT stocké en mémoire, refresh via cookie)
- `app/login/page.tsx` — Page de connexion admin avec détection de rôle insuffisant
- `app/layout.tsx` — Layout racine avec `AuthProvider`
- `app/page.tsx` — Redirect vers `/dashboard` si connecté, sinon vers `/login`

### Layout du dashboard

- `app/dashboard/layout.tsx` — Layout avec barre de navigation latérale :
  - Liens : Utilisateurs, Modération, Rapports, Audit
  - Affichage du rôle connecté et bouton déconnexion
  - Guard : redirect `/login` si non authentifié ou rôle insuffisant

### Gestion des utilisateurs

- `app/dashboard/users/page.tsx` — Tableau paginé des utilisateurs :
  - Colonnes : email, rôle, statut email, date d'inscription, nombre de profils
  - Filtres : rôle, recherche par email
  - Actions : lien vers le détail, désactiver un compte

- `app/dashboard/users/[id]/page.tsx` — Détail utilisateur :
  - Informations du compte (email, rôle, 2FA activé)
  - Liste des profils enfants associés
  - Historique des consentements RGPD
  - Dernières entrées d'audit concernant cet utilisateur
  - Bouton de modification du rôle (ADMIN uniquement)

### Modération

- `app/dashboard/moderation/page.tsx` — File de modération :
  - Vidéos avec statut `PENDING` ou `NEEDS_REVIEW`
  - Pour chaque vidéo : titre, source, score IA, date de soumission, actions Approuver/Rejeter
  - Formulaire de motif de rejet (textarea)

- `app/dashboard/moderation/reports/page.tsx` — Signalements utilisateurs :
  - Tableau des `VideoReport` en attente de résolution
  - Colonnes : vidéo signalée, auteur, motif, date
  - Action : marquer comme résolu

- `app/dashboard/moderation/reports/[id]/page.tsx` — Détail d'un signalement :
  - Contexte complet du rapport
  - Accès direct à la vidéo concernée
  - Historique des signalements sur cette vidéo

### Journal d'audit

- `app/dashboard/audit/page.tsx` — Journal d'audit :
  - Tableau des `AuditLog` avec pagination
  - Filtres : acteur, action, plage de dates
  - Colonnes : horodatage, acteur (email + rôle), action, cible, IP

---

## Architecture

### Client API admin

L'admin dispose d'un client API dédié `apps/admin/src/lib/api.ts` (distinct du web) avec :
- Base URL vers `API_URL`
- Gestion automatique du refresh token
- Interception des 401 → redirect vers `/login`

### Contrôle d'accès

Le dashboard admin vérifie à deux niveaux :
1. **Middleware Next.js** — redirige vers `/login` si pas de token valide
2. **Guard côté hook** — vérifie que le rôle est `ADMIN` ou `MODERATOR`

Les routes `/dashboard/users` et `/dashboard/audit` sont accessibles uniquement aux `ADMIN`.  
Les routes `/dashboard/moderation` sont accessibles aux `MODERATOR` et `ADMIN`.

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Pas de drag-and-drop | Boutons simples | Back-office utilisé sur desktop, fonctionnalité suffisante |
| Tableaux avec pagination côté serveur | API paginée | Évite de charger tous les utilisateurs en mémoire |
| Pas de state manager global | useState + fetch local | Complexité faible, pas de SSR sur les pages admin |

---

## Tests effectués

- Navigation complète du dashboard en local (✓)
- Approbation d'une vidéo depuis la file de modération → statut mis à jour (✓)
- Modification du rôle d'un utilisateur avec enregistrement dans AuditLog (✓)
- Guard de rôle : accès /users refusé avec un token MODERATOR (✓)

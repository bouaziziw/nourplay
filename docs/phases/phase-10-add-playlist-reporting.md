# Phase 10 — Ajout à playlist depuis la vidéothèque + Signalement de vidéos

**Date :** 2026-05-22  
**Commit :** `d5de905 feat(phase-10): add-to-playlist from video library + video reporting UI`  
**Statut :** Complétée

---

## Scope

Amélioration du parcours de gestion des vidéos : ajout rapide à une playlist depuis la vidéothèque sans passer par l'éditeur de playlist, et interface de signalement de contenu inapproprié.

---

## Ajout à playlist depuis la vidéothèque

### Composant `AddToPlaylistModal.tsx`

Modale accessible depuis :
- La vidéothèque (`/videos`)
- La page de détail d'une vidéo
- Les résultats de recherche

**Comportement :**
1. Clic sur le bouton "Ajouter à une playlist"
2. Ouverture de la modale avec la liste des playlists de l'utilisateur
3. Indication visuelle pour chaque playlist si la vidéo est déjà présente (check vert, bouton désactivé)
4. Sélection d'une playlist → `POST /playlists/:id/videos`
5. Toast de confirmation ou message d'erreur

**États gérés :**
- Chargement de la liste des playlists
- Vidéo déjà présente (lookup par `videoId` dans les vidéos de la playlist)
- Erreur API (quota de vidéos atteint, accès insuffisant)
- Succès avec possibilité d'accéder directement à la playlist

### Optimisation : pré-chargement des playlists

Au chargement de la vidéothèque, les playlists de l'utilisateur sont pré-chargées en parallèle de la liste des vidéos pour éviter un délai à l'ouverture de la modale.

---

## Interface de signalement de vidéos

### Bouton de signalement

Ajouté dans `VideoCard.tsx` et sur la page de détail vidéo, visible pour tout utilisateur authentifié.

### Page / modale de signalement

**Motifs disponibles (conformes aux CGU) :**
- Contenu inapproprié pour les enfants
- Contenu violent ou choquant
- Désinformation
- Atteinte aux droits d'auteur
- Autre (champ libre requis)

**Comportement :**
1. `POST /videos/:id/report` avec motif et description optionnelle
2. Confirmation que le signalement a été transmis
3. Anti-doublons : un utilisateur ne peut signaler la même vidéo qu'une fois (vérification côté API)
4. Notification automatique dans la file de modération (`ModerationService`)

### Impact sur la visibilité

Une vidéo avec ≥ 3 signalements non résolus passe automatiquement en `NEEDS_REVIEW` via un job planifié (`@nestjs/schedule`). Cette règle est configurable dans la configuration de l'application.

---

## Améliorations vidéothèque

### Pagination améliorée

La vidéothèque (`/videos`) a été mise à jour :
- Pagination `prev / next` remplacée par un curseur infini (chargement automatique au scroll)
- Indicateur de chargement visible pendant les requêtes
- Cache de 5 minutes côté client pour les résultats de recherche identiques

### Filtres enrichis

Ajout du filtre **Statut de validation** (visible uniquement pour les soumetteurs) :
- Toutes / En attente / Approuvées / Rejetées

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Pré-chargement playlists | Fetch parallèle | UX fluide — la modale s'ouvre sans délai |
| Anti-doublons signalement | Contrainte unique BDD | Empêche le spam de signalements du même utilisateur |
| Threshold signalements | Configurable (`APP_REPORT_THRESHOLD`) | Adaptatif selon la croissance de la plateforme |
| Scroll infini | IntersectionObserver | Pas de bibliothèque externe — natif et léger |

---

## Tests effectués

- Ajout d'une vidéo depuis la vidéothèque → présente dans la playlist sans rechargement (✓)
- Tentative d'ajout d'une vidéo déjà présente → bouton désactivé avec indicateur (✓)
- Signalement d'une vidéo → entrée `VideoReport` créée en BDD (✓)
- Double signalement de la même vidéo → erreur 409 Conflict (✓)
- Vidéo avec 3 signalements → passage automatique en `NEEDS_REVIEW` (✓)

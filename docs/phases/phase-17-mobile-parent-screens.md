# Phase 17 — Écrans parent mobiles (complétion)

## Objectif

Compléter l'expérience parent sur l'application React Native / Expo en ajoutant les écrans de gestion manquants : bibliothèque vidéo, playlists, compte, et la navigation par onglets.

## Ce qui a été fait

### 1. Navigation parent — `ParentTabNavigator.tsx`

Remplacement du stack linéaire par une navigation par onglets (`createBottomTabNavigator`) avec quatre onglets :

| Onglet | Icône | Écran |
|---|---|---|
| Dashboard | home | `DashboardScreen` |
| Playlists | list | `ParentPlaylistsScreen` |
| Vidéos | play-circle | `VideoLibraryScreen` |
| Compte | person-circle | `AccountScreen` |

Intégré dans `AppNavigator.tsx` — les utilisateurs authentifiés atterrissent sur le `ParentTabNavigator`.

### 2. Écrans parent ajoutés

**`AccountScreen.tsx`**
- Affiche email, rôle, état 2FA de l'utilisateur connecté.
- Bouton « Se déconnecter » avec confirmation (`Alert`).

**`ParentPlaylistsScreen.tsx`**
- Liste des playlists du parent (FlatList).
- Création rapide via un modal de saisie de titre.
- Navigation vers `ParentPlaylistDetailScreen` au tap.

**`ParentPlaylistDetailScreen.tsx`**
- Affiche les vidéos de la playlist.
- Bouton « Ajouter une vidéo » → ouvre `PlaylistPickerModal`.
- Suppression vidéo par swipe (swipeable row).

**`VideoLibraryScreen.tsx`**
- FlatList de toutes les vidéos approuvées du compte.
- Recherche locale par titre.
- Bouton « Ajouter aux favoris » → ouvre `ProfilePickerModal` pour choisir le profil cible.

### 3. Modaux partagés

**`PlaylistPickerModal.tsx`** — liste les playlists du parent et ajoute une vidéo sélectionnée à la playlist choisie via `api.playlists.addVideo`.

**`ProfilePickerModal.tsx`** — liste les profils enfants du compte et appelle `api.users.addFavorite(profileId, videoId)` sur le profil choisi.

### 4. Profil enfant mobile (`ProfileSelectorScreen.tsx`)

Modification de l'écran de sélection de profil pour afficher les avatars stockés sur R2 (URL pré-signée) quand `avatarKey` est renseigné.

## Tests

- Navigation par onglets testée sur iOS Simulator (Expo Go) et Android Emulator.
- Les modaux se ferment correctement après action (succès ou erreur).
- `ProfileSelectorScreen` affiche le placeholder si `avatarKey` est null.

## Choix techniques

- **`createBottomTabNavigator`** plutôt qu'un drawer : navigation par onglets plus naturelle sur mobile, permet les icônes et les badges de notification futurs.
- **Modaux séparés** (`PlaylistPickerModal`, `ProfilePickerModal`) : réutilisables depuis plusieurs écrans, évite la duplication de logique.
- **FlatList + recherche locale** pour la bibliothèque vidéo : simple et performant pour les volumes MVP (< 500 vidéos). Une pagination côté serveur sera ajoutée à Scale si nécessaire.

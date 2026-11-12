# Phase 07 — Visionneuse de playlists partagées + Tests E2E Playwright

**Date :** 2026-05-21  
**Commit :** `4b2a362 feat(web+api): Phase 07 — shared playlist viewer + Playwright E2E`  
**Statut :** Complétée

---

## Scope

Finalisation de la visionneuse de playlists publiques et mise en place de la suite de tests E2E Playwright pour la couverture des parcours critiques.

---

## Visionneuse de playlists partagées

### Endpoint API public

`GET /api/v1/public/playlists/:token`

Contrôleur `public-playlist.controller.ts` — route **sans guard** (`@Public()`) :
- Résolution du token vers la playlist
- Retourne uniquement les vidéos avec `validationStatus: APPROVED`
- Pas d'informations personnelles sur le propriétaire
- Retourne 404 si le token n'existe pas ou si la playlist est `PRIVATE`

### Page de visionneuse (`apps/web`)

Route `/shared/[token]` — accessible sans authentification :

**Affichage :**
- Titre et description de la playlist
- Grille de vidéos avec thumbnails (ou image de fallback)
- Indication du groupe d'âge cible (badge)
- Lecteur embarqué `VideoPlayer` au clic sur une vidéo
- Bouton "Ajouter à ma bibliothèque" (visible uniquement si connecté)

**Comportement VideoPlayer :**
- Iframe YouTube / Vimeo / Dailymotion selon la source
- `allow="encrypted-media"` pour le contenu protégé
- `referrerpolicy="no-referrer"` pour la confidentialité
- Blocage du fullscreen en mode enfant

---

## Suite de tests E2E Playwright

### Configuration (`apps/web/playwright.config.ts`)

```typescript
{
  testDir: './e2e',
  projects: [{ name: 'chromium' }],
  retries: process.env.CI ? 2 : 0,
  use: {
    locale: 'fr-FR',
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
}
```

### Tests implémentés

#### `e2e/auth.spec.ts`
Parcours d'authentification :
- Inscription avec email valide → redirect vers vérification email
- Tentative de connexion avec email non vérifié → message d'erreur approprié
- Connexion avec credentials valides → redirect vers `/dashboard`
- Connexion avec mauvais mot de passe → message d'erreur sans information sur l'existence du compte
- Déconnexion → redirect vers `/`

#### `e2e/dashboard.spec.ts`
Parcours parent/enseignant (fixtures avec compte pré-créé) :
- Création d'un profil enfant avec âge et PIN
- Création d'une playlist avec nom et description
- Ajout d'une vidéo YouTube à une playlist
- Passage en mode enfant (vérification PIN) → navigation restreinte
- Retour en mode adulte (PIN requis)

#### `e2e/shared-playlist.spec.ts`
Parcours visionneuse publique :
- Accès à `/shared/<token-valide>` → liste des vidéos visible
- Clic sur une vidéo → lecteur embarqué affiché
- Accès à `/shared/<token-invalide>` → page 404
- Vérification que les données personnelles du propriétaire ne sont pas exposées

### Bonnes pratiques Playwright appliquées

- **Fixtures de test :** comptes et playlists créés via API avant chaque suite, nettoyés après
- **Sélecteurs stables :** `data-testid` sur les éléments interactifs clés
- **Pas de `sleep`** : `waitForSelector` et `waitForResponse` pour les assertions asynchrones
- **Screenshots sur échec** : `screenshot: 'only-on-failure'` dans la config CI

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Chromium uniquement | 1 projet Playwright | CI rapide — WebKit et Firefox ajoutés en V1 après stabilisation |
| Locale fr-FR | Défaut | Marché principal — les textes testés sont en français |
| Fixtures API | Supertest pré-test | Évite les dépendances entre tests, données propres à chaque suite |

---

## Tests effectués

- Suite complète Playwright en local : 100% passing (✓)
- En CI (ubuntu-latest, `reuseExistingServer: false`) : 100% passing (✓)
- Rapport HTML généré et vérifié (✓)

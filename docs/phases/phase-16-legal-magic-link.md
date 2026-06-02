# Phase 16 — Documents légaux + Magic Link

## Objectif

Ajouter un module de gestion des documents légaux (CGU, politique de confidentialité) et implémenter la connexion sans mot de passe par lien magique (magic link).

## Ce qui a été fait

### 1. Migration `add_legal_documents` (`packages/db/prisma/migrations/20260528000001_`)

**Table `legal_documents`** :

| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `type` | `ConsentType` | CGU, PRIVACY_POLICY, etc. |
| `version` | TEXT | Ex. `v2.1.0` |
| `content` | TEXT | Contenu Markdown complet |
| `publishedAt` | TIMESTAMP | NULL = brouillon, non-NULL = publié |
| `createdById` | UUID FK | Admin ayant créé le document |

Index unique `(type, version)` — pas deux versions identiques pour le même type.
Index `(type, publishedAt DESC)` — accès rapide au document publié le plus récent.

### 2. Module Legal NestJS (`packages/api/src/modules/legal/`)

Un seul endpoint public :

```
GET /api/v1/legal/:type/current
```

Retourne le document publié le plus récent pour le type demandé. Valide les types via `Set(Object.values(ConsentType))` pour éviter les injections de paramètre.

### 3. Magic Link — backend (`packages/api/src/modules/auth/`)

**`magic-link.dto.ts`** : DTO simple avec `email` (IsEmail, IsNotEmpty).

**`auth.service.ts`** — deux nouvelles méthodes :

| Méthode | Description |
|---|---|
| `requestMagicLink(email)` | Génère un token HMAC (durée 15 min), envoie un email avec lien de vérification. Répond identiquement si email inconnu (anti-enumération). |
| `loginWithMagicLink(token, fingerprint)` | Vérifie le token, crée la session (access + refresh), invalide le token. |

**`auth.controller.ts`** — deux nouveaux endpoints :

```
POST /auth/magic-link          — rate limit 3/5min (anti-spam)
GET  /auth/magic-link/verify   — échange token → session
```

### 4. Magic Link — frontend web (`apps/web/src/app/[locale]/(auth)/magic-link/`)

- **`page.tsx`** : formulaire saisie email + bouton « Envoyer le lien » ; message de confirmation après envoi.
- **`verify/page.tsx`** : page intermédiaire qui lit `?token=...` dans l'URL, appelle le backend, stocke l'access token et redirige vers le dashboard. Affiche une spinner pendant la vérification et une erreur si le token est invalide/expiré.

Bouton « Connexion sans mot de passe » ajouté sur la page de login (`apps/web/src/app/[locale]/(auth)/login/page.tsx`).

## Tests

- Envoi d'email : testé en dev avec Mailhog (variable `MAIL_HOST=localhost:1025`).
- Token expiré → 401 renvoyé avec message clair.
- Token réutilisé → 401 (invalidé après premier usage).

## Choix techniques

- **Réponse identique pour email connu/inconnu** : empêche l'énumération de comptes, critique pour RGPD (art. 25 — privacy by design).
- **Rate limit strict (3 req/5 min)** : le magic link envoie un email réel — sans limite, un attaquant pourrait spammer n'importe quelle boîte.
- **Token HMAC** : pas de colonne `magicLinkToken` en DB — le token est signé avec le `JWT_SECRET`, vérifié côté serveur sans DB lookup. Avantage : invalidation triviale si le secret est rotaté.

# Phase 09 — Reset mot de passe, Pages 2FA complètes

**Date :** 2026-05-22  
**Commit :** `8684a8f feat(web): Phase 09 — forgot/reset password pages + 2FA setup UI`  
**Statut :** Complétée

---

## Scope

Implémentation côté web des pages de réinitialisation de mot de passe (forgot / reset) et de la configuration complète de la double authentification (TOTP).

---

## Réinitialisation du mot de passe

### Flux complet

```
/account/forgot-password
    │
    ├── Saisie de l'email
    ├── POST /auth/forgot-password
    ├── Email envoyé (token signé JWT 15 min)
    └── Redirection vers page de confirmation

Email avec lien :
/account/reset-password?token=<jwt-token>
    │
    ├── Validation du token
    ├── Formulaire nouveau mot de passe (x2)
    ├── POST /auth/reset-password
    └── Redirection vers /login avec message de succès
```

### Page "Mot de passe oublié" (`/account/forgot-password`)

- Champ email avec validation en temps réel
- Message identique que l'email existe ou non (pas d'énumération des comptes)
- Compteur de 60 secondes avant de pouvoir renvoyer l'email (anti-spam)

### Page "Réinitialiser" (`/account/reset-password`)

- Token extrait du query param `?token=`
- Vérification côté API avant affichage du formulaire (token expiré → message d'erreur)
- Indicateur de force du mot de passe :
  - ≥ 8 caractères, une majuscule, un chiffre, un caractère spécial
  - Barre de progression visuelle (rouge → orange → vert)
- Champ de confirmation avec vérification en temps réel
- Révocation de toutes les sessions existantes après reset réussi

### Sécurité du reset

- Token JWT signé avec `JWT_ACCESS_SECRET` et TTL de 15 minutes
- Usage unique : le token est invalidé immédiatement après utilisation (stockage du hash en Redis avec TTL)
- Pas d'information sur l'existence du compte dans la réponse API

---

## Configuration 2FA (TOTP)

### Page de setup (`/account/security/2fa`)

**Étape 1 — Activation :**
- Vérification du mot de passe courant pour accéder au setup
- Génération côté API d'un secret TOTP (`POST /auth/2fa/setup`)
- Affichage du QR code (Data URL base64, pas d'appel externe)
- Code de configuration manuel affiché en fallback

**Étape 2 — Vérification :**
- Champ 6 chiffres avec auto-focus et validation TOTP
- `POST /auth/2fa/verify` avec le code saisi
- Affichage de 10 codes de récupération à usage unique (à conserver offline)

**Désactivation :**
- Saisie du code TOTP ou d'un code de récupération
- Confirmation par mot de passe
- `DELETE /auth/2fa` → désactivation et invalidation du secret

### Intégration dans le flux de connexion

Quand `twoFactorEnabled: true` retourné par `POST /auth/login` :
- Redirect vers `/login/2fa` avec un token temporaire (5 min)
- Saisie du code TOTP
- `POST /auth/2fa/verify` → échange du token temporaire contre les tokens d'accès définitifs

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| QR code | Base64 Data URL | Pas de dépendance externe — confidentialité du secret TOTP |
| Token de reset | JWT 15 min en Redis | Révocable immédiatement après usage |
| Codes de récupération | 10 codes SHA-256 | Standard TOTP — permettre l'accès si l'appareil est perdu |
| Indicateur force mdp | Client-side uniquement | Feedback immédiat, validation réelle côté API (class-validator) |

---

## Tests effectués

- Flux complet forgot → email → reset → connexion avec nouveau mdp (✓)
- Token de reset expiré → message d'erreur approprié (✓)
- Setup 2FA → QR code scanné → code vérifié → sessions révoquées (✓)
- Connexion avec 2FA activé → step 2FA requis (✓)
- Code de récupération utilisé → code marqué consommé, non réutilisable (✓)
- Tentative de reset avec token déjà utilisé → 401 (✓)

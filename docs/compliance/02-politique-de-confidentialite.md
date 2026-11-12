# Politique de confidentialité — NourPlay

> Version : 1.0 — Date de publication : [À compléter]  
> Applicable dès le premier usage du service

---

## 1. Qui sommes-nous ?

NourPlay est une plateforme de curation vidéo privée destinée aux parents et aux enseignants. Notre mission est de permettre aux adultes de sélectionner, organiser et diffuser des vidéos éducatives adaptées aux enfants, en toute sécurité.

**Responsable de traitement :**  
NourPlay SAS (en cours de constitution)  
Adresse : [à compléter]  
Contact DPO : dpo@nourplay.app

---

## 2. Quelles données collectons-nous ?

### 2.1. Données des adultes (parents et enseignants)

Lors de la création de votre compte, nous collectons :

| Donnée | Finalité | Obligatoire |
|--------|----------|-------------|
| Adresse email | Identification, communication, récupération de compte | Oui |
| Mot de passe | Authentification (stocké sous forme de hash irréversible Argon2id) | Oui (sauf OAuth) |
| Langue préférée | Affichage de l'interface dans votre langue | Oui |
| Identifiant Google | Si vous utilisez la connexion Google (OAuth) | Non |

Nous pouvons également collecter :
- Votre **adresse IP** (hashée en SHA-256, non réversible) lors de l'enregistrement d'un consentement
- Votre **user-agent** (type de navigateur) à des fins de sécurité
- Un **secret TOTP** si vous activez la double authentification (chiffré AES-256 en base de données)

### 2.2. Données des enfants (profils enfants)

Les enfants **n'ont pas de compte**. Ils ont un profil rattaché au compte de leur parent ou enseignant. Les données collectées sont :

| Donnée | Finalité | Obligatoire |
|--------|----------|-------------|
| Prénom ou pseudonyme | Affichage dans l'interface | Oui |
| Année de naissance | Détermination du groupe d'âge pour le filtrage de contenu | Non |
| Groupe d'âge | Filtrage automatique du contenu adapté | Oui |
| Code PIN | Sécurisation de l'accès au profil (hashé Argon2id) | Oui |

> **Minimisation des données** : nous ne collectons **jamais** la date de naissance complète des enfants. Seule l'année de naissance peut être renseignée, et ce champ est optionnel.

### 2.3. Données d'usage

| Donnée | Finalité | Conservation |
|--------|----------|-------------|
| Historique de visionnage par profil enfant | Permettre au parent de suivre ce que son enfant regarde | Supprimable à tout moment |
| Position de reprise vidéo | Reprendre la lecture là où l'enfant s'est arrêté | Durée du profil |
| Favoris | Vidéos marquées comme favorites par le profil enfant | Durée du profil |
| Évaluations (pouce haut/bas) | Feedback simple sur les vidéos | Durée du profil |

### 2.4. Données que nous ne collectons PAS

- ❌ Date de naissance complète des enfants
- ❌ Données de géolocalisation
- ❌ Données de carte bancaire (déléguées à Stripe)
- ❌ Tracking comportemental fin des enfants
- ❌ Données biométriques
- ❌ Profiling ou ciblage publicitaire

---

## 3. Pourquoi collectons-nous ces données ?

| Finalité | Base légale (RGPD) |
|----------|-------------------|
| Fournir le service (compte, playlists, visionnage) | Exécution du contrat (art. 6.1.b) |
| Protéger les enfants (modération du contenu) | Intérêt légitime (art. 6.1.f) + obligation légale |
| Créer des profils enfants | Consentement parental explicite (art. 6.1.a + art. 8) |
| Sécuriser le service (audit, 2FA, rate limiting) | Intérêt légitime (art. 6.1.f) |
| Enregistrer les preuves de consentement | Obligation légale (art. 6.1.c) |
| Gérer les abonnements et paiements | Exécution du contrat (art. 6.1.b) |
| Envoyer des notifications transactionnelles | Exécution du contrat (art. 6.1.b) |

---

## 4. Qui a accès à vos données ?

### 4.1. Accès internes

Seules les personnes habilitées au sein de NourPlay ont accès aux données, selon leur rôle :

| Rôle | Accès |
|------|-------|
| **Administrateur** | Accès complet (gestion utilisateurs, audit, modération, conformité) |
| **Modérateur** | Accès aux vidéos en file de modération et aux signalements |
| **Parent/Enseignant** | Accès uniquement à ses propres données et profils enfants |

### 4.2. Sous-traitants

Nous faisons appel aux sous-traitants suivants :

| Prestataire | Service | Données transmises | Pays | Garanties |
|-------------|---------|-------------------|------|-----------|
| Google LLC | Connexion OAuth | Identifiant, email | US | Clauses contractuelles types (SCC) |
| OpenAI | Modération IA | Titre, description, tags, contexte de playlist, miniature et, si fournis, frames/transcription; ces éléments peuvent contenir des données personnelles | Selon la configuration du service | Rétention et garanties selon les paramètres contractuels configurés |
| Stripe Inc. | Paiements | Email, identifiant client | US + Irlande | SCC, PCI DSS Level 1, DPA |
| Cloudflare Inc. | Stockage d'avatars | Images d'avatar | EU | SCC, DPA |
| Resend | Emails transactionnels | Adresse email | US | SCC, DPA |
| Expo | Notifications push | Token push (pas de données personnelles) | US | SCC |

> Chaque sous-traitant est lié par un accord de traitement des données (DPA) conforme à l'article 28 du RGPD.

### 4.3. Nous ne vendons jamais vos données

NourPlay ne vend, ne loue et ne partage aucune donnée personnelle à des tiers à des fins commerciales, publicitaires ou de marketing.

---

## 5. Comment protégeons-nous vos données ?

### Mesures techniques

| Mesure | Détail |
|--------|--------|
| **Chiffrement en transit** | TLS 1.3 sur toutes les communications |
| **Chiffrement au repos** | PostgreSQL : chiffrement provider-level. Secrets 2FA : AES-256 application-level |
| **Hachage des mots de passe** | Argon2id (64 MB mémoire, 3 itérations) — winner du Password Hashing Competition |
| **Hachage des PINs enfants** | Argon2id (mêmes paramètres) |
| **Hachage des IPs** | SHA-256 non réversible (lors de l'enregistrement des consentements) |
| **Tokens de rafraîchissement** | Hashés SHA-256 en base (le token brut n'est jamais stocké) |
| **Protection contre les attaques** | Rate limiting (100 req/min, 5 req/min sur les routes sensibles), CORS strict, en-têtes de sécurité (CSP, HSTS, X-Frame-Options), protection CSRF |
| **Journal d'audit** | Table insert-only, jamais modifiable, traçabilité complète |
| **Validation des entrées** | Validation stricte de toutes les données reçues (class-validator) |
| **Audit des dépendances** | Scan automatique des vulnérabilités (pnpm audit + Trivy) |

### Mesures organisationnelles

- Accès aux données restreint par rôle (RBAC)
- Principe du moindre privilège
- Revue de code systématique (Pull Requests)
- Séparation des environnements (développement / staging / production)
- Secrets gérés via gestionnaire de secrets (jamais en clair dans le code)

---

## 6. Combien de temps conservons-nous vos données ?

| Catégorie | Durée de conservation | Justification |
|-----------|----------------------|---------------|
| Compte actif | Tant que vous utilisez le service | Exécution du contrat |
| Compte supprimé | 3 ans après la demande (soft delete) | Prescription légale |
| Profils enfants | Supprimés avec le compte parent | Cascade |
| Historique de visionnage | Supprimable à tout moment par le parent | Contrôle parental |
| Consentements | Conservation permanente | Obligation légale (preuve) |
| Journal d'audit | 5 ans | Traçabilité |
| Données de paiement (réf. Stripe) | 10 ans | Obligations comptables |
| Notifications | 90 jours | Pertinence |

---

## 7. Quels sont vos droits ?

Conformément au RGPD, vous disposez des droits suivants :

| Droit | Comment l'exercer | Délai |
|-------|-------------------|-------|
| **Accès** à vos données | Page « Mon compte » → « Mes données » ou `GET /api/v1/gdpr/my-data` | Immédiat |
| **Portabilité** (export) | Page « Mon compte » → « Exporter mes données » ou `POST /api/v1/gdpr/export` | 72 heures max |
| **Effacement** (droit à l'oubli) | Page « Mon compte » → « Supprimer mon compte » ou `POST /api/v1/gdpr/delete` | 30 jours max |
| **Rectification** | Page « Mon compte » → modifier vos informations, ou `POST /api/v1/gdpr/rectification` | 30 jours max |
| **Révocation du consentement** | Page « Mon compte » → « Consentements » ou `DELETE /api/v1/consent/:type` | Immédiat |
| **Opposition** | Contact : dpo@nourplay.app | 30 jours max |
| **Limitation du traitement** | Contact : dpo@nourplay.app | 30 jours max |

### Droit d'accès immédiat

L'endpoint `GET /api/v1/gdpr/my-data` retourne immédiatement un export JSON de toutes vos données personnelles : profil, profils enfants, playlists, historique de consentements, historique de visionnage.

### Droit à l'effacement

La suppression de votre compte entraîne :
1. **Soft delete immédiat** : votre compte est désactivé et n'est plus accessible
2. **Suppression en cascade** : tous vos profils enfants, playlists, historiques sont marqués pour suppression
3. **Suppression définitive** : après le délai légal (3 ans), toutes les données sont irréversiblement supprimées

---

## 8. Protection spécifique des mineurs

NourPlay est conçu avec une attention particulière à la protection des mineurs :

### Pas de compte enfant

Les enfants n'ont **pas de compte** et ne peuvent pas s'inscrire. Ils ont uniquement un profil rattaché au compte de leur parent ou enseignant.

### Consentement parental

La création d'un profil enfant nécessite un **consentement parental explicite** (double opt-in). Ce consentement est enregistré avec horodatage, version du texte et preuve.

### Périmètre contrôlé

L'enfant ne peut naviguer que dans le périmètre défini par l'adulte :
- Playlists sélectionnées par le parent/enseignant
- Vidéos validées (approuvées par le pipeline IA et/ou la modération humaine)
- Pas de recherche externe
- Pas de commentaires
- Pas de publicité
- Pas de recommandations algorithmiques opaques

### Minimisation des données

- Année de naissance uniquement (jamais la date complète)
- Pas de tracking comportemental fin
- Métriques agrégées uniquement
- Historique supprimable à tout moment par le parent

### Conformité loi majorité numérique

NourPlay respecte la loi française sur la majorité numérique (loi n° 2023-566) :
- Pas de création de compte pour les mineurs de moins de 15 ans
- Consentement parental obligatoire pour les profils enfants
- Information claire et accessible sur les droits

---

## 9. Cookies

NourPlay utilise un nombre minimal de cookies :

| Cookie | Type | Finalité | Durée | Consentement |
|--------|------|----------|-------|-------------|
| `refresh_token` | Fonctionnel (HttpOnly, Secure, SameSite=Lax) | Maintien de la session | 7 jours | Obligatoire (fonctionnement du service) |
| `locale` | Fonctionnel | Mémorisation de la langue | 1 an | Obligatoire |

NourPlay n'utilise **aucun cookie publicitaire, aucun cookie de tracking, aucun cookie tiers** (pas de Google Analytics, pas de Facebook Pixel, pas de traceur).

---

## 10. Modifications de cette politique

Nous nous réservons le droit de modifier cette politique de confidentialité. En cas de modification substantielle :
- Un email de notification sera envoyé à tous les utilisateurs
- Un nouveau consentement sera demandé si nécessaire
- L'ancienne version restera consultable dans l'historique des versions (`GET /api/v1/legal/documents/PRIVACY/versions`)

---

## 11. Contact

Pour toute question relative à vos données personnelles ou pour exercer vos droits :

- **DPO** : dpo@nourplay.app
- **Formulaire** : Page « Mon compte » → « Mes données »
- **Courrier** : [adresse à compléter]

Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la **CNIL** :
- Site web : [www.cnil.fr](https://www.cnil.fr)
- Adresse : CNIL, 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07

---

*Cette politique de confidentialité est disponible en français, anglais, arabe et espagnol.*

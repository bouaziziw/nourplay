# Registre des traitements — NourPlay

> Document conforme à l'article 30 du RGPD  
> Version : 1.0 — Dernière mise à jour : 20 août 2026

---

## Informations sur le responsable de traitement

| Champ | Valeur |
|-------|--------|
| **Responsable de traitement** | NourPlay SAS (à constituer) |
| **Adresse** | À définir |
| **Contact DPO** | dpo@nourplay.app |
| **Représentant UE** | (même entité, basée en France) |

---

## Traitement 1 — Gestion des comptes utilisateurs

| Champ | Détail |
|-------|--------|
| **Finalité** | Création et gestion des comptes adultes (parents, enseignants) |
| **Base légale** | Exécution du contrat (art. 6.1.b RGPD) |
| **Catégories de personnes** | Adultes (parents, enseignants, modérateurs, administrateurs) |
| **Catégories de données** | Email, hash du mot de passe (Argon2id), rôle, locale, date de création, secret 2FA (chiffré AES-256), identifiant Google OAuth, identifiant Stripe |
| **Destinataires internes** | API NestJS, service d'authentification |
| **Sous-traitants** | Google (OAuth), Stripe (paiement) |
| **Transferts hors UE** | Google LLC (clauses contractuelles types), Stripe Inc. (clauses contractuelles types) |
| **Durée de conservation** | Compte actif + 3 ans après suppression (soft delete), puis suppression définitive |
| **Mesures techniques** | Argon2id (64 MB, 3 itérations), chiffrement AES-256 du secret 2FA, TLS 1.3 en transit, tokens JWT signés HS256 |
| **Mesures organisationnelles** | Accès restreint par rôle RBAC, journal d'audit insert-only |

### Données collectées — Modèle `User`

| Champ | Type | Sensible | Justification |
|-------|------|----------|---------------|
| `email` | String (unique) | Oui | Identification et communication |
| `passwordHash` | String (nullable) | Oui | Authentification (hash irréversible Argon2id) |
| `role` | Enum (PARENT/TEACHER/MODERATOR/ADMIN) | Non | Contrôle d'accès RBAC |
| `emailVerified` | Boolean | Non | Sécurité du compte |
| `twoFactorEnabled` | Boolean | Non | Configuration sécurité |
| `twoFactorSecret` | String (nullable, chiffré) | Oui | Secret TOTP chiffré AES-256 en application |
| `googleId` | String (nullable) | Oui | Liaison OAuth Google |
| `locale` | String | Non | Préférence linguistique |
| `stripeCustomerId` | String (nullable) | Oui | Liaison paiement Stripe |
| `createdAt` | DateTime | Non | Traçabilité |
| `deletedAt` | DateTime (nullable) | Non | Soft delete RGPD |

---

## Traitement 2 — Gestion des profils enfants

| Champ | Détail |
|-------|--------|
| **Finalité** | Création de profils enfants rattachés au compte parental pour personnaliser l'expérience de visionnage |
| **Base légale** | Consentement parental explicite (art. 6.1.a + art. 8 RGPD) |
| **Catégories de personnes** | Mineurs de 0 à 15 ans (via leurs représentants légaux) |
| **Catégories de données** | Prénom/pseudonyme, année de naissance (uniquement), groupe d'âge, clé avatar S3, hash PIN (Argon2id), planning horaire, limites de temps |
| **Destinataires internes** | API NestJS, service de profils |
| **Sous-traitants** | Cloudflare R2 (stockage avatar) |
| **Transferts hors UE** | Cloudflare Inc. (clauses contractuelles types) |
| **Durée de conservation** | Durée du compte parental, supprimé en cascade |
| **Mesures techniques** | Minimisation (année de naissance uniquement, jamais date complète), PIN hashé Argon2id, pas de tracking comportemental fin |
| **Mesures organisationnelles** | Double opt-in parental, aucun accès direct de l'enfant sans contrôle parental |

### Données collectées — Modèle `ChildProfile`

| Champ | Type | Sensible | Justification |
|-------|------|----------|---------------|
| `displayName` | String | Non | Affichage dans l'interface |
| `birthYear` | Int (nullable) | Oui | Détermination du groupe d'âge (minimisé : année seule) |
| `ageGroup` | Enum | Non | Filtrage de contenu par tranche d'âge |
| `avatarKey` | String (nullable) | Non | Clé S3 de l'image d'avatar |
| `pinHash` | String | Oui | Hash irréversible du PIN de déverrouillage |
| `viewingSchedule` | JSON (nullable) | Non | Créneaux horaires autorisés par jour |
| `dailyLimitMin` | Int (nullable) | Non | Limite quotidienne de visionnage (minutes) |
| `sessionLimitMin` | Int (nullable) | Non | Limite par session de visionnage (minutes) |

> **Principe de minimisation appliqué** : seule l'année de naissance est stockée (jamais le jour ni le mois). Le champ est nullable — il n'est pas obligatoire.

---

## Traitement 3 — Historique de visionnage et progression

| Champ | Détail |
|-------|--------|
| **Finalité** | Suivi du visionnage par profil enfant pour les statistiques parentales et la reprise de lecture |
| **Base légale** | Intérêt légitime du parent à superviser le visionnage de son enfant (art. 6.1.f RGPD) |
| **Catégories de personnes** | Mineurs (via leurs profils) |
| **Catégories de données** | Identifiant vidéo, date de visionnage, durée regardée, progression, favori (oui/non), évaluation (pouce haut/bas) |
| **Durée de conservation** | Supprimable à tout moment par le parent (`DELETE /api/v1/users/me/profiles/:id/history`). Supprimé en cascade avec le profil. |
| **Mesures techniques** | Agrégation pour les statistiques (pas de tracking fin), données internes uniquement (jamais partagées) |

### Modèles concernés

- `WatchHistory` : historique de visionnage (profileId, videoId, watchedAt, durationWatchedSec, completed)
- `VideoProgress` : position de reprise (profileId, videoId, positionSec, completed)
- `VideoFavorite` : favoris (profileId, videoId)
- `VideoRating` : évaluation (profileId, videoId, rating)

---

## Traitement 4 — Consentements RGPD

| Champ | Détail |
|-------|--------|
| **Finalité** | Enregistrement, traçabilité et révocation des consentements |
| **Base légale** | Obligation légale (art. 6.1.c RGPD) — preuve du consentement |
| **Catégories de personnes** | Tous les utilisateurs |
| **Catégories de données** | Type de consentement, version du texte, horodatage, hash SHA-256 de l'IP (non réversible), user-agent, date de révocation |
| **Durée de conservation** | Jamais supprimés (obligation légale de conserver la preuve du consentement et de sa révocation) |
| **Mesures techniques** | IP hashée en SHA-256 (non réversible), versionnement des textes légaux |

### Types de consentement gérés

| Type | Description | Obligatoire |
|------|-------------|-------------|
| `TERMS` | Conditions Générales d'Utilisation | Oui (pour utiliser le service) |
| `PRIVACY` | Politique de confidentialité | Oui |
| `COOKIE_FUNCTIONAL` | Cookies fonctionnels | Oui |
| `COOKIE_ANALYTICS` | Cookies analytiques | Non (opt-in) |
| `PARENTAL_CONSENT` | Consentement parental pour profils enfants | Oui (pour créer un profil enfant) |

---

## Traitement 5 — Modération du contenu et validation IA

| Champ | Détail |
|-------|--------|
| **Finalité** | Vérification automatique et manuelle que les vidéos soumises sont adaptées à un jeune public |
| **Base légale** | Intérêt légitime de protection des mineurs (art. 6.1.f RGPD) + obligation légale (loi française majorité numérique) |
| **Catégories de personnes** | Utilisateurs soumettant des vidéos, modérateurs |
| **Catégories de données** | URL, titre, description, tags, miniature, contexte de playlist, tranche d'âge demandée, score de confiance et rapport d'analyse; les frames/transcriptions sont transmises uniquement si elles sont fournies au worker |
| **Sous-traitants** | OpenAI (analyse du contenu via `AI_MODERATION_MODEL`) |
| **Transferts hors UE** | À confirmer selon la configuration et les conditions contractuelles OpenAI |
| **Durée de conservation** | Durée de vie de la vidéo sur la plateforme |
| **Mesures techniques** | Worker BullMQ isolé, contrôle de schéma et de confiance, approbation interdite si les preuves vidéo/audio sont incomplètes, fallback en revue humaine en cas d'erreur API |

### Pipeline de validation

1. Un Parent/Enseignant soumet une URL vidéo, seule ou au sein d'une playlist
2. Vérification que la source autorise l'embed (`VideoSource.embedAllowed`)
3. Enregistrement de chaque vidéo en `PENDING` puis mise en file BullMQ à priorité élevée
4. Le worker transmet à OpenAI le titre, la description, les tags, le contexte de playlist et la miniature autorisée; frames et transcript sont analysés uniquement s'ils sont disponibles
5. Le résultat JSON est contrôlé (schéma, identifiant vidéo, confiance, timestamps, tranche d'âge)
6. Décision distincte par vidéo : confiance élevée et preuves complètes peuvent approuver; violation grave confirmée peut rejeter; données invalides, preuves incomplètes ou ambiguïté entraînent `NEEDS_REVIEW`
7. L'évaluation de playlist est calculée côté serveur à partir des statuts réels de ses vidéos
8. Toute erreur fournisseur ou analyse média incomplète entraîne une revue humaine, jamais une approbation par défaut

---

## Traitement 6 — Journal d'audit

| Champ | Détail |
|-------|--------|
| **Finalité** | Traçabilité des actions sensibles pour la sécurité et la conformité |
| **Base légale** | Intérêt légitime de sécurité (art. 6.1.f RGPD) + obligation légale |
| **Catégories de personnes** | Tous les utilisateurs effectuant des actions sensibles |
| **Catégories de données** | Identifiant acteur, rôle, action effectuée, type et identifiant de la ressource, métadonnées, IP, user-agent, horodatage |
| **Durée de conservation** | 5 ans (obligation de traçabilité), puis purge automatique |
| **Mesures techniques** | Table **insert-only** — aucun UPDATE ni DELETE autorisé en application, index sur actorId + action + occurredAt |

### Actions auditées

| Action | Description |
|--------|-------------|
| `auth.login` | Connexion réussie |
| `auth.login.failed` | Tentative de connexion échouée |
| `auth.2fa.setup` | Activation de la 2FA |
| `user.role.change` | Modification du rôle d'un utilisateur |
| `user.delete` | Suppression de compte |
| `gdpr.export.request` | Demande d'export de données |
| `gdpr.delete.request` | Demande de suppression |
| `video.submit` | Soumission d'une vidéo |
| `video.submitter_approve` | Relance manuelle facultative de la validation par le soumetteur |
| `video.approve` | Approbation d'une vidéo (modération) |
| `video.reject` | Rejet d'une vidéo (modération) |
| `playlist.create` | Création d'une playlist |
| `playlist.share` | Partage d'une playlist |
| `consent.record` | Enregistrement d'un consentement |
| `consent.revoke` | Révocation d'un consentement |

---

## Traitement 7 — Notifications et communications

| Champ | Détail |
|-------|--------|
| **Finalité** | Envoi de notifications in-app, email et push pour informer les utilisateurs des événements de leur compte |
| **Base légale** | Exécution du contrat (notifications transactionnelles, art. 6.1.b) |
| **Catégories de personnes** | Tous les utilisateurs |
| **Catégories de données** | Type de notification, payload (JSON), statut de lecture, token Expo Push, endpoint Web Push |
| **Sous-traitants** | Resend (email), Expo (push notifications mobiles) |
| **Transferts hors UE** | Resend (US, clauses contractuelles types), Expo (US, clauses contractuelles types) |
| **Durée de conservation** | 90 jours pour les notifications in-app, immédiat pour les emails/push |
| **Mesures techniques** | Tokens push stockés en base (supprimés avec le compte), emails envoyés via API sécurisée |

---

## Traitement 8 — Abonnements et paiements

| Champ | Détail |
|-------|--------|
| **Finalité** | Gestion des abonnements premium et des paiements récurrents |
| **Base légale** | Exécution du contrat (art. 6.1.b RGPD) |
| **Catégories de personnes** | Utilisateurs souscrivant à un plan payant |
| **Catégories de données** | Identifiant client Stripe, identifiant abonnement Stripe, plan souscrit, statut, dates de début/expiration |
| **Sous-traitants** | Stripe (traitement des paiements) |
| **Transferts hors UE** | Stripe Inc. (clauses contractuelles types, certifié PCI DSS) |
| **Durée de conservation** | Durée de l'abonnement + 10 ans (obligations comptables françaises) |
| **Mesures techniques** | Aucune donnée de carte bancaire stockée en base (déléguée à Stripe), webhooks vérifiés par signature |

> **Note** : NourPlay ne stocke jamais de données de carte bancaire. Le paiement est intégralement délégué à Stripe via Stripe Checkout (redirection sécurisée). Seul l'identifiant client Stripe (`stripeCustomerId`) et l'identifiant d'abonnement Stripe (`externalId`) sont conservés en base.

---

## Récapitulatif des sous-traitants

| Sous-traitant | Service | Données concernées | Localisation | Garanties |
|---------------|---------|-------------------|-------------|-----------|
| **Google LLC** | OAuth 2.0 | Identifiant Google, email | US | Clauses contractuelles types (SCC) |
| **OpenAI** | Classification contenu IA | Métadonnées, miniature et preuves média disponibles | Selon la configuration du service | Vérifier le DPA, les garanties de transfert et les paramètres de conservation avant production |
| **Stripe Inc.** | Paiements | Identifiant client, abonnement | US + Ireland | SCC, PCI DSS Level 1, DPA Stripe |
| **Cloudflare Inc.** | Stockage objets (R2), CDN | Avatars, thumbnails | EU (région configurable) | SCC, DPA Cloudflare |
| **Resend** | Email transactionnel | Adresse email destinataire, contenu email | US | SCC, DPA Resend |
| **Expo (React Native)** | Push notifications mobile | Token push, payload notification | US | SCC, pas de données personnelles dans les payloads |

> **DPA (Data Processing Agreement)** : un accord de sous-traitance conforme à l'article 28 du RGPD doit être signé avec chaque sous-traitant avant la mise en production. Les DPA sont généralement disponibles sur les sites des prestataires.

---

## Durées de conservation récapitulatives

| Catégorie de données | Durée | Justification |
|---------------------|-------|---------------|
| Compte utilisateur (actif) | Tant que le compte est actif | Exécution du contrat |
| Compte utilisateur (supprimé) | 3 ans après la demande de suppression | Obligation légale (prescription) |
| Profils enfants | Durée du compte parental | Supprimé en cascade |
| Historique de visionnage | Supprimable à tout moment par le parent | Intérêt légitime parental |
| Consentements (actifs et révoqués) | Conservation permanente | Obligation légale (preuve) |
| Journal d'audit | 5 ans | Obligation de traçabilité |
| Données de paiement (ref. Stripe) | 10 ans après la transaction | Obligations comptables françaises |
| Notifications in-app | 90 jours | Pertinence de l'information |
| Refresh tokens | 7 jours (TTL) | Sécurité |
| Logs d'analyse IA | Durée de vie de la vidéo | Traçabilité de la décision de modération |

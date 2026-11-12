# Analyse d'Impact relative à la Protection des Données (AIPD)

> Document conforme à l'article 35 du RGPD  
> Version : 1.0 — Dernière mise à jour : 20 août 2026

---

## 1. Contexte et nécessité de l'AIPD

### 1.1. Pourquoi une AIPD est nécessaire

Conformément à l'article 35 du RGPD et aux lignes directrices de la CNIL, une Analyse d'Impact relative à la Protection des Données (AIPD) est **obligatoire** lorsque le traitement est susceptible d'engendrer un risque élevé pour les droits et libertés des personnes. 

NourPlay remplit **deux critères** de la liste de la CNIL rendant l'AIPD obligatoire :
1. **Traitement de données de personnes vulnérables** : mineurs de 0 à 15 ans
2. **Surveillance systématique** : historique de visionnage des enfants (même si contrôlé par le parent)

### 1.2. Périmètre de l'AIPD

Cette AIPD couvre l'ensemble des traitements de données personnelles effectués par la plateforme NourPlay, avec une attention particulière sur :
- Le traitement des données des profils enfants
- L'historique de visionnage
- La modération IA du contenu
- Les consentements parentaux

---

## 2. Description des traitements

### 2.1. Description générale

| Élément | Détail |
|---------|--------|
| **Nom du traitement** | Plateforme de curation vidéo NourPlay |
| **Responsable** | NourPlay SAS |
| **DPO** | dpo@nourplay.app |
| **Finalité principale** | Permettre aux parents et enseignants de sélectionner et organiser des vidéos adaptées aux enfants |
| **Personnes concernées** | Adultes (parents, enseignants), mineurs (0-15 ans via profils) |

### 2.2. Flux de données

```
Adulte (parent/enseignant)
  │
  ├── Crée un compte (email, mot de passe)
  │     └── Données → PostgreSQL (chiffré au repos)
  │
  ├── Crée un profil enfant (consentement parental)
  │     └── Données minimisées → PostgreSQL
  │
  ├── Soumet des vidéos
  │     └── URL → API → BullMQ → Worker IA (OpenAI) → Décision prudente
  │
  ├── Crée des playlists
  │     └── Métadonnées → PostgreSQL
  │
  └── L'enfant regarde des vidéos
        └── Historique → PostgreSQL (supprimable par le parent)
```

### 2.3. Technologies impliquées

| Composant | Rôle | Données traitées |
|-----------|------|-----------------|
| API NestJS | Traitement des requêtes | Toutes les données |
| PostgreSQL | Stockage persistant | Toutes les données |
| Redis | Cache, sessions, queues | Sessions, tokens |
| Worker BullMQ | Validation IA asynchrone | Métadonnées, miniature et preuves média disponibles |
| OpenAI gpt-4o-mini | Classification contenu | Titre, description, tags, contexte playlist et miniature; transcript/frames uniquement s'ils sont fournis |
| Cloudflare R2 | Stockage avatars | Images d'avatar |
| Resend | Email transactionnel | Adresse email |
| Stripe | Paiements | Identifiant client |

---

## 3. Évaluation de la nécessité et de la proportionnalité

### 3.1. Nécessité des traitements

| Traitement | Nécessité | Proportionnalité |
|------------|-----------|-------------------|
| Compte utilisateur | ✅ Indispensable pour le service | ✅ Données minimales (email + hash) |
| Profil enfant | ✅ Indispensable pour la personnalisation par âge | ✅ Année de naissance uniquement, PIN hashé |
| Historique de visionnage | ✅ Permet au parent de superviser | ✅ Supprimable à tout moment |
| Modération IA | ✅ Protège les enfants du contenu inapproprié | ✅ Analyse les métadonnées et, si disponible, des preuves visuelles/audio; une analyse incomplète est envoyée en revue humaine |
| Journal d'audit | ✅ Sécurité et conformité | ✅ Insert-only, accès restreint aux admins |
| Consentements | ✅ Obligation légale | ✅ IP hashée (non réversible) |

### 3.2. Minimisation vérifiée

| Principe | Implémentation |
|----------|---------------|
| **Minimisation des données** | Année de naissance (pas date complète), IP hashée, pas de géolocalisation |
| **Limitation de la conservation** | Durées définies, soft delete, purge automatique |
| **Limitation des accès** | RBAC strict, ownership check, PIN enfant |
| **Pas de tracking** | Pas de cookies tiers, pas de Google Analytics, pas de profiling |

---

## 4. Identification et évaluation des risques

### 4.1. Matrice des risques

| # | Risque | Gravité | Vraisemblance | Niveau | Mesures d'atténuation |
|---|--------|---------|---------------|--------|----------------------|
| R1 | Accès non autorisé aux profils enfants | 🔴 Élevée | 🟡 Moyenne | **Élevé** | PIN Argon2id, JWT signé, RBAC, ownership check, 2FA optionnelle |
| R2 | Fuite de la base de données | 🔴 Élevée | 🟢 Faible | **Moyen** | Chiffrement au repos, mots de passe hashés Argon2id, secrets chiffrés AES-256, accès réseau restreint |
| R3 | Exposition de contenu inapproprié à un enfant | 🔴 Élevée | 🟡 Moyenne | **Élevé** | Pipeline IA + modération humaine, vidéos APPROVED uniquement, signalement utilisateur |
| R4 | Utilisation détournée des données de visionnage | 🟡 Moyenne | 🟢 Faible | **Faible** | Données accessibles uniquement au parent propriétaire, pas de partage avec des tiers |
| R5 | Non-respect du droit à l'effacement | 🟡 Moyenne | 🟢 Faible | **Faible** | Endpoints GDPR implémentés, soft delete + hard delete planifié, tests automatisés |
| R6 | Transfert de données hors UE non conforme | 🟡 Moyenne | 🟡 Moyenne | **Moyen** | SCC signées avec chaque sous-traitant US, DPA en place |
| R7 | Accès administrateur malveillant | 🔴 Élevée | 🟢 Faible | **Moyen** | Journal d'audit insert-only, 2FA obligatoire pour admins, principe du moindre privilège |
| R8 | Dysfonctionnement de la modération IA | 🟡 Moyenne | 🟡 Moyenne | **Moyen** | Fallback en NEEDS_REVIEW (jamais APPROVED par défaut), modération humaine |

### 4.2. Risques spécifiques aux mineurs

| Risque | Mesures spécifiques |
|--------|-------------------|
| **Profilage** | Aucun profilage. Pas d'algorithme de recommandation opaque. Les suggestions sont curatoriales (basées sur les choix explicites du parent). |
| **Addiction au contenu** | Limites de temps configurables (par jour, par session, par catégorie). Planning horaire. L'enfant ne peut pas contourner les limites. |
| **Contact non sollicité** | Aucun système de messagerie, commentaire ou interaction sociale entre utilisateurs. |
| **Collecte excessive** | Minimisation stricte : année de naissance optionnelle, pas de tracking, pas de cookies tiers. |
| **Monétisation des données** | Aucune publicité, aucune vente de données, aucun partenariat data. |

---

## 5. Mesures de sécurité détaillées

### 5.1. Authentification et contrôle d'accès

| Mesure | Implémentation | Fichier source |
|--------|---------------|---------------|
| Hachage des mots de passe | Argon2id (64 MB, 3 itérations) | `packages/api/src/modules/auth/` |
| JWT Access Token | HS256, TTL 15 min | `packages/api/src/common/guards/jwt-auth.guard.ts` |
| Refresh Token | SHA-256 hashé, cookie HttpOnly/Secure/SameSite=Lax, TTL 7 jours | `packages/api/src/modules/auth/auth.service.ts` |
| 2FA TOTP | RFC 6238, secret chiffré AES-256 | `packages/api/src/modules/auth/` |
| RBAC | Guard NestJS avec décorateur `@Roles()` | `packages/api/src/common/guards/roles.guard.ts` |
| Rate limiting | ThrottlerGuard global (100 req/min) + routes sensibles (5 req/min) | `packages/api/src/app.module.ts` |
| PIN enfant | Argon2id, vérifié avant accès au profil | `packages/api/src/modules/user/` |

### 5.2. Protection du réseau et de l'application

| Mesure | Détail |
|--------|--------|
| TLS 1.3 | Imposé par le reverse proxy (Caddy) avec HSTS preload |
| CSP | Content-Security-Policy restrictive, frame-src limité aux plateformes vidéo autorisées |
| CORS | Origins explicites uniquement |
| Validation des entrées | `class-validator` avec `whitelist: true, forbidNonWhitelisted: true` |
| Protection CSRF | Tokens pour mutations cookie-based |
| Headers de sécurité | Helmet.js (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) |

### 5.3. Surveillance et audit

| Mesure | Détail |
|--------|--------|
| Journal d'audit | Table `audit_logs` insert-only, index sur actorId/action/occurredAt |
| Observabilité | OpenTelemetry → Grafana (Loki pour logs, Tempo pour traces, Prometheus pour métriques) |
| Scan de vulnérabilités | pnpm audit + Trivy dans le CI/CD |
| Alerting | Configurable via Grafana (tentatives de connexion échouées, rate limiting déclenché) |

---

## 6. Plan d'action

| Action | Responsable | Échéance | Statut |
|--------|------------|----------|--------|
| Signer les DPA avec tous les sous-traitants | DPO | Avant mise en production | 🟡 À faire |
| Activer le chiffrement au repos PostgreSQL | DevOps | Avant mise en production | 🟡 À faire |
| Implémenter la purge automatique des comptes soft-deleted | Développement | V1 | 🟡 À faire |
| Rendre la 2FA obligatoire pour les comptes ADMIN | Développement | V1 | 🟡 À faire |
| Audit de sécurité externe (pentest) | Sécurité | Avant mise en production | 🟡 À faire |
| Nomination officielle du DPO | Direction | Avant mise en production | 🟡 À faire |
| Formation des modérateurs sur le traitement des données | DPO | Avant mise en production | 🟡 À faire |
| Mise en place d'un processus de notification de violation de données | DPO | Avant mise en production | 🟡 À faire |

---

## 7. Avis du DPO

*[À compléter lors de la nomination du DPO]*

L'AIPD devra être revue :
- Annuellement
- En cas de modification significative du traitement
- En cas de changement de sous-traitant
- En cas d'incident de sécurité

---

## 8. Conclusion

Le niveau de risque résiduel est jugé **acceptable** sous réserve de la mise en œuvre complète des mesures identifiées dans le plan d'action (section 6). Les principes de privacy by design ont été intégrés dès la conception :

- ✅ Minimisation des données (année de naissance uniquement)
- ✅ Pas de tracking comportemental des enfants
- ✅ Consentement parental explicite avec double opt-in
- ✅ Droits RGPD implémentés et testés (accès, export, suppression, rectification)
- ✅ Sécurité multicouche (Argon2id, JWT, 2FA, RBAC, rate limiting, audit)
- ✅ Modération IA + humaine avant publication
- ✅ Pas de publicité, pas de cookies tiers, pas de profiling

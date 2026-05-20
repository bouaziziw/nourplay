
---

# Prompt — Plateforme de curation vidéo privée pour parents et enseignants

## Contexte et objectif

Je veux construire une plateforme web, mobile (Android/iOS) et TV de curation vidéo, gratuite et privée, destinée aux parents et aux enseignants. Le but est simple : leur permettre de sélectionner, regrouper et organiser des vidéos éducatives ou de divertissement adaptées aux enfants et aux élèves, sans jamais télécharger ni ré-uploader le contenu.

Les vidéos restent hébergées sur leurs plateformes d'origine (YouTube, Vimeo, Dailymotion, et autres sources qui autorisent l'embed officiel). Notre plateforme ne fait que de la curation, de l'organisation et de la diffusion via les lecteurs embarqués officiels.

Public visé : familles et établissements scolaires en France et en Europe en priorité, puis international (multilingue dès le départ : fr, en, ar, es).

## Cadre légal et conformité

C'est un point critique : la plateforme doit être conforme RGPD, conforme aux recommandations de la CNIL, et respecter les obligations renforcées qui s'appliquent dès qu'on traite des données de mineurs.

À traiter explicitement :
- Vérification automatique que chaque vidéo ajoutée provient d'une source dont les conditions d'utilisation autorisent l'embed sur des sites tiers (lecture des CGU, vérification des paramètres d'embed de la plateforme source, etc.).
- Validation IA en amont de la publication : un pipeline d'analyse qui vérifie le contenu de la vidéo (titre, description, métadonnées, transcript si disponible, signaux visuels) avant qu'un utilisateur ne puisse la publier dans ses playlists partagées. Si la vidéo est douteuse ou non conforme à la cible jeune public, elle est bloquée ou mise en file de modération humaine.
- Consentement parental, double opt-in pour les comptes enfants, mention claire des durées de conservation, droit d'accès et droit à l'effacement.
- Mentions légales, CGU, politique de confidentialité, registre des traitements, DPA pour les sous-traitants.
- Conformité aux obligations spécifiques de protection des mineurs en ligne (notamment loi française sur la majorité numérique, recommandations CNIL sur les services destinés aux jeunes).

Je veux que la conformité soit pensée dès la conception (privacy by design), pas ajoutée à la fin.

## Fonctionnalités attendues

### Côté utilisateur (parent / enseignant)
- Authentification sécurisée (email + mot de passe avec règles fortes, 2FA optionnel, magic link, OAuth si pertinent).
- Espace privé avec gestion de plusieurs profils enfants par compte.
- Création de playlists, catégories, sous-catégories, tags personnalisés.
- Recherche avancée avec filtres par âge, thème, langue, durée, source.
- Favoris, historique de lecture par profil enfant.
- Recommandations contrôlées par l'adulte (pas d'algorithme opaque qui pousse du contenu).
- Listes blanches et listes noires de chaînes ou de mots-clés.
- Planification horaire (créneaux autorisés de visionnage par jour de la semaine).
- Limites de temps par jour, par session, par catégorie.
- Verrouillage par PIN pour accéder aux paramètres et changer de profil.
- Partage restreint de playlists entre utilisateurs autorisés (un enseignant qui partage avec ses élèves, un parent qui partage avec l'autre parent, etc.).

### Côté enfant / élève
- Interface adaptée à son âge, sans publicité, sans recommandations externes, sans commentaires.
- Navigation uniquement dans le périmètre validé par l'adulte.
- Lecteur embarqué qui respecte les conditions de chaque plateforme source.

### Back-office admin
- Gestion des utilisateurs, rôles et permissions granulaires.
- Modération du contenu signalé, gestion des signalements utilisateurs.
- Configuration des règles légales (textes affichés, versions des CGU, gestion du consentement).
- Logs d'audit complets (qui a fait quoi, quand).
- Paramètres de sécurité (politiques de mot de passe, durées de session, IP banning).
- Gestion des notifications (templates email, push, in-app).
- Métriques d'usage anonymisées et agrégées (pas de tracking comportemental fin des enfants).
- Tableau de bord conformité (consentements en cours, demandes RGPD reçues, etc.).
- Gestion des abonnements (même si la plateforme est gratuite, prévoir le socle technique pour des offres premium futures).

## Stack technique souhaitée

- **Web** : Next.js (App Router), TypeScript, Tailwind ou solution équivalente.
- **Mobile et TV** : React Native avec une base de code partagée, support TV (Android TV, Apple TV, Fire TV) via React Native TV ou équivalent.
- **Backend** : NestJS en TypeScript, ou FastAPI en Python si l'équipe préfère. Choisis et justifie.
- **Base de données** : PostgreSQL pour le relationnel, Redis pour le cache et les sessions.
- **File de jobs** : BullMQ (si Node) ou équivalent pour la validation IA, l'envoi d'emails, les tâches asynchrones.
- **Stockage objet** : S3 ou compatible (uniquement pour images d'avatars, thumbnails customs, exports — jamais pour les vidéos).
- **CDN** pour les assets statiques.
- **Observabilité** : logs structurés, traces, métriques. Suggère une stack (par exemple OpenTelemetry + Grafana + Loki + Tempo).
- **CI/CD** : GitHub Actions ou équivalent, déploiements automatisés sur environnements dev / staging / prod.
- **Tests** : unitaires, intégration, E2E (Playwright pour le web, Detox pour mobile).
- **Sécurité** : rate limiting, protection CSRF, headers de sécurité, secrets management, audits de dépendances automatisés, chiffrement au repos et en transit.

## Ce que je veux que tu produises

1. **Une architecture logicielle complète** : schéma des composants, communication entre services, choix d'hébergement, stratégie de scaling horizontal.
2. **Le découpage en modules** côté backend et côté front, avec les responsabilités de chaque module.
3. **Les entités principales** du modèle de données (User, Profile, Playlist, Video, Source, ConsentRecord, AuditLog, etc.) avec leurs champs clés et leurs relations.
4. **La liste des API** nécessaires (REST ou GraphQL — propose et justifie), groupées par domaine fonctionnel.
5. **Les règles de sécurité** : authentification, autorisation (RBAC ou ABAC), gestion des sessions, protection des comptes enfants.
6. **Les points de conformité RGPD/CNIL** intégrés dans l'architecture (où sont stockées les données, comment elles sont chiffrées, comment elles sont supprimées sur demande).
7. **Une roadmap en trois temps** : MVP (les fonctions vitales pour valider le concept), V1 (la version publique complète), Scale (les optimisations pour supporter des millions d'utilisateurs).
8. **Un manuel d'installation** détaillé pour deux environnements : local (Docker Compose, variables d'environnement, étapes pas à pas) et production (infrastructure as code, configuration des secrets, mise en place du CI/CD).
9. **Une documentation par étape** : pour chaque grande phase de développement, un document décrivant ce qui a été fait, les choix techniques pris, les tests effectués.
10. **Une stratégie de commits Git** : un commit clair, daté, et bien décrit à la fin de chaque étape validée, avec un message qui suit la convention Conventional Commits.

## Contraintes de qualité

- Code lisible, typé, testé.
- Architecture modulaire avec une vraie séparation des responsabilités.
- Accessibilité (WCAG AA minimum).
- Performance : First Contentful Paint sous 2 secondes en 4G, lecture vidéo qui démarre vite.
- Internationalisation propre dès le premier commit (pas ajoutée après coup).
- Sécurité auditable : pas de secrets en dur, pas de dépendances vulnérables, headers HTTP corrects.

## Format de réponse attendu

Structure ta réponse en sections claires :
1. Vue d'ensemble de l'architecture (avec un schéma ASCII ou Mermaid).
2. Stack technique retenue et justifications.
3. Modèle de données.
4. Liste des API.
5. Approche sécurité et conformité.
6. Roadmap MVP → V1 → Scale.
7. Manuel d'installation local et production.
8. Stratégie de tests et de CI/CD.
9. Stratégie de commits et de documentation.
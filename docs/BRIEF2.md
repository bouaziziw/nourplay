# Rôle

Tu es un architecte logiciel senior, spécialisé en produits web/mobiles destinés aux familles et à l’éducation, ainsi qu’en conformité RGPD et protection des mineurs.

# Mission

Conçois une solution logicielle complète pour une plateforme privée, gratuite et multilingue de curation vidéo destinée aux parents et enseignants.

La plateforme doit permettre de sélectionner, organiser, partager et diffuser des vidéos éducatives ou de divertissement adaptées aux enfants et aux élèves.

Important : la plateforme ne doit jamais télécharger, héberger, transcoder ni ré-uploader de vidéos. Elle doit uniquement référencer et intégrer des contenus provenant de sources autorisant officiellement l’embed, via leurs lecteurs officiels.

# Contexte produit

- Public prioritaire : familles et établissements scolaires en France et en Europe.
- Marché secondaire : international.
- Langues à supporter dès la conception : français, anglais, arabe et espagnol.
- Plateformes cibles : web, mobile Android/iOS et TV (Android TV, Apple TV, Fire TV).
- Sources vidéo envisagées : YouTube, Vimeo, Dailymotion et toute autre source dont les conditions permettent l’intégration officielle.
- La plateforme doit être sans publicité pour les enfants et sans recommandations algorithmiques non contrôlées par un adulte.

# Exigences de conformité

La conformité doit être intégrée dès la conception (« privacy by design »), et non ajoutée après coup.

Traite explicitement les sujets suivants :

1. Conformité RGPD, recommandations CNIL et obligations spécifiques liées aux données des mineurs.
2. Vérification qu’une vidéo peut légalement être intégrée depuis une source tierce :
   - analyse des conditions d’utilisation de la source ;
   - vérification des paramètres d’embed disponibles ;
   - blocage des sources ou vidéos non autorisées.
3. Pipeline de validation avant publication :
   - analyse du titre, de la description, des métadonnées et, si disponible, du transcript ;
   - analyse des signaux visuels lorsque techniquement possible ;
   - mise en quarantaine ou modération humaine en cas de doute.
4. Consentement parental et double opt-in pour la création ou l’utilisation d’un compte enfant.
5. Information claire sur :
   - les finalités de traitement ;
   - les durées de conservation ;
   - les droits d’accès, de rectification, d’effacement, de portabilité et d’opposition ;
   - les sous-traitants et transferts de données.
6. Documentation juridique et technique :
   - mentions légales ;
   - CGU ;
   - politique de confidentialité ;
   - registre des traitements ;
   - DPA avec les sous-traitants.
7. Conformité aux obligations françaises et européennes applicables à la protection des mineurs en ligne, notamment la loi française sur la majorité numérique et les recommandations CNIL.

# Fonctionnalités attendues

## Espace parent / enseignant

- Authentification sécurisée : e-mail + mot de passe robuste, 2FA optionnelle, magic link et OAuth lorsque pertinent.
- Gestion de plusieurs profils enfants par compte adulte.
- Création de playlists, catégories, sous-catégories et tags personnalisés.
- Recherche avancée avec filtres : âge, thème, langue, durée, source, niveau scolaire si pertinent.
- Favoris et historique de lecture par profil enfant.
- Recommandations uniquement contrôlées et validées par l’adulte.
- Listes blanches et listes noires de chaînes, créateurs, mots-clés ou contenus.
- Planification des créneaux de visionnage par jour de semaine.
- Limites de temps par jour, par session et par catégorie.
- Verrouillage par code PIN pour l’accès aux paramètres et au changement de profil.
- Partage restreint de playlists entre utilisateurs autorisés :
  - enseignant vers élèves ;
  - parent vers autre parent ;
  - partage contrôlé par invitation ou lien sécurisé.

## Espace enfant / élève

- Interface adaptée à l’âge de l’enfant.
- Navigation strictement limitée au périmètre validé par l’adulte.
- Aucune publicité.
- Aucune recommandation externe.
- Aucun commentaire.
- Lecture via les lecteurs embarqués officiels des plateformes sources.
- Respect des règles de lecture définies par le parent ou l’enseignant.

## Back-office administrateur

- Gestion des utilisateurs, rôles et permissions granulaires.
- Modération des contenus signalés.
- Gestion des signalements utilisateurs.
- Gestion des textes légaux, versions de CGU et consentements.
- Journal d’audit complet : acteur, action, ressource, horodatage, adresse IP si nécessaire et résultat.
- Paramètres de sécurité :
  - politique de mots de passe ;
  - durée des sessions ;
  - blocage d’IP ;
  - protection contre les attaques par force brute.
- Gestion des notifications : e-mail, push et in-app.
- Métriques d’usage anonymisées et agrégées.
- Interdiction du tracking comportemental fin des enfants.
- Tableau de bord de conformité :
  - consentements actifs ;
  - demandes RGPD reçues ;
  - contenus en modération ;
  - incidents de sécurité.
- Socle technique prévu pour de futures offres premium, même si le produit est initialement gratuit.

# Stack technique souhaitée

- Web : Next.js avec App Router, React 19, TypeScript, Tailwind CSS ou solution équivalente.
- Mobile et TV : React Native avec partage maximal de code ; évaluer React Native TV ou une alternative pour Android TV, Apple TV et Fire TV.
- Backend : NestJS en TypeScript ou FastAPI en Python. Choisis l’une des deux options, justifie ta décision et explique les compromis.
- Base de données : PostgreSQL.
- Cache et sessions : Redis.
- Files de tâches asynchrones : BullMQ si Node.js est retenu, ou équivalent si Python est retenu.
- Stockage objet : S3 ou compatible, uniquement pour avatars, miniatures personnalisées et exports. Jamais pour les vidéos.
- CDN pour les assets statiques.
- Observabilité : logs structurés, traces distribuées, métriques ; propose une stack concrète, par exemple OpenTelemetry, Grafana, Loki et Tempo.
- CI/CD : GitHub Actions ou équivalent, avec déploiements automatisés vers les environnements development, staging et production.
- Tests :
  - tests unitaires ;
  - tests d’intégration ;
  - tests E2E avec Playwright pour le web ;
  - tests mobiles avec Detox ou équivalent.
- Sécurité :
  - rate limiting ;
  - protection CSRF ;
  - en-têtes HTTP de sécurité ;
  - gestion centralisée des secrets ;
  - audit automatisé des dépendances ;
  - chiffrement en transit et au repos.

# Livrables attendus

Produis une réponse structurée avec les sections suivantes :

1. Vue d’ensemble de l’architecture, avec un diagramme Mermaid.
2. Stack technique retenue et justification détaillée des choix.
3. Découpage en modules backend et frontend, avec responsabilités de chaque module.
4. Modèle de données : entités principales, champs clés, relations, contraintes et index importants.
   - Inclure notamment : User, AdultAccount, ChildProfile, Playlist, PlaylistItem, Video, VideoSource, Category, Tag, ConsentRecord, ModerationCase, AuditLog, SharingPermission, ViewingRule.
5. Liste des API nécessaires, groupées par domaine fonctionnel.
   - Choisis REST ou GraphQL, justifie ton choix et précise les méthodes, routes, payloads et codes d’erreur essentiels.
6. Règles de sécurité :
   - authentification ;
   - autorisation RBAC ou ABAC ;
   - gestion des sessions ;
   - protection des comptes enfants ;
   - prévention des abus.
7. Conformité RGPD/CNIL intégrée à l’architecture :
   - localisation des données ;
   - chiffrement ;
   - durée de conservation ;
   - suppression et portabilité ;
   - journalisation ;
   - gestion des consentements.
8. Roadmap en trois phases :
   - MVP : fonctionnalités vitales pour valider le concept ;
   - V1 : version publique complète ;
   - Scale : optimisations pour supporter plusieurs millions d’utilisateurs.
9. Manuel d’installation détaillé pour :
   - environnement local avec Docker Compose, variables d’environnement et étapes pas à pas ;
   - environnement de production avec infrastructure as code, gestion des secrets et CI/CD.
10. Documentation par phase de développement :
   - travail réalisé ;
   - choix techniques ;
   - tests effectués ;
   - points ouverts.
11. Stratégie Git :
   - commits clairs, datés et décrits à la fin de chaque étape validée ;
   - messages conformes à Conventional Commits.

# Contraintes de qualité

- Code lisible, typé, testé et maintenable.
- Architecture modulaire avec séparation claire des responsabilités.
- Accessibilité conforme au minimum WCAG 2.1 AA.
- Performance : First Contentful Paint inférieur à 2 secondes en 4G.
- Démarrage rapide de la lecture vidéo.
- Internationalisation native dès le premier commit.
- Aucun secret en dur dans le code.
- Aucune dépendance vulnérable connue.
- En-têtes HTTP de sécurité corrects.
- Ne pas inventer de fonctionnalités non demandées sans les signaler comme recommandation optionnelle.

# Format de réponse

- Utilise Markdown avec des titres clairs.
- Utilise Mermaid pour les diagrammes.
- Utilise des tableaux pour les entités, API, rôles et décisions techniques.
- Indique clairement les hypothèses à valider.
- Termine par une liste de questions ou décisions à confirmer avant le développement.
# NourPlay

NourPlay aide les parents et les enseignants à sélectionner et organiser des
vidéos pour les enfants. Les vidéos restent hébergées sur leurs plateformes
d'origine et sont lues via des lecteurs intégrés.

Le monorepo comprend une interface web, un back-office, une application
mobile, une API et un worker de validation. Les interfaces web sont disponibles
en français, anglais, arabe et espagnol.

## Structure du projet

| Dossier | Rôle | Technologies |
|---|---|---|
| [`apps/web`](./apps/web) | Interface web | Next.js |
| [`apps/admin`](./apps/admin) | Back-office | Next.js |
| [`apps/mobile`](./apps/mobile) | Application mobile | Expo, React Native |
| [`packages/api`](./packages/api) | API REST et WebSocket | NestJS |
| [`packages/db`](./packages/db) | Schéma et migrations | Prisma, PostgreSQL |
| [`packages/i18n`](./packages/i18n), [`packages/ui`](./packages/ui) | Code partagé | TypeScript, React |
| [`workers/video-validator`](./workers/video-validator) | Traitement des vidéos | BullMQ, Redis |
| [`docs`](./docs) | Guides, architecture et conformité | Markdown |

Le dépôt utilise pnpm et Turborepo.

## Prérequis

- Node.js 20 ou plus et pnpm 9.15.0.
- Docker et Docker Compose pour PostgreSQL et Redis en local.
- Git.

Sous Windows, si `corepack enable` échoue avec `EPERM`, installez les
exécutables Corepack dans votre profil utilisateur :

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\corepack" | Out-Null
corepack enable --install-directory "$env:LOCALAPPDATA\corepack"
$env:Path = "$env:LOCALAPPDATA\corepack;$env:Path"
pnpm --version
```

La modification de `Path` ne s'applique qu'au terminal courant.

## Démarrage local

Depuis la racine du dépôt :

1. Installez les dépendances :

   ```powershell
   pnpm install --frozen-lockfile
   ```

2. Créez `.env` à partir de [`.env.example`](./.env.example), sans écraser un
   fichier existant :

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

   Les URL PostgreSQL et Redis de l'exemple correspondent au Compose local.
   Pour éviter un appel au service d'email externe, définissez
   `EMAIL_PROVIDER=console` dans `.env` : ce mode journalise les envois, mais
   n'envoie pas de message. Configurez les autres intégrations selon vos besoins.

3. Démarrez PostgreSQL et Redis, puis vérifiez leur état :

   ```powershell
   docker compose up -d postgres redis
   docker compose ps
   ```

4. Appliquez les migrations locales et construisez le package de base de
   données :

   ```powershell
   pnpm db:migrate
   pnpm --filter @nourplay/db build
   ```

   Facultativement, `pnpm db:seed` crée des données et comptes de test.
   **Ne l'exécutez jamais en production.**

5. Démarrez le web, l'admin, l'API et le worker :

   ```powershell
   pnpm dev
   ```

| Service | Adresse locale |
|---|---|
| Web | [http://localhost:3000](http://localhost:3000) |
| Administration | [http://localhost:3001](http://localhost:3001) |
| API | [http://localhost:4000/api/v1](http://localhost:4000/api/v1) |
| Documentation Swagger | [http://localhost:4000/api/docs](http://localhost:4000/api/docs) |

Pour démarrer un composant séparément :

```powershell
pnpm --filter @nourplay/api dev
pnpm --filter @nourplay/web dev
pnpm --filter @nourplay/admin dev
pnpm --filter @nourplay/video-validator dev
pnpm --filter @nourplay/mobile start
```

L'application mobile se lance séparément avec Expo ; sur un téléphone physique,
configurez une adresse API accessible depuis le téléphone si nécessaire.

## Configuration et limites

- Les variables locales sont décrites dans [`.env.example`](./.env.example).
  Ne committez jamais `.env` ni de secrets.
- Les intégrations email, stockage, paiement et vidéo nécessitent leurs
  propres identifiants. Le mode email `console` n'envoie pas de messages.
- Le worker nécessite PostgreSQL et Redis. Sans analyse média suffisante, les
  vidéos passent en revue humaine (`NEEDS_REVIEW`) ; les seules métadonnées et
  miniature ne permettent pas une approbation automatique fiable.
- La watch-party nécessite encore une adaptation et des tests avant son
  utilisation sur Vercel : voir le [guide de déploiement](./docs/GUIDE_DEPLOIEMENT_PAS_A_PAS.md#9-adapter-la-watch-party-à-vercel--développement-nécessaire).

## Commandes utiles

```powershell
pnpm build                               # Construire les packages
pnpm lint                                # Linter le monorepo
pnpm typecheck                           # Vérifier les types
pnpm test                                # Tests des packages
pnpm --filter @nourplay/api test         # Tests unitaires API
pnpm --filter @nourplay/web test         # Tests de routage web
pnpm --filter @nourplay/api test:e2e     # Tests API d'intégration
pnpm --filter @nourplay/web test:e2e     # Tests web Playwright
pnpm db:studio                           # Ouvrir Prisma Studio
docker compose down                      # Arrêter l'infrastructure locale
```

Les tests d'intégration API nécessitent PostgreSQL et Redis. Les tests web
nécessitent Playwright et, selon les scénarios, une API et des données de test.
Consultez la [configuration Playwright](./apps/web/playwright.config.ts) et les
[tests web](./apps/web/e2e).


---

##  Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Web (3000)  │  │ Admin (3001) │  │  Mobile (iOS / Android)  │  │
│  │  Next.js 14  │  │  Next.js 14  │  │    Expo / React Native   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
└─────────┼─────────────────┼───────────────────────┼────────────────┘
          │                 │                        │
          └─────────────────┴────────────────────────┘
                            │ HTTP / REST
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API (NestJS :4000)                            │
│                                                                     │
│  ┌────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Auth  │ │ User │ │ Playlist │ │  Video   │ │  Moderation  │   │
│  └────────┘ └──────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌─────────┐ ┌──────┐ ┌──────────────┐ ┌───────────┐              │
│  │ Consent │ │ GDPR │ │ Notification │ │   Admin   │              │
│  └─────────┘ └──────┘ └──────────────┘ └───────────┘              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           BullMQ Jobs (Redis)                               │   │
│  │  video-validation  •  email-send  •  gdpr-export            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────────────────┘
             │
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
┌────────────┐  ┌─────────────┐
│ PostgreSQL  │  │    Redis    │
│    :5432    │  │    :6379    │
└────────────┘  └─────────────┘
                               
┌──────────────────────────────┐
│      Services externes       │
│  YouTube API  •  Vimeo API   │
│  OpenAI (modération vidéo)     │
│  Resend (email)              │
│  S3 / Cloudflare R2          │
└──────────────────────────────┘
```

## Contribution

Créez une branche depuis `dev`, effectuez les vérifications pertinentes puis
ouvrez une pull request vers `dev`. Utilisez des messages de commit
[Conventional Commits](https://www.conventionalcommits.org/).

## Licence

Projet à usage privé. Toute reproduction ou distribution est interdite sans
accord explicite des auteurs.

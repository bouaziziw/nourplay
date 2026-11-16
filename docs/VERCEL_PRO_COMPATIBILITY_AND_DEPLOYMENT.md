# NourPlay — Audit Vercel Pro et guide de déploiement

> État vérifié le 16 novembre 2026. Les paramètres du compte Vercel et les comportements des fonctionnalités bêta peuvent évoluer. Consulter les documentations officielles liées en fin de guide avant une modification de production.

## 1. Résumé exécutif

NourPlay est un monorepo pnpm/Turborepo comprenant deux applications Next.js, une API NestJS, PostgreSQL/Prisma, Redis/BullMQ, un worker vidéo et une fonctionnalité de watch-party temps réel.

**Recommandation : architecture hybride.**

- **Vercel Pro** : `apps/web`, `apps/admin`, et éventuellement l’API REST NestJS ainsi que ses tâches planifiées.
- **Neon PostgreSQL et Upstash Redis** : bases managées accessibles depuis Vercel et depuis les services persistants.
- **Worker vidéo** : désactivé selon le périmètre approuvé. Ne pas le déployer sans nouvelle autorisation.
- **Railway, Render ou Vercel Daemons** : options à évaluer seulement si une activation future du worker est autorisée ; Daemons est en bêta.

Vercel convient aux frontends et aux requêtes HTTP de l’API : la production observée a répondu correctement aux sondes HTTP. En revanche, la watch-party actuelle garde les participants et les salons en mémoire locale ; cette conception n’est pas distribuée. Elle ne devient pas fiable simplement parce que Vercel Pro accepte les WebSockets. Il faut externaliser l’état et le fan-out, ou héberger cette partie sur un serveur persistant.

## 2. État de production vérifié

Les contrôles suivants ont été effectués sur `nour-play.app` :

| Vérification | Résultat observé |
|---|---|
| Page web `/` | HTTP 200 |
| API `/api/v1/health` | HTTP 200 ; PostgreSQL et Redis indiqués `ok` |
| API `/api/v1/subscriptions/plans` | HTTP 200 |
| Admin `/admin/login` | HTTP 200 |
| `www.nour-play.app` | HTTP 308 vers le domaine apex |
| Cron `/api/v1/cron/weekly-digest` sans secret | HTTP 401, attendu |
| `/api/docs` en production | HTTP 404, attendu |
| En-têtes HTTP | HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| Origine CORS non autorisée | Aucun `Access-Control-Allow-Origin` |

Les trois projets Vercel `nourplay`, `nourplay-admin` et `nourplay-api` existent. L’API fonctionne en HTTP avec Neon et Upstash. Le déploiement API `dpl_9vi1TJfAsx9fBikC6JpzrQuuUdEh` a activé uniquement la publication des playlists chaque minute : Vercel indique la tâche activée et une invocation planifiée a répondu HTTP 200. Les trois autres tâches ne sont pas déclarées.

> Les valeurs secrètes ne doivent jamais être copiées dans ce document, le dépôt, les journaux ou un ticket. Configurer les secrets uniquement dans les variables Vercel et le gestionnaire de mots de passe.

## 3. Audit de compatibilité

| Composant | Compatibilité | Détails et actions |
|---|---|---|
| `apps/web` — Next.js 14 | **Native** | Hébergement Vercel adapté. Le projet utilise `output: 'standalone'`, PWA, next-intl et des rewrites. Vérifier les stratégies de cache du Service Worker avant de mettre en cache des réponses API privées. |
| `apps/admin` — Next.js 14 | **Native** | Hébergement Vercel adapté. `ADMIN_BASE_PATH=/admin` doit être défini avant le build, car `basePath` est compilé dans l’application. |
| `packages/api` — NestJS REST | **Compatible avec limites serverless** | La build et les endpoints HTTP ont fonctionné. Initialisation au démarrage à froid, durée maximale des fonctions, taille du bundle, connexions BD et absence d’état local durable restent à prendre en compte. |
| Prisma + Neon PostgreSQL | **Compatible** | Garder `DATABASE_URL` poolée pour les fonctions ; utiliser `DATABASE_URL_UNPOOLED` uniquement pour les migrations. Générer le client Prisma au build. Appliquer les migrations dans une étape de release séparée, jamais à chaque démarrage de fonction. |
| Upstash Redis | **Compatible** | Utiliser TLS (`rediss://`) et vérifier les limites de connexion et de débit. La queue BullMQ peut être créée par l’API pour publier des jobs. |
| BullMQ `video-validator` | **Pas comme processus de fonction HTTP** | Un consommateur qui tourne en continu n’est pas une fonction à la demande. Utiliser un worker Railway/Render ou étudier Vercel Daemons (bêta) avec quotas et budget surveillés. |
| `@nestjs/schedule` | **Désactivé dans l’API Vercel** | `app.module.ts` saute `ScheduleModule.forRoot()` si `VERCEL` est présent. Les méthodes `@Cron` ne tournent donc pas dans la fonction. Il faut les déclencher par des routes cron protégées. |
| WebSockets / Socket.IO | **Possible, bêta, adaptation requise** | Vercel Functions prend en charge les WebSockets, mais la durée de connexion est bornée et Socket.IO doit utiliser `transports: ['websocket']`. Les salons actuels sont stockés dans `Map` en mémoire locale ; les instances ne partagent pas ces données. Déplacer présence, salons et coordination vers Redis/DB ou conserver la passerelle sur un serveur persistant. |
| Cron Vercel | **Compatible Pro** | Pro accepte une fréquence minimale d’une minute (avec fenêtre de jitter d’une minute). Chaque exécution consomme les ressources et les invocations d’une fonction. Confirmer les effets métier, le coût et l’idempotence avant d’activer des routes d’envoi d’emails ou de publication. |
| Stockage local / processus permanents | **À ne pas utiliser dans Functions** | Les instances peuvent être recyclées et ne partagent pas de disque persistant. Stocker les médias sur R2/S3, l’état dans PostgreSQL/Redis. |
| OAuth, e-mail, paiements et R2 | **Compatibles sous réserve de configuration** | Configurer les secrets de production, callbacks OAuth, domaines validés, webhooks Stripe et CORS. Une build réussie ne valide pas ces intégrations externes. |

### Points de blocage principaux

1. **État temps réel local** : `WatchPartyGateway` maintient `rooms` et `socketMeta` dans des `Map`. Une reconnexion, une autre instance ou un redéploiement perd cet état. Ajouter un adaptateur Redis ne suffit pas à lui seul : il faut également déplacer l’état des salons hors mémoire.
2. **Worker continu** : le worker attend des jobs BullMQ sans fin. Il doit être lancé comme worker persistant, jamais comme une route HTTP ou une tâche cron de courte durée.
3. **Cron NestJS non actif sur Vercel** : les décorateurs `@Cron` ne s’exécutent pas dans l’environnement Vercel ; des appels planifiés distincts sont nécessaires.
4. **Opérations externes incomplètes** : sans `RESEND_API_KEY`, clés R2/S3, clés Stripe et configuration OAuth correspondantes, les parties concernées ne sont pas opérationnelles même si `/health` retourne 200.
5. **Compatibilité du runtime à homogénéiser** : les images Docker du backend/worker utilisent Node 20 alors que les projets Vercel et les dépendances ont évolué. Standardiser sur une version Node LTS supportée et testée (recommandation : Node 22), puis aligner le runtime Vercel, `engines`, Dockerfiles et CI.

## 4. Architecture recommandée

### Option A — Recommandée pour une production fiable

```text
nour-play.app
  └─ Vercel: apps/web (Next.js, CDN, PWA)
       ├─ /admin/* → Vercel: apps/admin
       └─ /api/*   → API NestJS persistante (Railway ou Render)
                         ├─ Neon PostgreSQL
                         ├─ Upstash Redis
                         ├─ consommateur BullMQ video-validator
                         └─ WebSocket Socket.IO + état partagé Redis/DB

Vercel Cron ou scheduler externe
  └─ appelle les routes cron protégées de l'API
```

Cette architecture réduit le risque pour la watch-party et BullMQ. Pour une première étape, on peut conserver l’API REST sur Vercel et externaliser uniquement le worker ; la passerelle watch-party doit toutefois être testée comme une fonctionnalité à part entière. Si la watch-party est essentielle au lancement, déployer la passerelle et l’état partagé sur un service persistant avant d’annoncer la fonctionnalité.

### Option B — Tout Vercel (avec expérimentation contrôlée)

- Web, admin et API REST sur les trois projets Vercel actuels.
- Cron dans le projet de l’API.
- Worker dans **Vercel Daemons**, si la bêta est disponible pour l’équipe et que ses quotas sont suffisants.
- Watch-party sur WebSockets Vercel uniquement après migration de l’état vers Redis/DB, reconnexion automatique et test multi-instance.

Daemons est adapté aux consommateurs de queue, mais la bêta ne propose pas l’autoscaling, les déploiements Preview, le stockage local persistant ni l’accès HTTP/TCP entrant. Pro dispose d’un quota d’équipe global (16 vCPU et 32 GiB mémoire simultanés dans les limites publiées lors de cet audit) ; surveiller l’usage et les coûts. Railway/Render reste le choix le plus prévisible pour un processus continu classique.

### Recommandation finale

**Vercel Pro est un très bon choix pour les deux frontends et un bon choix pour l’API REST/cron. Il n’est pas nécessaire d’y imposer tous les workloads.** Conserver Vercel pour le web/admin et les routes REST ; pour une watch-party fiable, envisager une passerelle persistante avec état partagé. Le worker BullMQ reste désactivé ; ne choisir un hébergement pour lui qu'après une nouvelle autorisation.

## 5. Configuration Vercel exacte

Les trois projets sont indépendants et doivent pointer vers le même dépôt monorepo. Pour chaque projet, activer **Include source files outside of the Root Directory** : les commandes install/build du workspace utilisent la racine pnpm.

### Projet `nourplay` — Web

| Réglage | Valeur |
|---|---|
| Root Directory | `apps/web` |
| Framework | Next.js |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command | `cd ../.. && pnpm --filter @nourplay/web build` |
| Production Branch | `main` |
| Domain | `nour-play.app` (apex), `www` redirigé vers l’apex |

Variables Production :

```text
NEXT_PUBLIC_API_URL=https://nour-play.app/api/v1
NEXT_PUBLIC_APP_URL=https://nour-play.app
NEXT_PUBLIC_S3_PUBLIC_URL=https://assets.nourplay.app
API_PROXY_ORIGIN=https://nourplay-api.vercel.app
ADMIN_PROXY_ORIGIN=https://nourplay-admin.vercel.app
```

Si l’API est déplacée vers Railway/Render, modifier `API_PROXY_ORIGIN` vers l’origine API HTTPS stable, et mettre à jour `NEXT_PUBLIC_API_URL`. Ne pas définir l’origine proxy sur `nour-play.app` : cela créerait une boucle de rewrite.

### Projet `nourplay-admin` — Admin

| Réglage | Valeur |
|---|---|
| Root Directory | `apps/admin` |
| Framework | Next.js |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command | `cd ../.. && pnpm --filter @nourplay/admin build` |
| Production Branch | `main` |

Variables Production :

```text
NEXT_PUBLIC_API_URL=https://nour-play.app/api/v1
ADMIN_BASE_PATH=/admin
```

### Projet `nourplay-api` — API REST Vercel (si cette option est retenue)

| Réglage | Valeur |
|---|---|
| Root Directory | `packages/api` |
| Framework | NestJS |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command | `cd ../.. && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db build && pnpm --filter @nourplay/api build` |
| Région | Frankfurt (`fra1`) |
| Production Branch | `main` |

Variables minimum API :

```text
DATABASE_URL                 # URL Neon poolée (runtime)
DATABASE_URL_UNPOOLED        # URL Neon directe (migrations seulement)
REDIS_URL                    # URL Upstash TLS
JWT_ACCESS_SECRET            # secret aléatoire
JWT_REFRESH_SECRET           # secret aléatoire distinct
COOKIE_SECRET                # secret aléatoire distinct
CRON_SECRET                  # secret aléatoire, identique au secret du scheduler
APP_URL=https://nour-play.app
API_URL=https://nour-play.app
ADMIN_URL=https://nour-play.app/admin
CORS_ORIGINS=https://nour-play.app,https://www.nour-play.app
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
BCRYPT_ROUNDS=12
VAPID_PUBLIC_KEY             # si Web Push est utilisé
VAPID_PRIVATE_KEY            # secret
VAPID_SUBJECT=mailto:security@nour-play.app
```

Ajouter seulement quand le service correspondant est prêt :

```text
EMAIL_PROVIDER=resend
RESEND_API_KEY
EMAIL_FROM
S3_ENDPOINT
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_BUCKET
S3_PUBLIC_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
YOUTUBE_API_KEY
VIMEO_ACCESS_TOKEN
```

Configurer les variables Preview avec des ressources de test (branche Neon et secrets de test) ; ne pas exposer les identifiants de production aux previews non fiables. Les secrets doivent être marqués sensibles.

### Cron Vercel Pro — publication programmée

`packages/api/vercel.json` déclare uniquement la publication programmée, conformément au périmètre approuvé :

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [
    { "path": "/api/v1/cron/publish-scheduled", "schedule": "* * * * *" }
  ]
}
```

Les expressions sont en UTC. Les fonctions Cron sont invoquées en production ; le secret `CRON_SECRET` doit exister dans les variables Production du projet API pour que Vercel envoie l’en-tête `Authorization: Bearer ...`. Les routes renvoient 401 sans ce secret.

**Contrôles et limites :**

- `publish-scheduled` s’exécute toutes les minutes et modifie les playlists arrivées à échéance. Cette cadence entraîne jusqu’à 43 200 invocations par mois pour cette seule tâche ; surveiller consommation, latence et coûts.
- `weekly-digest`, `subscription-reminders` et `subscription-cleanup` ne sont pas activées. Configurer et tester Resend et les effets métier avant toute activation ultérieure.
- La publication vérifie de nouveau l'échéance, la visibilité et la suppression lors d'une mise à jour conditionnelle par playlist ; un échec remonte à l'appelant au lieu de produire un succès silencieux.
- Vérifier les tâches sous **Vercel → Project → Settings/Cron Jobs** après déploiement, et les exécutions/logs après le premier run.

## 6. Procédure de déploiement pas-à-pas

### Étape 0 — Choisir le périmètre et protéger la production

1. Décider si l’API REST reste sur Vercel et si le worker/watch-party est externalisé.
2. Dans Vercel, confirmer que l’équipe `bouaziziws-projects` est bien Pro et que les trois projets sont dans cette équipe.
3. Dans le dépôt, exécuter `git status --short`, identifier les changements à inclure et ne jamais utiliser `git add .` si l’arbre contient des travaux sans rapport.
4. La production a été testée directement avec la CLI, mais cela ne remplace pas un déploiement reproductible depuis Git. Mettre les corrections dans une branche, faire passer CI, puis fusionner via PR vers `main`. Les projets Vercel suivent `main`.
5. Conserver un déploiement précédent prêt au rollback.

### Étape 1 — Vérifier localement

À la racine du monorepo :

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm vercel:validate
pnpm --filter @nourplay/db generate
pnpm --filter @nourplay/db build
pnpm --filter @nourplay/api build
pnpm --filter @nourplay/web build
pnpm --filter @nourplay/admin build
pnpm --filter @nourplay/api test
```

Les Dockerfiles existants utilisent Node 20 tandis que les builds Vercel peuvent utiliser un runtime plus récent. Standardiser et tester Node 22 LTS dans Vercel, les images Docker, les engines et CI avant d’en faire la version de référence.

### Étape 2 — Vérifier PostgreSQL et Redis

1. Vérifier que la base Neon de production est en région Europe/Frankfurt.
2. Connecter le projet API à Neon et vérifier la présence de `DATABASE_URL` (poolée) et `DATABASE_URL_UNPOOLED` (directe). Ne jamais afficher leurs valeurs dans le terminal partagé ou les logs.
3. Connecter Upstash Redis en Frankfurt et vérifier `REDIS_URL` en TLS.
4. Pour BullMQ, contrôler les limites et la politique d’éviction Redis ; choisir une offre/configuration compatible avec la persistance et la sémantique de queue nécessaires.
5. Tester une connexion santé depuis la fonction API. La readiness check doit échouer explicitement si la DB/Redis nécessaires ne sont pas accessibles.

### Étape 3 — Configurer projets et variables

1. Appliquer les réglages des trois tables ci-dessus et s’assurer que le root directory admin est bien `apps/admin`.
2. Définir les variables d’environnement pour **Production** en premier. Ajouter Preview séparément avec ressources de test.
3. Générer les secrets indépendamment avec un générateur cryptographique et les enregistrer dans un gestionnaire de secrets. Ne pas réutiliser les valeurs de développement.
4. Configurer les variables e-mail, R2, Stripe, OAuth et VAPID uniquement après vérification de chaque compte et callback.
5. Vérifier que l’origine web est dans `CORS_ORIGINS` et que les deux proxy origins sont des origines HTTPS distinctes, sans chemin ni slash final.

### Étape 4 — Appliquer les migrations de façon contrôlée

Ne pas mettre `prisma migrate deploy` dans le démarrage de chaque fonction. Utiliser une étape de release unique, après sauvegarde et vérification de l’URL directe :

```powershell
$secureUrl = Read-Host "URL Neon directe" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
try {
  $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  pnpm --filter @nourplay/db migrate:deploy
  if ($LASTEXITCODE -ne 0) { throw "Prisma migration failed with exit code $LASTEXITCODE." }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $secureUrl.Dispose()
}
```

Le prompt masque l'URL et le bloc `finally` supprime la variable d'environnement et libère le tampon sécurisé. Préférer un secret CI injecté de façon contrôlée pour les opérations répétables. Vérifier les migrations appliquées et tester un rollback/sauvegarde selon le plan de reprise.

### Étape 5 — Déployer dans l’ordre

1. Déployer l’API en premier si elle reste sur Vercel.
2. Vérifier `/api/v1/health` et une route métier publique.
3. Déployer `nourplay-admin`, vérifier `/admin/login`.
4. Déployer `nourplay`, vérifier `/` et les rewrites vers `/api/*` et `/admin/*`.
5. Avec Git intégré, fusionner la PR sur la branche Production configurée. Pour un déploiement CLI contrôlé, lier chaque répertoire au projet correct et lancer un déploiement production seulement après les vérifications. Ne pas mélanger accidentellement un déploiement local ad hoc avec la source Git de référence.
6. Vérifier que les URLs de déploiement sont marquées **Ready**, que le domaine apex pointe vers le web, et que `www` redirige vers l’apex.

### Étape 6 — Désactiver le worker dans l’environnement Docker/VPS

Le worker n’est pas une fonction Vercel : il est défini dans `docker-compose.prod.yml`. La configuration locale actuelle le met derrière le profil `worker`, et le workflow modifié ne doit ni construire ni déployer son image. Le workflow GitHub conserve toutefois un déploiement Docker distinct pour staging et un déclenchement manuel pour production. Si Vercel est l'unique production attendue, décider explicitement si ce déploiement VPS doit rester actif pour d'autres services ou être retiré ; sinon, les deux chaînes de déploiement risquent de diverger.

Sur l’hôte qui exécute encore l’ancienne stack, après vérification de son compose :

```bash
docker compose -f docker-compose.prod.yml stop video-validator
docker compose -f docker-compose.prod.yml rm -f video-validator
```

Ne pas ajouter `--profile worker` pour arrêter le worker si la version locale est déjà passée derrière ce profil et que Compose ne le résout pas sans profil ; inspecter `docker compose config --profiles` et `docker compose ps` avant l’action. Ensuite, fusionner la modification du workflow dans la branche déployée et vérifier qu’aucun nouveau build d’image `video-validator` n’est lancé. L'arrêt/suppression sur un hôte de production déjà en service n'a pas été vérifié par les contrôles Vercel ; l'exécuter et le confirmer séparément sur cet hôte.

Le worker reste désactivé : ne déployer aucun remplacement sur Railway, Render ou Vercel Daemons sans nouvelle autorisation. Les validations vidéo en attente ne seront pas traitées tant qu'il est arrêté.

### Étape 7 — Déployer et vérifier le Cron approuvé

1. Vérifier que la section `crons` ne contient que `publish-scheduled` et que `CRON_SECRET` est configuré en Production.
2. Vérifier que la tâche et ses effets sont approuvés.
3. Déployer en production : ce déploiement active les tâches immédiatement.
4. Vérifier leur présence dans le tableau de bord, les logs d’exécution et les résultats métier.
5. Tester le contrôle d’accès : sans `CRON_SECRET`, l’endpoint doit répondre 401. Ne jamais tester avec une valeur réelle dans un outil qui conserve l’historique.
6. Si l’API se déplace vers Railway/Render, utiliser le scheduler de cette plateforme ou un scheduler externe ; ne pas compter sur la configuration Cron d’un projet Vercel différent sans valider le routage et la transmission du secret.

### Étape 8 — Tester la watch-party en conditions réalistes

Le client web force déjà `transports: ['websocket']`, ce qui est requis pour Socket.IO sur Vercel. Il faut néanmoins tester :

1. handshake WebSocket depuis le domaine public et la réécriture en `/api`;
2. deux clients dans le même salon, puis plusieurs salons;
3. clients servis par des instances différentes;
4. fermeture/reconnexion d’un socket, et resynchronisation du salon;
5. redéploiement pendant qu’une session est ouverte;
6. durée maximale de connexion et reconnexion automatique.

La connexion WebSocket Vercel est limitée par la durée max de la fonction (Pro : 800 s max standard, extension bêta selon runtime/configuration) ; chaque client doit tolérer la fermeture et se reconnecter. Les salons et participants doivent être dans Redis/DB ou dans un service Socket.IO durable avec coordination partagée. Si ces tests ne passent pas, servir la passerelle depuis Railway/Render et définir une URL WSS dédiée.

### Étape 9 — Validation avant Go-Live

```text
[ ] web : HTTP 200, login et parcours principaux
[ ] admin : login, basePath /admin et autorisations
[ ] API : health 200, DB/Redis OK, route métier 200
[ ] rewrites /api et /admin testés via nour-play.app
[ ] cookies Secure/SameSite et CORS vérifiés depuis le navigateur
[ ] OAuth callbacks testés si activés
[ ] e-mail Resend testé en délivrabilité contrôlée
[ ] R2 upload/download testé, ACL et CORS corrects
[ ] Stripe webhook testé avec signature valide et test invalide
[ ] Web Push testé si activé
[ ] worker BullMQ arrêté sur tout ancien serveur ; aucun worker actif
[ ] Cron de publication contrôlé après son premier run ; autres tâches désactivées
[ ] logs, alertes, sauvegardes et procédure rollback opérationnels
```

## 7. Ajustements de code/configuration à prévoir

### 7.1 Corriger le cache PWA des réponses API privées

Le `runtimeCaching` actuel de `apps/web/next.config.mjs` utilise un `NetworkFirst` général pour les URL contenant `/api/` et autorise des réponses `200` à entrer dans le cache. Cela couvre potentiellement des réponses personnalisées par compte. Recommandation :

- soit enlever cette règle générale et utiliser `NetworkOnly` pour `/api/`;
- soit mettre en cache uniquement une route publique explicitement identifiée (par exemple catalogue public), sans cookie, bearer token ni réponse contenant des données personnelles.

Tester la séquence : connexion compte A → logout → connexion compte B hors ligne et en ligne. Aucune réponse privée de A ne doit apparaître.

### 7.2 Séparer les rôles dans BullMQ

Garder la création de jobs dans l’API, mais lancer le consommateur exclusivement dans le worker. N’activer qu’un seul consommateur en production si le traitement n’est pas conçu pour être concurrent. Les tâches doivent être idempotentes, récupérables après crash et observables via profondeur/âge de queue.

### 7.3 Node.js

Standardiser le runtime sur Node 22 LTS testé et supporté : réglage Vercel, image API, image worker, CI, `.nvmrc` (si adopté) et `engines`. Éviter un décalage entre `node:20-alpine` pour les Dockerfiles et le runtime réellement exécuté par Vercel.

### 7.4 Configuration du worker local

`packages/api/.vercelignore` n’est pas un mécanisme fiable pour désactiver le worker du monorepo : le worker est situé dans `workers/`, hors du root API. Les contrôles pertinents sont le projet Vercel (root API uniquement), l’absence de build worker dans le workflow de production et le profil Compose désactivé.

Le `.vercelignore` à la racine exclut les fichiers `.env` et `.env.*` des déploiements CLI. Un déploiement direct depuis le poste ne remplace pas la sauvegarde des changements dans Git : tant que ces fichiers ne sont pas intégrés à la branche de production, un futur déploiement Git risque de supprimer la configuration Cron.

## 8. Exploitation et coûts

- **Vercel Pro Functions** : surveiller invocations, durée, mémoire, concurrence, régions et transfert réseau.
- **Cron chaque minute** : 43 200 appels/mois par tâche ; garder seulement si cette cadence est nécessaire.
- **WebSockets** : les connexions ouvertes consomment de la mémoire provisionnée jusqu’à fermeture et sont limitées en durée.
- **Daemons** : les ressources provisionnées pendant l’attente de jobs sont facturées sur Pro ; la bêta n’a pas d’autoscaling.
- **Neon/Upstash** : vérifier les limites connexions, pool, stockage, débit, backup/PITR et politique d’éviction.
- **Région** : conserver fonctions API, Neon et Redis proches (Frankfurt/EU) et mesurer la latence réelle.
- **Alertes** : erreurs 5xx, échecs cron, profondeur de queue, DB pool saturé, Redis throttling, coût mensuel.

## 9. Références officielles

- [Vercel Cron — usage et plans](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)
- [Vercel Schedules — limites et cadence Pro](https://vercel.com/docs/schedules/limits)
- [Créer et déployer un Cron Job](https://vercel.com/docs/schedules/cron-jobs/quickstart)
- [Limites Vercel Functions](https://vercel.com/docs/functions/limitations)
- [Régions des Functions](https://vercel.com/docs/functions/configuring-functions/region)
- [WebSockets sur Vercel Functions](https://vercel.com/docs/functions/websockets)
- [Fonctions WebSocket, reconnexion et état partagé](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Docker et workers continus sur Vercel](https://vercel.com/kb/guide/docker)
- [Limites des Vercel Daemons](https://vercel.com/docs/daemons/limits)
- [Configuration Vercel Daemons](https://vercel.com/docs/daemons/config-reference)
- [Neon](https://neon.tech/docs)
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)


# NourPlay : terminer le déploiement pas à pas

Guide pour Windows, le domaine `nour-play.app`, l'équipe Vercel
`bouaziziws-projects`, Neon, Upstash, cron-job.org et Railway.

**État au 14 novembre 2026 :** le projet Vercel `nourplay-api` existe et ses
réglages NestJS ont été enregistrés. Les ressources Neon `nourplay-db` et
Upstash `nourplay-redis` ont été créées à Francfort et reliées à ce projet.
Redis a été relié à **Production uniquement** ; la branche Neon Preview a été
activée. Les routes cron et le binaire Prisma Linux sont présents **localement**,
mais ne sont pas nécessairement sur GitHub. Les applications, les migrations,
les tâches externes et le worker n'ont pas été vérifiés en production.

**La watch-party n'est pas encore adaptée à Vercel.** La section 9 décrit le
travail de développement et les tests nécessaires ; ce n'est pas une simple
configuration à activer.

## 1. Prérequis et précautions

1. Connectez-vous à [Vercel](https://vercel.com/dashboard),
   [Neon](https://console.neon.tech), [cron-job.org](https://console.cron-job.org/)
   et [Railway](https://railway.com/dashboard).
2. Dans Vercel, sélectionnez **bouaziziws-projects** et vérifiez que le domaine
   `nour-play.app` et les projets `nourplay`, `nourplay-admin` et
   `nourplay-api` appartiennent à cette équipe.
3. Vérifiez les tarifs et les limites avant la mise en service : le plan
   Vercel Hobby est destiné à un usage personnel non commercial ; pour une
   activité commerciale, choisissez un plan approprié. Hobby ne permet pas de
   cron Vercel toutes les minutes ; ce guide utilise cron-job.org à la place.
   Railway était en essai limité lors de la dernière vérification : l'essai
   peut expirer et restreindre le réseau sortant. Upstash Free affichait
   500 000 commandes par mois ; le worker BullMQ et la watch-party peuvent
   consommer ce quota rapidement.
4. N'envoyez pas de mots de passe, clés API ou URL de connexion dans un chat,
   un ticket, Git ou des captures d'écran. Enregistrez-les dans un gestionnaire
   de mots de passe et renseignez-les directement dans les interfaces des
   services. Ne copiez pas le fichier `.env` local vers la production.
5. Si un site existant utilise déjà ce domaine, prévoyez un créneau de
   bascule : changer son projet ou son domaine peut interrompre son accès.
   Faites une sauvegarde et vérifiez le plan de retour arrière.

Dans PowerShell, à la racine du dépôt :

```powershell
Set-Location D:\DEV\nourplay
node --version
pnpm --version
git status --short
```

Le projet demande Node.js 20 ou plus et pnpm 9.15.0. Si `pnpm` est introuvable
et que `corepack enable` échoue avec `EPERM`, utilisez :

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\corepack" | Out-Null
corepack enable --install-directory "$env:LOCALAPPDATA\corepack"
$env:Path = "$env:LOCALAPPDATA\corepack;$env:Path"
pnpm --version
```

Le changement de `Path` ci-dessus ne vaut que pour la fenêtre PowerShell
courante.

## 2. Préparer et publier le code

1. Examinez les changements affichés par `git status --short` : le dépôt
   contenait déjà d'autres modifications. Ne faites pas `git add .` sans les
   avoir examinées.
2. Vérifiez que le code à publier comprend notamment :
   - `packages/api/src/modules/cron/cron.controller.ts` et `cron.module.ts` ;
   - l'import du module cron et la désactivation de `ScheduleModule.forRoot()`
     sur Vercel dans `packages/api/src/app.module.ts` ;
   - les exports des services de tâches dans les modules `user` et
     `subscription` ;
   - `rhel-openssl-3.0.x` dans les `binaryTargets` du schéma Prisma ;
   - les rewrites de `apps/web/next.config.mjs`, l'exclusion de `/admin` du
     middleware web et le `basePath` configurable dans `apps/admin`.
3. À la racine, validez au minimum :

   ```powershell
   pnpm --filter @nourplay/db generate
   pnpm --filter @nourplay/db build
   pnpm --filter @nourplay/api test
   pnpm --filter @nourplay/api typecheck
   pnpm --filter @nourplay/api build
   pnpm --filter @nourplay/web build
   pnpm --filter @nourplay/admin build
   ```

4. Corrigez les erreurs avant de continuer. Faites relire et committez
   **uniquement** les changements souhaités, y compris les fichiers cron
   actuellement non suivis. Poussez votre branche, ouvrez une pull request et
   fusionnez-la dans la branche de production choisie, normalement `main`.
5. Vérifiez sur GitHub que la branche de production contient bien ces fichiers.
   Les projets Vercel et Railway déployés depuis GitHub ne voient pas les
   fichiers restés seulement sur votre ordinateur.

## 3. Configurer les projets Vercel

Dans chaque projet : **Settings → Build and Deployment**. Vérifiez que
**Include files outside the root directory in the Build Step** est activé et
que Node.js 22.x est sélectionné. Reliez le dépôt GitHub
`bouaziziw/nourplay` dans **Settings → Git**, avec `main` comme branche de
production, après avoir vérifié l'association existante.

| Projet existant | Framework | Root Directory | Install Command | Build Command |
|---|---|---|---|---|
| `nourplay` | Next.js | `apps/web` | `cd ../.. && pnpm install --frozen-lockfile` | `cd ../.. && pnpm --filter @nourplay/web build` |
| `nourplay-admin` | Next.js | `apps/admin` | `cd ../.. && pnpm install --frozen-lockfile` | `cd ../.. && pnpm --filter @nourplay/admin build` |
| `nourplay-api` | NestJS | `packages/api` | `cd ../.. && pnpm install --frozen-lockfile` | `cd ../.. && pnpm --filter @nourplay/db generate && pnpm --filter @nourplay/db build && pnpm --filter @nourplay/api build` |

Ces commandes s'exécutent sur Linux dans Vercel. Les réglages de l'API ont été
enregistrés précédemment ; vérifiez-les avant de les modifier. Pour l'API,
choisissez la région de fonction **Frankfurt (`fra1`)** si elle est disponible.

### 3.1 Variables de l'API

Dans `nourplay-api → Settings → Environment Variables`, environnement
**Production** :

| Nom | Valeur ou action |
|---|---|
| `DATABASE_URL` | URL poolée Neon ; vérifier sa présence, sans l'afficher dans un journal. |
| `DATABASE_URL_UNPOOLED` | URL directe Neon ; vérifier sa présence. Le schéma actuel n'utilise pas `directUrl` ; voir section 4. |
| `REDIS_URL` | URL TCP TLS Upstash `rediss://…` ; vérifier sa présence. |
| `JWT_ACCESS_SECRET` | Secret aléatoire unique. |
| `JWT_REFRESH_SECRET` | Autre secret aléatoire unique. |
| `COOKIE_SECRET` | Autre secret aléatoire unique. |
| `CRON_SECRET` | Autre secret aléatoire unique, conservé aussi pour cron-job.org. |
| `APP_URL` | `https://nour-play.app` |
| `API_URL` | `https://nour-play.app` |
| `ADMIN_URL` | `https://nour-play.app/admin` |
| `CORS_ORIGINS` | `https://nour-play.app,https://www.nour-play.app` (origines uniquement, sans chemin) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `900` / `604800` |
| `TOTP_ISSUER` / `TOTP_APP_NAME` | `NourPlay` |

Générez chaque secret indépendamment avec votre gestionnaire de mots de passe,
ou, dans un terminal privé, avec la commande ci-dessous **une fois par
secret**. Copiez chaque résultat dans le gestionnaire puis dans Vercel ;
effacez l'affichage du terminal lorsque vous avez terminé.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dans Vercel, marquez les secrets comme **Secret**. Une valeur Secret devient
illisible après enregistrement : conservez `CRON_SECRET` dans votre
gestionnaire pour pouvoir l'ajouter à cron-job.org. Les variables de
l'intégration Neon peuvent également être secrètes et ne pas être récupérables
avec `vercel env pull` ; utilisez la console Neon si nécessaire.

Pour les fonctionnalités complètes, créez aussi les services et variables
suivants :

- **Emails :** domaine vérifié dans Resend, enregistrements DNS fournis par
  Resend, puis `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` et
  `EMAIL_FROM=NourPlay <noreply@nour-play.app>`. Sans cela, le mode par défaut
  `console` n'envoie pas d'email réel ; ne considérez pas l'inscription comme
  opérationnelle.
- **Avatars et exports :** bucket S3 compatible, par exemple Cloudflare R2, puis
  `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` et
  `S3_PUBLIC_URL`.
- **Paiements :** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` et
  `STRIPE_WEBHOOK_SECRET`. Dans Stripe, configurez l'endpoint
  `https://nour-play.app/api/v1/subscriptions/webhook`, puis testez les
  événements d'abonnement et de facture avant d'activer les paiements.
- **Google OAuth :** configurez `GOOGLE_CALLBACK_URL` et l'URI de redirection
  autorisée dans Google sur
  `https://nour-play.app/api/v1/auth/google/callback`.
- **Notifications push :** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et
  `VAPID_SUBJECT`, après génération des clés.

Ne mettez pas `OPENAI_API_KEY` dans l'API : elle va dans le worker Railway.
Créez des ressources et secrets séparés pour les previews ; ne branchez pas
une preview sur le Redis de production. Tant qu'aucun Redis Preview n'est
configuré, l'API Preview ne sera pas pleinement utilisable.

### 3.2 Variables des interfaces

Dans `nourplay → Settings → Environment Variables → Production` :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://nour-play.app/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `https://nour-play.app` |
| `NEXT_PUBLIC_S3_PUBLIC_URL` | URL publique HTTPS de votre stockage, une fois configuré |
| `API_PROXY_ORIGIN` | Origine HTTPS stable du projet API, par exemple `https://<alias-api>.vercel.app`, sans chemin ni `/` final |
| `ADMIN_PROXY_ORIGIN` | Origine HTTPS stable du projet admin, par exemple `https://<alias-admin>.vercel.app`, sans chemin ni `/` final |

Dans `nourplay-admin`, définissez `NEXT_PUBLIC_API_URL` avec la même valeur et
`ADMIN_BASE_PATH=/admin` au build et à l'exécution. Les deux origines de proxy doivent être renseignées
ensemble au build du web, et ne doivent pas pointer vers `nour-play.app`
(boucle). Elles sont des adresses techniques accessibles par le proxy, pas des
sous-domaines publics personnalisés. Déployez l'admin avec son `basePath` avant
le web. La configuration de routage et les variables `NEXT_PUBLIC_*` sont
figées au build : redéployez après toute modification. Pour les previews,
utilisez des origines et une base/Redis isolés ; ne pointez pas leurs rewrites
sur la production. Vérifiez la protection des déploiements en amont : une
authentification Vercel peut bloquer le proxy. Ne désactivez pas une protection
sans en évaluer les conséquences et ne placez aucun secret de bypass dans une
URL ou une variable publique. Les origines directement accessibles ne sont
pas nécessairement couvertes par les règles du projet web : protégez aussi
l'origine admin sans empêcher les requêtes légitimes du proxy.

Ne définissez `NEXT_PUBLIC_WS_URL` qu'après l'adaptation et les tests de la
section 9 ; le proxy HTTP actuel ne route pas Socket.IO. Une valeur vide fait
actuellement
retomber le navigateur sur `localhost:4000` ; elle ne désactive pas la page
watch-party.

## 4. Appliquer les migrations Neon

1. Ouvrez la ressource `nourplay-db` dans Vercel puis **Open in Neon**.
   Sélectionnez explicitement la **branche de production** et copiez son URL
   PostgreSQL **directe**, sans pooler. Vérifiez deux fois la base et la
   branche : les migrations modifient la base choisie.
2. Sauvegardez la base si elle contient des données, consultez les migrations
   dans `packages/db/prisma/migrations` et prévoyez une fenêtre de maintenance.
3. Dans une fenêtre PowerShell privée à la racine, utilisez la commande
   suivante. Elle demande l'URL sans l'afficher ; n'ajoutez pas l'URL en clair
   au fichier ni à l'historique :

   ```powershell
   Set-Location D:\DEV\nourplay
   $previousDatabaseUrl = $env:DATABASE_URL
   try {
     $secureUrl = Read-Host "URL Neon DIRECTE de production" -AsSecureString
     $env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $secureUrl).Password
     if (-not $env:DATABASE_URL) { throw "URL Neon manquante" }
     pnpm --filter @nourplay/db migrate:deploy
     if ($LASTEXITCODE -ne 0) { throw "Échec des migrations Prisma" }
   } finally {
     $env:DATABASE_URL = $previousDatabaseUrl
     Remove-Variable secureUrl -ErrorAction SilentlyContinue
     Remove-Variable previousDatabaseUrl -ErrorAction SilentlyContinue
   }
   ```

   Le schéma actuel ne déclare pas `directUrl` : la commande utilise donc
   temporairement l'URL directe comme `DATABASE_URL`. Elle ne change pas la
   variable poolée de l'API dans Vercel. N'utilisez pas `pnpm db:migrate:prod`
   ici : ce script charge le `.env` local.
4. Attendez la confirmation Prisma que les migrations ont été appliquées.
   En cas d'erreur, arrêtez-vous et consultez les logs Prisma ; ne lancez pas
   `migrate reset`. N'exécutez **jamais** `pnpm db:seed` en production :
   il crée des comptes de test.

Les branches Neon Preview doivent aussi recevoir les migrations sur leurs
propres URL directes avant les tests ; elles ne doivent pas utiliser la base
de production.

## 5. Déployer l'API, le web et l'administration

1. Dans Vercel, vérifiez une dernière fois les variables, la branche Git et
   les paramètres de build de chaque projet.
2. Déclenchez le déploiement de la branche de production dans chaque projet :
   `nourplay-api`, puis `nourplay-admin`, puis `nourplay`. Dans **Deployments**,
   ouvrez les logs de build et attendez le statut **Ready**. Un projet créé
   sans connexion Git doit d'abord être lié au dépôt.
3. Dans **Settings → Domains**, associez :
   - `nour-play.app` et `www.nour-play.app` à `nourplay` ; configurez
     éventuellement la redirection de `www` vers le domaine principal.
   Ne rattachez pas le même domaine aux trois projets : le web transmet
   `/admin` à l'origine admin et `/api` à l'origine API en conservant le chemin.
4. Si Vercel indique qu'un domaine est déjà associé à un autre projet,
   examinez l'existant avant de le déplacer. Attendez **Valid Configuration**
   et la disponibilité HTTPS. Ne supprimez pas les enregistrements DNS
   existants sans les identifier.
5. Dans PowerShell :

   ```powershell
   nslookup nour-play.app
   curl.exe -I https://nour-play.app
   curl.exe -i https://nour-play.app/admin/login
   curl.exe -i https://nour-play.app/api/v1/subscriptions/plans
   ```

   La dernière route doit répondre sans erreur serveur. Vérifiez ensuite
   inscription, vérification email, connexion et rafraîchissement de session.
   Vérifiez les ressources `/admin/_next/`, les redirections, les paramètres
   de requête et les requêtes POST, ainsi que l'en-tête `Set-Cookie` et le
   chemin `/api/v1/auth`. Testez depuis le domaine public, pas depuis les
   origines techniques `vercel.app`. Web et admin partagent désormais le
   cookie de renouvellement sur cette origine : testez la connexion et la
   déconnexion dans les deux interfaces, notamment avec des comptes différents.
6. Vérifiez les hôtes d'images dans `apps/web/next.config.mjs` et
   `apps/admin/next.config.mjs` : `assets.nourplay.app` est codé en dur. Ajoutez
   le véritable hôte public R2 si nécessaire, puis redéployez.

## 6. Configurer cron-job.org

Les routes appellent de vraies tâches et nécessitent le même `CRON_SECRET` que
celui de l'API. N'activez pas aussi les mêmes tâches sur Vercel Cron ou sur un
serveur NestJS permanent : elles seraient exécutées deux fois.

1. Vérifiez d'abord que le code de la section 2 est déployé. Sans header, cet
   appel doit retourner **401** :

   ```powershell
   curl.exe -i https://nour-play.app/api/v1/cron/publish-scheduled
   ```

2. Connectez-vous à cron-job.org → **Cronjobs → Create cronjob**.
3. Pour chaque ligne du tableau, renseignez **Title**, **URL** et l'expression
   dans **Crontab expression** sous l'onglet **Common**. Dans **Advanced**,
   sélectionnez le fuseau **UTC** dans **Time zone** et **GET** dans
   **Request method**. Sous **Headers**, cliquez sur **Add** et ajoutez :

   ```text
   Authorization: Bearer <CRON_SECRET>
   ```

   Remplacez le texte entre chevrons par la valeur réelle depuis votre
   gestionnaire de mots de passe. Ne mettez jamais ce secret dans l'URL.

| Titre | URL | Calendrier UTC |
|---|---|---|
| Publication playlists | `https://nour-play.app/api/v1/cron/publish-scheduled` | chaque minute, `* * * * *` |
| Résumé hebdomadaire | `https://nour-play.app/api/v1/cron/weekly-digest` | lundi 08:00, `0 8 * * 1` |
| Rappel abonnements | `https://nour-play.app/api/v1/cron/subscription-reminders` | chaque jour 10:00, `0 10 * * *` |
| Expiration abonnements | `https://nour-play.app/api/v1/cron/subscription-cleanup` | chaque jour 02:00, `0 2 * * *` |

4. Testez d'abord sur des données de test isolées. Un appel authentifié
   déclenche réellement l'action : le digest et les rappels peuvent envoyer
   des emails ou notifications. Une réponse `200` contient `{ "ok": true }` ;
   vérifiez également les effets et les logs, car une réponse 200 seule ne
   prouve pas que chaque opération a réussi.
5. Activez les quatre tâches, les alertes d'échec et surveillez l'historique.
   Évitez les exécutions concurrentes et les relances automatiques
   intempestives : les tâches de digest et de rappel ne sont pas garanties
   idempotentes et peuvent envoyer des doublons. Implémentez une déduplication
   persistante avant de compter sur des relances automatiques en production.
6. Si vous changez `CRON_SECRET`, mettez à jour l'API et les quatre tâches,
   redéployez l'API et vérifiez de nouveau les appels.

## 7. Déployer le worker sur Railway

Le worker doit rester actif pour consommer la file BullMQ `video-validation`.
Sans lui, la validation IA n'est pas effectuée ; une intervention humaine peut
être nécessaire. Le worker actuel analyse les éléments fournis, pas
nécessairement la vidéo complète.

1. Vérifiez que le code est bien sur la branche GitHub à déployer.
2. Sur Railway → **New Project → Deploy from GitHub repo**, autorisez et
   sélectionnez `bouaziziw/nourplay`. Sélectionnez la branche voulue.
3. Dans les réglages du service, gardez la **racine du dépôt** comme contexte
   de build et indiquez `workers/video-validator/Dockerfile` comme chemin du
   Dockerfile. Railway permet également de définir la variable
   `RAILWAY_DOCKERFILE_PATH=/workers/video-validator/Dockerfile`.
4. Ajoutez les variables dans **Variables**, sans les publier ailleurs :

   | Nom | Valeur |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | URL Neon de la même base de production que l'API |
   | `REDIS_URL` | même URL TCP Redis que l'API |
   | `OPENAI_API_KEY` | clé OpenAI autorisée et facturation configurée |
   | `AI_MODERATION_MODEL` | `gpt-4o-mini`, ou un modèle compatible disponible sur votre compte |
   | `OPENAI_TIMEOUT_MS` | `45000` |

   Récupérez les URL directement auprès de Neon et Upstash. Vérifiez que
   Redis utilise la politique `noeviction` et que le plan et le réseau
   permettent les connexions TCP et commandes nécessaires à BullMQ.
5. Déployez. Dans les logs de build, confirmez l'utilisation du Dockerfile ;
   dans les logs d'exécution, cherchez `Worker started, listening on queue
   "video-validation"` et les erreurs Redis, Prisma ou OpenAI. Le Dockerfile
   n'a pas été validé par un build Docker lors de la rédaction de ce guide :
   si le build échoue, corrigez-le et retestez avant de continuer.
6. Ajoutez une vidéo de test autorisée et vérifiez le traitement de son job
   et son résultat dans l'application. Surveillez aussi les quotas Redis,
   OpenAI et Railway. Un essai Railway limité peut empêcher certaines
   connexions sortantes ; vérifiez son plan et sa connectivité.

## 8. Créer le premier administrateur

Après configuration et test des emails :

1. Inscrivez un compte normal sur `https://nour-play.app` et validez son email.
2. Dans Neon → **SQL Editor**, vérifiez que vous êtes sur la branche de
   production. Identifiez d'abord le compte :

   ```sql
   SELECT id, email, role FROM users WHERE email = 'VOTRE_EMAIL';
   ```

3. Vérifiez que le résultat contient exactement le compte attendu. Promouvez
   ensuite seulement ce compte :

   ```sql
   UPDATE users SET role = 'ADMIN' WHERE email = 'VOTRE_EMAIL';
   ```

4. Vérifiez qu'une seule ligne a été modifiée, déconnectez-vous et reconnectez-vous
   sur `https://nour-play.app/admin`. Ne publiez pas l'adresse ou les résultats
   de la requête.

## 9. Adapter la watch-party à Vercel — développement nécessaire

Vercel prend en charge les WebSockets avec Fluid Compute, mais une connexion
sur Hobby peut être fermée après 300 secondes et deux clients peuvent arriver
sur des instances différentes. Le code actuel conserve les salles et
participants dans des `Map` locales dans
`packages/api/src/modules/watch-party/watch-party.gateway.ts`. Le simple ajout
de `NEXT_PUBLIC_WS_URL` ne résout donc pas le problème.

**Avant d'exposer cette fonction aux utilisateurs**, faites réaliser et valider
les changements suivants :

1. **Adapter et tester l'entrée WebSocket Vercel.** Le proxy web ne route pas
   actuellement `/socket.io` ; ajoutez et validez un routage compatible
   Upgrade sur le même domaine avant de configurer le client. Activez Fluid Compute, vérifiez que
   le bootstrap NestJS actuel accepte les requêtes HTTP Upgrade sur le chemin
   Socket.IO utilisé et que le namespace `/watch` est accessible. La
   documentation Vercel montre un serveur HTTP exporté pour Socket.IO ; elle
   ne garantit pas à elle seule que le bootstrap NestJS actuel fonctionne sans
   modification. Si nécessaire, adaptez l'entrée et le routage, puis testez
   sur un déploiement de préproduction avant toute bascule.
2. **Diffuser entre instances.** Ajoutez `@socket.io/redis-adapter` aux
   dépendances de l'API et mettez à jour le lockfile avec pnpm. Configurez
   l'adapter dans `packages/api/src/main.ts` via un `IoAdapter` NestJS avec
   deux connexions Redis distinctes pour publication et abonnement.
   Initialisez-les avant d'accepter des clients, gérez les erreurs et fermez-les
   proprement. Vérifiez que votre offre Redis supporte le pub/sub et les
   connexions nécessaires. L'adapter seul ne rend **pas** les `Map` partagées.
3. **Partager l'état et la présence.** Remplacez les `Map` de salles par un
   stockage partagé : identifiant de l'hôte issu de la base, index vidéo et
   présence par connexion dans Redis. Utilisez des clés isolées par salle,
   avec expiration au plus tard à `expiresAt`, et des opérations atomiques
   pour les entrées/sorties concurrentes. Prévoyez des expirations de présence
   et leur renouvellement pour les instances arrêtées brutalement. Ne stockez
   pas les jetons JWT dans Redis.
4. **Préserver le comportement et sécuriser les événements.** Vérifiez le JWT,
   l'existence et l'expiration de la salle, l'appartenance de la connexion à
   la salle et le rôle de l'hôte avant un changement de vidéo. Validez l'index
   et les messages reçus. Gérez plusieurs connexions d'un même utilisateur
   sans qu'une déconnexion supprime sa présence restante. Une déconnexion
   temporaire de l'hôte ne doit pas détruire immédiatement l'état partagé.
5. **Gérer la reconnexion côté web.** Dans
   `apps/web/src/app/[locale]/dashboard/watch-party/[code]/page.tsx`, conservez
   le transport `websocket`, gérez `disconnect` et `connect_error`, effacez
   l'erreur après reconnexion et réémettez `join` à chaque connexion.
   Réhydratez ensuite playlist, index et participants depuis `joined` ; évitez
   les doublons d'événements et de participants.
6. **Tester réellement plusieurs instances.** Avec deux instances API reliées
   au même Redis et deux navigateurs reliés à des instances différentes,
   testez entrée, chat, changement de vidéo, présence, plusieurs onglets,
   déconnexion/reconnexion de l'hôte, redémarrage d'une instance et
   expiration de salle. Vérifiez que les clients se reconnectent après la
   limite de durée Vercel et retrouvent le bon état. Testez les JWT invalides,
   les salles expirées et les actions d'un participant non hôte.
7. Après réussite de ces tests et du déploiement, renseignez
   `NEXT_PUBLIC_WS_URL=https://nour-play.app` dans le projet web et
   redéployez-le. Si le test Upgrade ou le partage d'état échoue, n'annoncez
   pas la watch-party comme disponible.

Références : [WebSockets sur Vercel](https://vercel.com/docs/functions/websockets)
et [Socket.IO sur Vercel](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

## 10. Vérifications finales et retour arrière

- [ ] Le code attendu est présent sur GitHub et chaque projet déploie la bonne branche.
- [ ] Les migrations ont réussi sur la bonne branche Neon ; aucun seed n'a été exécuté.
- [ ] Le domaine répond en HTTPS, ainsi que `/admin/login` et `/api/v1/subscriptions/plans` via les rewrites.
- [ ] Les emails et la connexion avec renouvellement de session fonctionnent.
- [ ] Les quatre tâches cron retournent le résultat attendu ; alertes activées.
- [ ] Le worker traite une vidéo de test ; quotas et facturation surveillés.
- [ ] La watch-party a passé tous les tests de la section 9, ou n'est pas présentée comme disponible.
- [ ] Les paiements, le webhook Stripe, les avatars et les notifications ont été testés si activés.
- [ ] Un administrateur réel est configuré et les secrets sont conservés hors Git.

En cas de problème après une bascule, dans Vercel → **Deployments**, promouvez
le déploiement précédent après vérification. Cela ne revient **pas** en arrière
sur les migrations de base de données : prévoyez séparément une restauration
ou une migration corrective. Consultez aussi les logs Vercel, Railway,
cron-job.org et Neon sans exposer de secrets.

Documentation complémentaire : [guide Vercel existant](./VERCEL_DEPLOYMENT_GUIDE.md),
[limites Cron Vercel](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing),
[Dockerfiles Railway](https://docs.railway.com/builds/dockerfiles) et
[essai Railway](https://docs.railway.com/pricing/free-trial).

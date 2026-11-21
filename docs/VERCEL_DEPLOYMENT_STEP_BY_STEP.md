# 🚀 Guide Déploiement Vercel - NourPlay (Jour après jour)

**Dernière mise à jour:** 16 novembre 2026
**État:** HTTP production vérifié. Le compte est Vercel Pro ; consulter [l'audit Pro](./VERCEL_PRO_COMPATIBILITY_AND_DEPLOYMENT.md) pour les Cron Jobs natifs, WebSockets, Daemons et la recommandation d'architecture.

---

## ✅ Pré-requisites (avant de commencer)

- [x] Compte Vercel (https://vercel.com)
- [x] Domaine `nour-play.app` acheté
- [x] Accès GitHub et dépôt `bouaziziw/nourplay` avec branche `main` à jour
- [x] Accès Neon (https://console.neon.tech)
- [x] Accès Upstash (https://console.upstash.com)
- [x] Accès Railway ou Render (pour le worker)
- [x] Compte Resend (emails)
- [x] Bucket Cloudflare R2 (stockage)
- [x] Compte Stripe (paiements, optionnel)
- [x] Clés Google OAuth (optionnel)
- [x] Clés OpenAI (worker uniquement, pas API)

### Outils locaux

```powershell
# Vérifier Node.js
node --version    # >= 20.0.0
pnpm --version    # >= 9.15.0

# Installer Vercel CLI
npm install -g vercel
vercel --version  # >= 48.4.0

# Générer les secrets (dans PowerShell)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📅 JOUR 1 : Préparer le code et les secrets

### Étape 1.1: Valider le code localement

```powershell
cd D:\DEV\nourplay

# Vérifier l'état Git
git status --short

# Installer les dépendances
pnpm install --frozen-lockfile

# Valider la configuration Vercel
pnpm vercel:validate
```

✅ **Résultat attendu:** Tous les fichiers critiques détectés, aucune erreur.

### Étape 1.2: Générer et stocker les secrets

> ⚠️ Ne JAMAIS les committer. Les stocker dans un gestionnaire de mots de passe.

Dans PowerShell sécurisée (ou Terminal privé):

```powershell
# 1. JWT_ACCESS_SECRET (32+ caractères base64)
$secret1 = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Write-Host "JWT_ACCESS_SECRET: $secret1"

# 2. JWT_REFRESH_SECRET (32+ caractères base64)
$secret2 = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Write-Host "JWT_REFRESH_SECRET: $secret2"

# 3. COOKIE_SECRET (32+ caractères base64)
$secret3 = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Write-Host "COOKIE_SECRET: $secret3"

# 4. CRON_SECRET (32 caractères hex - IMPORTANT: pour cron-job.org aussi)
$secret4 = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Write-Host "CRON_SECRET: $secret4"
```

Copier les 4 secrets dans votre gestionnaire de mots de passe (1Password, Bitwarden, etc.)

### Étape 1.3: Générer les clés VAPID pour Web Push

```powershell
npx web-push generate-vapid-keys
# Résultat:
# Public Key: ...
# Private Key: ...
```

Sauvegarder aussi dans le gestionnaire de mots de passe.

### Étape 1.4: Vérifier et committer

⚠️ La branche de travail est `dev` ; la prod Vercel suit `main`. Ne committez que les fichiers voulus (`git add -p` ou chemins explicites), pas `git add .`.

```powershell
git status --short

git add packages/api docs scripts/validate-vercel.js package.json pnpm-lock.yaml .github/workflows/deploy.yml docker-compose.prod.yml .gitignore .env.example
git commit -m "feat: Vercel deployment (health checks, worker disabled in prod, API fixes)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

git push origin dev
# Puis fusionner dev dans main (PR) pour déclencher le déploiement Git de production
```

---

## 📅 JOUR 2: Créer les projets Vercel & configurer les bases de données

### Étape 2.1: Se connecter à Vercel

```powershell
vercel login
```

### Étape 2.2: Créer le projet Web (nourplay)

1. **Via UI Vercel** (plus intuitif):
   - Aller sur https://vercel.com/dashboard
   - Cliquer **Add New → Project**
   - Chercher `bouaziziw/nourplay` et cliquer **Import**
   - **Configure Project:**
     - **Project Name:** `nourplay`
     - **Framework Preset:** Next.js
     - **Root Directory:** `apps/web`
     - **Build Command (Override):** `cd ../.. && pnpm --filter @nourplay/web build`
     - **Install Command (Override):** `cd ../.. && pnpm install --frozen-lockfile`
     - Cliquer **Deploy**
   - ⏳ Attendre le build (peut échouer car variables manquantes: c'est normal)

2. **Via CLI** (optionnel):
   ```powershell
   cd apps/web
   vercel link
   vercel pull --yes
   ```

### Étape 2.3: Créer le projet Admin (nourplay-admin)

Répéter Étape 2.2 avec:
- **Project Name:** `nourplay-admin`
- **Root Directory:** `apps/admin`
- **Build Command:** `cd ../.. && pnpm --filter @nourplay/admin build`

### Étape 2.4: Créer le projet API (nourplay-api)

1. **Via Vercel UI:**
   - **Add New → Project**
   - Importer `bouaziziw/nourplay`
   - **Configure Project:**
     - **Project Name:** `nourplay-api`
     - **Framework Preset:** NestJS
     - **Root Directory:** `packages/api`
     - **Build Command (Override):** 
       ```
       cd ../.. && pnpm --filter @nourplay/db generate && \
       pnpm --filter @nourplay/db build && \
       pnpm --filter @nourplay/api build
       ```
     - **Settings → Functions → Region:** Frankfurt (`fra1`) ← **IMPORTANT**
     - Cliquer **Deploy**

### Étape 2.5: Créer Neon PostgreSQL (Frankfurt)

1. Dans **Vercel Dashboard → (Équipe) → Storage:**
   - Cliquer **Create Database**
   - Choisir **Neon**
   - Cliquer **Create New Neon Account** (facturation via Vercel)
   - **Configuration:**
     - **Region:** Europe — Frankfurt (`eu-central-1`)
     - **Database Name:** `nourplay-db`
     - Cliquer **Create**

2. **Connecter au projet API:**
   - **Storage → nourplay-db → Projects → Connect Project**
   - Choisir `nourplay-api`
   - Cocher: **Development**, **Preview**, **Production**
   - Cocher: **Preview** (create branch pour Preview deployments)
   - Cliquer **Connect**

✅ Variables auto-injectées:
   - `DATABASE_URL` (poolée)
   - `DATABASE_URL_UNPOOLED` (directe)

### Étape 2.6: Créer Upstash Redis (Frankfurt)

1. Dans **Vercel Dashboard → Storage:**
   - Cliquer **Create Database**
   - Choisir **Upstash**
   - **Configuration:**
     - **Region:** EU (Frankfurt)
     - **Database Name:** `nourplay-redis`
     - Cliquer **Create**

2. **Connecter au projet API:**
   - **Storage → nourplay-redis → Projects → Connect Project**
   - Choisir `nourplay-api`
   - Cocher: **Development**, **Preview**, **Production**
   - Cliquer **Connect**

3. **Configurer l'éviction:**
   - Dans **nourplay-redis → Upstash Console → Configuration:**
   - **Eviction Policy:** `noeviction` (obligatoire pour BullMQ)
   - Sauvegarder

✅ Variable auto-injectée:
   - `REDIS_URL` (format: `rediss://...`)

---

## 📅 JOUR 3: Configurer les variables d'environnement

### Étape 3.1: Variables API (nourplay-api)

Dans **Vercel → nourplay-api → Settings → Environment Variables → Production:**

| Nom | Valeur | Secret? |
|---|---|---|
| `JWT_ACCESS_SECRET` | `<du gestionnaire>` | ✅ |
| `JWT_REFRESH_SECRET` | `<du gestionnaire>` | ✅ |
| `COOKIE_SECRET` | `<du gestionnaire>` | ✅ |
| `CRON_SECRET` | `<du gestionnaire>` | ✅ |
| `JWT_ACCESS_TTL` | `900` | ❌ |
| `JWT_REFRESH_TTL` | `604800` | ❌ |
| `BCRYPT_ROUNDS` | `12` | ❌ |
| `TOTP_ISSUER` | `NourPlay` | ❌ |
| `TOTP_APP_NAME` | `NourPlay` | ❌ |
| `APP_URL` | `https://nour-play.app` | ❌ |
| `API_URL` | `https://nour-play.app` | ❌ |
| `ADMIN_URL` | `https://nour-play.app/admin` | ❌ |
| `CORS_ORIGINS` | `https://nour-play.app,https://www.nour-play.app` | ❌ |
| `EMAIL_PROVIDER` | `resend` | ❌ |
| `RESEND_API_KEY` | `re_<key>` | ✅ |
| `EMAIL_FROM` | `NourPlay <noreply@nour-play.app>` | ❌ |
| `S3_ENDPOINT` | `https://<ACCOUNT>.r2.cloudflarestorage.com` | ❌ |
| `S3_ACCESS_KEY_ID` | `<key>` | ✅ |
| `S3_SECRET_ACCESS_KEY` | `<secret>` | ✅ |
| `S3_BUCKET` | `nourplay-assets` | ❌ |
| `S3_PUBLIC_URL` | `https://assets.nourplay.app` | ❌ |
| `VAPID_PUBLIC_KEY` | `<clé générée>` | ❌ |
| `VAPID_PRIVATE_KEY` | `<clé générée>` | ✅ |
| `VAPID_SUBJECT` | `mailto:security@nour-play.app` | ❌ |

**Optionnel (Stripe):**
```
STRIPE_SECRET_KEY = sk_live_...
STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_WEBHOOK_SECRET = whsec_...
```

**Optionnel (OAuth Google):**
```
GOOGLE_CLIENT_ID = ...
GOOGLE_CLIENT_SECRET = ...
GOOGLE_CALLBACK_URL = https://nour-play.app/api/v1/auth/google/callback
```

**Optionnel (Vidéos):**
```
YOUTUBE_API_KEY = ...
VIMEO_ACCESS_TOKEN = ...
```

### Étape 3.2: Variables Web (nourplay)

Dans **Vercel → nourplay → Settings → Environment Variables → Production:**

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://nour-play.app/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `https://nour-play.app` |
| `NEXT_PUBLIC_S3_PUBLIC_URL` | `https://assets.nourplay.app` |
| `API_PROXY_ORIGIN` | `https://nourplay-api.vercel.app` |
| `ADMIN_PROXY_ORIGIN` | `https://nourplay-admin.vercel.app` |

### Étape 3.3: Variables Admin (nourplay-admin)

Dans **Vercel → nourplay-admin → Settings → Environment Variables → Production:**

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://nour-play.app/api/v1` |
| `ADMIN_BASE_PATH` | `/admin` |

### Étape 3.4: Redéployer sans cache

Pour que les variables soient prises en compte:

1. Dans **Vercel → nourplay-api → Deployments:**
   - Cliquer sur le dernier déploiement
   - Cliquer **⋯ → Redeploy**
   - Décocher **Use existing Build Cache**
   - Cliquer **Redeploy**

2. Répéter pour `nourplay` et `nourplay-admin`

⏳ Attendre les 3 builds (5-10 min chacun)

✅ **Résultat attendu:** Tous les projets en statut **Ready**

---

## 📅 JOUR 4: Appliquer les migrations & tester l'API

### Étape 4.1: Migrer la base de données

```powershell
cd D:\DEV\nourplay

# Récupérer les variables Neon du projet API
vercel link --repo  # Lier tous les projets si pas déjà fait
cd packages/api
vercel env pull ../../.env.production.local --environment=production

# Extraire l'URL directe Neon
# La variable $env:DATABASE_URL_UNPOOLED doit être présente dans .env.production.local
```

> ⚠️ **Ne pas afficher l'URL en clair!** Utiliser `Read-Host -AsSecureString` si possib

le.

```powershell
# Méthode sécurisée (recommandée)
$secureUrl = Read-Host "Coller l'URL Neon DIRECTE (DATABASE_URL_UNPOOLED)" -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $secureUrl).Password

# Vérifier que DATABASE_URL est défini
if (-not $env:DATABASE_URL) { throw "DATABASE_URL manquante" }

# Appliquer les migrations
cd D:\DEV\nourplay
pnpm --filter @nourplay/db migrate:deploy

# Attendre le succès
# Puis restaurer DATABASE_URL
```

✅ **Résultat attendu:** Message Prisma "All migrations applied successfully"

### Étape 4.2: Vérifier que l'API démarre

```powershell
# Récupérer les variables en local
cd packages/api
vercel env pull ../../.env.local --environment=production

# Lancer l'API localement
pnpm dev

# Vérifier les logs
# ✅ NourPlay API running on http://localhost:4000/api
# ✅ 🚀 Running on Vercel
```

### Étape 4.3: Tester l'endpoint de santé

Dans un autre terminal PowerShell:

```powershell
# Test 1: Health check
curl.exe https://nour-play.app/api/v1/health
# Résultat: JSON avec status ok/degraded

# Test 2: Route publique (pas de cron secret requis)
curl.exe https://nour-play.app/api/v1/subscriptions/plans
# Résultat: JSON liste des plans

# Test 3: Route cron (doit retourner 401 sans secret)
curl.exe -i https://nour-play.app/api/v1/cron/publish-scheduled
# Résultat: HTTP 401 Unauthorized (correct!)
```

✅ **Résultat attendu:** API répond aux 3 tests

### Étape 4.4: Tester le routage Web + Admin

```powershell
# Test 1: Web
curl.exe -I https://nour-play.app
# Résultat: HTTP 200 OK

# Test 2: Admin (via rewrite)
curl.exe -I https://nour-play.app/admin/login
# Résultat: HTTP 200 OK, page admin

# Test 3: API (via rewrite)
curl.exe -I https://nour-play.app/api/v1/health
# Résultat: HTTP 200 OK, JSON
```

✅ **Résultat attendu:** Tous les chemins répondent correctement

---

## 📅 JOUR 5: Activer le scheduler (Vercel Cron Pro ou cron-job.org)

Le compte utilise Vercel Pro. Pour les tâches de production, le guide Pro décrit le `vercel.json` à activer et les contrôles métier à effectuer avant le déploiement. N'activer les e-mails planifiés qu'après avoir testé Resend. cron-job.org reste une alternative si les tâches sont déplacées hors de Vercel ou si un scheduler externe est préféré.

### Étape 5.1: Créer un compte cron-job.org

- Aller sur https://console.cron-job.org/
- **Sign Up** ou **Sign In**
- Valider l'email si nécessaire

### Étape 5.2: Créer les 4 tâches cron

#### Tâche 1: Publier playlists planifiées

1. Cliquer **Create Cronjob**
2. Remplir:
   - **URL:** `https://nour-play.app/api/v1/cron/publish-scheduled`
   - **HTTP Method:** GET
   - **Execution time:** `* * * * *` (chaque minute)
   - **Timezone:** UTC
3. **Advanced:**
   - Cliquer pour ouvrir
   - **Authorization Type:** Bearer Token
   - **Authorization Value:** `<CRON_SECRET>`
4. Cliquer **Create Execution**

#### Tâche 2: Digests hebdomadaires

- **URL:** `https://nour-play.app/api/v1/cron/weekly-digest`
- **Execution time:** `0 8 * * 1` (lundi 8h UTC)
- **Authorization:** Bearer `<CRON_SECRET>`

#### Tâche 3: Rappels d'expiration

- **URL:** `https://nour-play.app/api/v1/cron/subscription-reminders`
- **Execution time:** `0 10 * * *` (quotidien 10h UTC)
- **Authorization:** Bearer `<CRON_SECRET>`

#### Tâche 4: Nettoyage abonnements expirés

- **URL:** `https://nour-play.app/api/v1/cron/subscription-cleanup`
- **Execution time:** `0 2 * * *` (quotidien 2h UTC)
- **Authorization:** Bearer `<CRON_SECRET>`

### Étape 5.3: Tester manuellement

Depuis cron-job.org, cliquer **Run now** sur chaque tâche.

Dans les logs `nourplay-api` Vercel, vérifier les appels HTTP entrants.

✅ **Résultat attendu:** Chaque tâche retourne HTTP 200

---

## 📅 JOUR 6: Déployer le Worker (Railway)

### Étape 6.1: Créer un projet Railway

1. Aller sur https://railway.com/dashboard
2. Cliquer **New Project**
3. Cliquer **Deploy from GitHub**
4. Chercher `bouaziziw/nourplay` et cliquer
5. Sélectionner **Deploy from GitHub Repo**
6. Confirmer et attendre le clone

### Étape 6.2: Configurer le build

1. **Settings → General:**
   - **Root Directory:** `workers/video-validator`
   - **Build Command:** `pnpm install --frozen-lockfile && pnpm build`
   - **Start Command:** `pnpm start`
   - **Node Version:** 22.x

2. **Variables d'environnement:**
   - `REDIS_URL`: Copier la valeur depuis Vercel (même Upstash)
   - `OPENAI_API_KEY`: Clé OpenAI (⚠️ PAS sur l'API)
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Optionnel (pour les logs)

### Étape 6.3: Déployer

- Cliquer **Deploy**
- ⏳ Attendre les logs "Successfully deployed"

✅ **Résultat attendu:** Worker tourne, consomme la file Redis

---

## 📅 JOUR 7: Tests complets & Mise en production

### Étape 7.1: Tests d'inscription

1. Aller sur https://nour-play.app
2. Créer un compte avec email valide
3. Vérifier la réception du mail de vérification (Resend logs)
4. Cliquer le lien, confirmer l'email
5. Se connecter avec les identifiants

✅ **Résultat attendu:** Inscription fonctionnelle, tokens JWT reçus

### Étape 7.2: Tests d'authentification

1. Se déconnecter
2. Vérifier que le cookie `refresh_token` est présent
3. Se reconnecter
4. Vérifier que les 2 apps (web + admin) partagent la session

✅ **Résultat attendu:** Authentification partagée

### Étape 7.3: Tests Admin

1. Aller sur https://nour-play.app/admin
2. Se connecter avec un compte admin
3. Accéder au dashboard

✅ **Résultat attendu:** Admin accessible via `/admin`

### Étape 7.4: Tests de sécurité (rapides)

```powershell
# 1. CORS bien restreint (test depuis domaine non autorisé)
curl.exe -H "Origin: https://malveillant.com" https://nour-play.app/api/v1/health

# 2. Pas de Swagger en production
curl.exe https://nour-play.app/api/v1/docs
# Résultat: 404 (correct!)

# 3. Headers de sécurité présents
curl.exe -I https://nour-play.app
# Vérifier: X-Frame-Options, Strict-Transport-Security, CSP
```

### Étape 7.5: Vérifier les logs & monitoring

- **Vercel Dashboard:**
  - Vérifier les 3 projets sont **Ready**
  - Vérifier **Function Logs** de l'API
  - Vérifier les **Deployments** réussis

- **Neon Console:**
  - Vérifier les connexions actives

- **Upstash Console:**
  - Vérifier l'utilisation Redis (commandes/sec)

- **Railway Dashboard:**
  - Vérifier les logs du worker

✅ **Résultat attendu:** Tous les systèmes fonctionnent

### Étape 7.6: Checklist finale

```
✅ Domaine nour-play.app actif et HTTPS
✅ 3 projets Vercel en production (Ready)
✅ Neon PostgreSQL synchronisé
✅ Upstash Redis actif
✅ Migrations appliquées
✅ 4 cron tasks configurées
✅ Worker Railway déployé
✅ Inscription/connexion fonctionnelle
✅ Admin accessible
✅ Emails envoyés (Resend)
✅ Avatars uploadés (R2)
✅ Logs accessibles
```

---

## 🚨 Troubleshooting Rapide

### Erreur: "Failed to load environment variables"

```powershell
# Solution: Vérifier les variables dans Vercel
vercel env ls
```

### Erreur: "DATABASE_URL_UNPOOLED not found"

```powershell
# Solution: Neon pas encore connectée, aller dans:
# Vercel → nourplay-api → Storage → nourplay-db → Connect Project
```

### Erreur: "CRON_SECRET validation failed"

```powershell
# Solution: Vérifier que CRON_SECRET est:
# 1. Configurée dans nourplay-api (Settings → Environment Variables)
# 2. Identique dans cron-job.org
# 3. Testée: curl -H "Authorization: Bearer <CRON_SECRET>" <url>
```

### Erreur: "Admin base path mismatch"

```powershell
# Solution: Vérifier que ADMIN_BASE_PATH=/admin est configurée
# 1. Dans nourplay-admin
# 2. Redéployer sans cache
```

---

## 🎉 Félicitations!

Vous avez déployé **NourPlay en production sur Vercel** avec:

✅ Architecture scalable (3 projets indépendants)
✅ Routage HTTP dynamique
✅ Base de données PostgreSQL managée (Neon)
✅ Cache Redis managé (Upstash)
✅ Tâches planifiées (cron-job.org)
✅ Worker externe (Railway)
✅ Emails (Resend)
✅ Stockage (Cloudflare R2)
✅ Paiements (Stripe)
✅ Monitoring & Logs

**Prochaines étapes:**

1. Configurer Sentry pour les erreurs
2. Mettre en place des alertes (Vercel + Sentry)
3. Ajouter monitoring Web Vitals (@vercel/analytics)
4. Backup régulier Neon + Upstash
5. Plan de disaster recovery

---

**Questions?** Consulter `docs/VERCEL_CONFIG.md` pour les détails complets.

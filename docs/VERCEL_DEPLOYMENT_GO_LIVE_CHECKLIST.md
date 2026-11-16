# ✅ CHECKLIST GO-LIVE - NourPlay Production

**Date:** 16 novembre 2026
**Version:** 1.0
**État:** Checklist historique à revalider. Consulter [l'audit Pro](./VERCEL_PRO_COMPATIBILITY_AND_DEPLOYMENT.md) pour l'état vérifié et la procédure actuelle.

---

## 📋 PRÉ-DÉPLOIEMENT (Cette semaine)

### Architecture & Code

- [x] Health check controller créé (`/api/v1/health`)
- [x] Health module intégré dans AppModule
- [x] CronController fonctionnel avec 4 endpoints sécurisés
- [x] ScheduleModule correctement désactivé sur Vercel
- [ ] Confirmer que le worker ne tourne sur aucun hôte de production et qu'aucun déploiement ne le relance
- [x] `packages/api/vercel.json` configure la région `fra1` et le seul Cron de publication approuvé
- [x] Cron de publication activé sur Vercel et invocation planifiée vérifiée (HTTP 200)
- [x] Script `pnpm vercel:validate` créé et fonctionnel
- [x] Documentation VERCEL_CONFIG.md complète
- [x] Guide VERCEL_DEPLOYMENT_STEP_BY_STEP.md complet

### Secrets & Sécurité

- [ ] JWT_ACCESS_SECRET généré (32+ chars base64)
- [ ] JWT_REFRESH_SECRET généré (32+ chars base64)
- [ ] COOKIE_SECRET généré (32+ chars base64)
- [ ] CRON_SECRET généré (32+ chars hex) - À ajouter aussi à .env.example
- [ ] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY générés
- [ ] Tous les secrets stockés dans gestionnaire de mots de passe (1Password, Bitwarden)
- [ ] Aucun secret en clair dans Git / .env / captures écran

### Vérification Locale

- [ ] `pnpm install --frozen-lockfile` ✅
- [ ] `pnpm vercel:validate` ✅
- [ ] `pnpm --filter @nourplay/db generate` ✅
- [ ] `pnpm --filter @nourplay/db build` ✅
- [ ] `pnpm --filter @nourplay/api build` ✅
- [ ] `pnpm --filter @nourplay/web build` ✅
- [ ] `pnpm --filter @nourplay/admin build` ✅
- [ ] Tous les builds réussissent localement

### Code Committé

- [ ] `git add` uniquement les fichiers production
- [ ] `git commit -m "feat: Vercel deployment ready"`
- [ ] `git push origin main`
- [ ] Branche `main` à jour sur GitHub

---

## 🏗️ INFRASTRUCTURE VERCEL (Jour 2)

### Domaine

- [ ] Domaine `nour-play.app` acheté
- [ ] Domaine transféré à Vercel Registrar (ou Cloudflare)
- [ ] Nameservers pointent vers Vercel
- [ ] SSL/TLS certificat automatique (Let's Encrypt)
- [ ] Redirection `www.nour-play.app` → `nour-play.app` configurée

### Projets Vercel (3 projets)

#### Projet 1: nourplay (Web)

- [ ] Créé et importé du dépôt GitHub
- [ ] Root Directory: `apps/web`
- [ ] Build Command: `cd ../.. && pnpm --filter @nourplay/web build`
- [ ] Node.js 22.x configuré
- [ ] Production Branch: `main`
- [ ] Domaine: `nour-play.app` assigné ✅

#### Projet 2: nourplay-admin (Admin)

- [ ] Créé et importé du dépôt GitHub
- [ ] Root Directory: `apps/admin`
- [ ] Build Command: `cd ../.. && pnpm --filter @nourplay/admin build`
- [ ] Node.js 22.x configuré
- [ ] Production Branch: `main`
- [ ] **PAS de domaine** (routé via web project)

#### Projet 3: nourplay-api (API)

- [ ] Créé et importé du dépôt GitHub
- [ ] Root Directory: `packages/api`
- [ ] Build Command: `cd ../.. && pnpm --filter @nourplay/db generate && ...`
- [ ] Node.js 22.x configuré
- [ ] **Region:** Frankfurt (`fra1`) ✅
- [ ] Production Branch: `main`
- [ ] **PAS de domaine** (routé via web project)

### Équipe Vercel

- [ ] Les 3 projets dans la même équipe (`bouaziziws-projects`)
- [ ] Domaine assigné à l'équipe (pas à un utilisateur personnel)

---

## 🗄️ BASES DE DONNÉES (Jour 2-3)

### PostgreSQL (Neon)

- [ ] Neon database créée: `nourplay-db`
- [ ] Version: PostgreSQL 16
- [ ] Region: Frankfurt (`eu-central-1`) ✅
- [ ] Connectée au projet `nourplay-api`
- [ ] Environnements: Development, Preview, Production ✅
- [ ] Preview branch enabled (pour Preview deployments)
- [ ] Variables auto-injectées:
  - `DATABASE_URL` (poolée)
  - `DATABASE_URL_UNPOOLED` (directe)

### Redis (Upstash)

- [ ] Upstash Redis créée: `nourplay-redis`
- [ ] Region: EU (Frankfurt)
- [ ] Connectée au projet `nourplay-api`
- [ ] Environnements: Development, Preview, Production ✅
- [ ] **Eviction Policy: `noeviction`** (obligatoire) ✅
- [ ] Variable auto-injectée: `REDIS_URL`

### Migrations Prisma

- [ ] Base de données initialisée
- [ ] Migrations appliquées avec URL directe Neon
- [ ] Schéma à jour
- [ ] Compte admin créé (sans `pnpm db:seed`)

---

## 🔐 VARIABLES D'ENVIRONNEMENT (Jour 3)

### API (nourplay-api) - Production

#### JWT & Cookies

- [ ] `JWT_ACCESS_SECRET`: 32+ chars (base64) 🔒
- [ ] `JWT_REFRESH_SECRET`: 32+ chars (base64) 🔒
- [ ] `COOKIE_SECRET`: 32+ chars (base64) 🔒
- [ ] `JWT_ACCESS_TTL`: `900`
- [ ] `JWT_REFRESH_TTL`: `604800`
- [ ] `BCRYPT_ROUNDS`: `12`

#### Cron & Sécurité

- [ ] `CRON_SECRET`: 32+ chars (hex) 🔒
- [ ] `TOTP_ISSUER`: `NourPlay`
- [ ] `TOTP_APP_NAME`: `NourPlay`

#### URLs App

- [ ] `APP_URL`: `https://nour-play.app`
- [ ] `API_URL`: `https://nour-play.app`
- [ ] `ADMIN_URL`: `https://nour-play.app/admin`
- [ ] `CORS_ORIGINS`: `https://nour-play.app,https://www.nour-play.app`

#### Email (Resend)

- [ ] `EMAIL_PROVIDER`: `resend`
- [ ] `RESEND_API_KEY`: `re_...` 🔒
- [ ] `EMAIL_FROM`: `NourPlay <noreply@nour-play.app>`
- [ ] Domaine vérifié dans Resend (SPF/DKIM/DMARC)

#### Stockage (R2/S3)

- [ ] `S3_ENDPOINT`: Cloudflare R2 URL
- [ ] `S3_ACCESS_KEY_ID`: 🔒
- [ ] `S3_SECRET_ACCESS_KEY`: 🔒
- [ ] `S3_BUCKET`: `nourplay-assets`
- [ ] `S3_PUBLIC_URL`: `https://assets.nourplay.app`
- [ ] Bucket créé et accessible

#### Web Push (VAPID)

- [ ] `VAPID_PUBLIC_KEY`: Publique
- [ ] `VAPID_PRIVATE_KEY`: 🔒
- [ ] `VAPID_SUBJECT`: `mailto:security@nour-play.app`

#### Paiements (Stripe) - Optionnel

- [ ] `STRIPE_SECRET_KEY`: `sk_live_...` 🔒
- [ ] `STRIPE_PUBLISHABLE_KEY`: `pk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET`: `whsec_...` 🔒
- [ ] Webhook URL configurée: `https://nour-play.app/api/v1/subscriptions/webhook`

#### OAuth Google - Optionnel

- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET` 🔒
- [ ] `GOOGLE_CALLBACK_URL`: `https://nour-play.app/api/v1/auth/google/callback`
- [ ] Configuré dans Google Cloud Console

#### Vidéos - Optionnel

- [ ] `YOUTUBE_API_KEY` 🔒
- [ ] `VIMEO_ACCESS_TOKEN` 🔒

### Web (nourplay) - Production

- [ ] `NEXT_PUBLIC_API_URL`: `https://nour-play.app/api/v1`
- [ ] `NEXT_PUBLIC_APP_URL`: `https://nour-play.app`
- [ ] `NEXT_PUBLIC_S3_PUBLIC_URL`: `https://assets.nourplay.app`
- [ ] `API_PROXY_ORIGIN`: `https://nourplay-api.vercel.app` (pas nour-play.app!)
- [ ] `ADMIN_PROXY_ORIGIN`: `https://nourplay-admin.vercel.app` (pas nour-play.app!)

### Admin (nourplay-admin) - Production

- [ ] `NEXT_PUBLIC_API_URL`: `https://nour-play.app/api/v1`
- [ ] `ADMIN_BASE_PATH`: `/admin` (au build et runtime)

### Redéploiement après variables

- [ ] Redéployer les 3 projets sans cache
- [ ] Attendre les 3 builds

---

## ⏰ TÂCHES PLANIFIÉES (Jour 5)

### Option A: Vercel Cron (compte Pro)

- [ ] Vérifier les endpoints, l'idempotence, les effets métier et le coût d'invocations
- [ ] Ajouter les Cron Jobs décrits dans [l'audit Pro](./VERCEL_PRO_COMPATIBILITY_AND_DEPLOYMENT.md) au `packages/api/vercel.json`
- [ ] Vérifier les Cron Jobs dans le Dashboard Vercel après déploiement
- [ ] Vérifier que `CRON_SECRET` est configurée en Production

### Option B: Scheduler externe (cron-job.org)

#### Compte cron-job.org

- [ ] Compte créé et email validé
- [ ] Accès à la console cron-job.org

#### 4 Tâches HTTP

**Tâche 1: Publier playlists**
- [ ] URL: `https://nour-play.app/api/v1/cron/publish-scheduled`
- [ ] Horaire: `* * * * *` (chaque minute)
- [ ] Authorization: `Bearer <CRON_SECRET>`
- [ ] Testée manuellement

**Tâche 2: Digests hebdomadaires**
- [ ] URL: `https://nour-play.app/api/v1/cron/weekly-digest`
- [ ] Horaire: `0 8 * * 1` (lundi 8h UTC)
- [ ] Authorization: `Bearer <CRON_SECRET>`

**Tâche 3: Rappels abonnement**
- [ ] URL: `https://nour-play.app/api/v1/cron/subscription-reminders`
- [ ] Horaire: `0 10 * * *` (quotidien 10h UTC)
- [ ] Authorization: `Bearer <CRON_SECRET>`

**Tâche 4: Nettoyage abonnement**
- [ ] URL: `https://nour-play.app/api/v1/cron/subscription-cleanup`
- [ ] Horaire: `0 2 * * *` (quotidien 2h UTC)
- [ ] Authorization: `Bearer <CRON_SECRET>`

---

## 🤖 WORKER EXTERNE (Jour 6)

### Railway ou Render

- [ ] Projet `nourplay-worker` créé
- [ ] Branche de déploiement: `workers/video-validator`
- [ ] Build & Start commands configurés
- [ ] Node.js 22.x

### Variables d'environnement Worker

- [ ] `REDIS_URL`: Même Upstash que l'API 🔒
- [ ] `OPENAI_API_KEY`: Clé OpenAI 🔒
- [ ] `NODE_ENV`: `production`
- [ ] `DATABASE_URL`: Optionnel (pour logs)

### Vérification

- [ ] Worker en statut "Running"
- [ ] Logs accessibles
- [ ] Aucune erreur de connexion Redis
- [ ] Aucune erreur OpenAI

### Important: Pas sur Vercel

- [ ] Worker **N'EST PAS** sur Vercel ✅
- [ ] OPENAI_API_KEY **N'EST PAS** sur API Vercel ✅
- [ ] OPENAI_API_KEY **SEULEMENT** sur worker ✅

---

## 🧪 TESTS FONCTIONNELS (Jour 7)

### Routes publiques

- [ ] `curl https://nour-play.app` → HTTP 200 (page web)
- [ ] `curl https://nour-play.app/admin/login` → HTTP 200 (admin)
- [ ] `curl https://nour-play.app/api/v1/health` → JSON (santé)
- [ ] `curl https://nour-play.app/api/v1/subscriptions/plans` → JSON (public)

### Routes sécurisées

- [ ] `curl https://nour-play.app/api/v1/cron/publish-scheduled` → HTTP 401 sans secret
- [ ] `curl -H "Authorization: Bearer <CRON_SECRET>" https://nour-play.app/api/v1/cron/publish-scheduled` → HTTP 200

### Inscriptions & Auth

- [ ] Créer un compte avec email valide
- [ ] Vérifier la réception du mail (Resend logs)
- [ ] Cliquer le lien de vérification
- [ ] Se connecter → JWT access token reçu
- [ ] Vérifier le cookie `refresh_token` présent
- [ ] Se déconnecter → cookie supprimé

### Sessions partagées

- [ ] Admin créé avec rôle `ADMIN`
- [ ] Se connecter en web → session OK
- [ ] Aller sur `/admin` → session partagée OK
- [ ] Déconnexion web → aussi déconnecté en admin

### Upload (Avatars)

- [ ] Uploader un avatar utilisateur
- [ ] Vérifier sur R2 bucket
- [ ] Vérifier l'URL publique accédée depuis `NEXT_PUBLIC_S3_PUBLIC_URL`

### Email

- [ ] Inscription → mail de vérification
- [ ] Reset password → mail de reset
- [ ] Vérifier les logs Resend

### Paiements Stripe (si activé)

- [ ] Tester créer un abonnement
- [ ] Webhook reçu sur endpoint
- [ ] Vérifier les statuts de paiement dans la DB

### Admin Dashboard

- [ ] Se connecter avec compte admin
- [ ] Accéder au dashboard
- [ ] Naviguer les sections
- [ ] Vérifier les données

### Performance

- [ ] Lighthouse score web > 85
- [ ] Lighthouse score admin > 85
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3s

---

## 🔒 SÉCURITÉ (Spot checks)

### Headers HTTP

- [ ] `X-Frame-Options: DENY` présent
- [ ] `X-Content-Type-Options: nosniff` présent
- [ ] `Strict-Transport-Security` avec `preload` présent
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` présent
- [ ] CSP headers présents et restrictifs

### CORS

- [ ] CORS bien restreint aux domaines autorisés
- [ ] Test depuis domaine tiers → bloqué
- [ ] Credentials required ✅

### Swagger

- [ ] Swagger API **N'EXISTE PAS** en production ✅
- [ ] `/api/v1/docs` → HTTP 404 (correct)

### Secrets

- [ ] Aucun secret en clair dans `.env.example`
- [ ] Aucun secret dans Git
- [ ] Aucun secret dans les logs
- [ ] Aucun secret dans les captures écran

### Authentification Cron

- [ ] Cron routes sécurisées par Bearer token ✅
- [ ] Sans token → HTTP 401 ✅
- [ ] Avec mauvais token → HTTP 401 ✅
- [ ] Avec bon token → HTTP 200 ✅

---

## 📊 MONITORING & OBSERVABILITÉ (Jour 7+)

### Vercel Dashboard

- [ ] 3 projets visibles et Ready
- [ ] Deployments historiques consultables
- [ ] Function Logs pour l'API accessible
- [ ] Analytics activés (Web Vitals)

### Bases de données

- [ ] Neon Console accessible
  - [ ] Connexions actives < 10
  - [ ] Query performance OK
  - [ ] Storage usage < 1 GB
- [ ] Upstash Console accessible
  - [ ] Commandes/sec < seuil Hobby
  - [ ] Memory usage < 1 GB
  - [ ] Pas de retries/erreurs

### Logs Centralisés (Optionnel mais recommandé)

- [ ] Sentry intégré (optionnel)
- [ ] Datadog/New Relic (optionnel)
- [ ] CloudWatch (optionnel)

### Alertes (Optionnel mais recommandé)

- [ ] Alert API statut (Vercel)
- [ ] Alert erreurs (Sentry)
- [ ] Alert performance (Vercel)
- [ ] Alert Redis (Upstash)
- [ ] Alert DB (Neon)

---

## 📞 SUPPORT & DOCUMENTATION

### Documentation créée

- [x] `docs/VERCEL_CONFIG.md` - Configuration complète ✅
- [x] `docs/VERCEL_DEPLOYMENT_STEP_BY_STEP.md` - Guide jour après jour ✅
- [x] `docs/VERCEL_DEPLOYMENT_GO_LIVE_CHECKLIST.md` - Cette checklist ✅

### Accès et permissions

- [ ] Team Vercel partagée avec l'équipe DevOps
- [ ] Accès Neon partagé
- [ ] Accès Upstash partagé
- [ ] Accès cron-job.org partagé
- [ ] Accès Railway/Render partagé

### Runbooks

- [ ] Restart API: `Vercel Dashboard → nourplay-api → Deployments → Redeploy`
- [ ] Restart Worker: Railway Dashboard → Redeploy
- [ ] Migration DB: Procédure documentée dans `docs/GUIDE_DEPLOIEMENT_PAS_A_PAS.md`
- [ ] Rollback: Vercel supports automatic rollback via Deployments

---

## 🎯 FINAL SIGN-OFF

### Avant Go-Live

- [ ] Tous les ✅ ci-dessus complétés
- [ ] Tous les tests ✅ réussis
- [ ] Team review complétée
- [ ] Backup de la DB pris
- [ ] Disaster recovery plan en place
- [ ] Monitoring & alertes actifs
- [ ] Documentation complète

### Go-Live

- [ ] Heure de déploiement programmée (off-peak si possible)
- [ ] Team notifiée et disponible
- [ ] Monitoring en direct
- [ ] Rollback plan prêt (< 5 min)

### Post-Déploiement (24h)

- [ ] Vérifier que tout tourne 24h
- [ ] Vérifier les crons exécutés
- [ ] Vérifier les emails envoyés
- [ ] Vérifier les uploads fonctionnent
- [ ] Vérifier les paiements (si activé)
- [ ] Vérifier pas d'erreurs critiques

---

**Signé par:** __________________________
**Date:** __________________________
**Timestamp Go-Live:** __________________________

---

**Vous êtes prêts pour la production! 🚀**

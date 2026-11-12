# Sécurité — Documentation détaillée

> Référence complète des mesures de sécurité implémentées dans NourPlay  
> Version : 1.0 — Dernière mise à jour : 20 août 2026

---

## 1. Authentification

### 1.1. Hachage des mots de passe

| Paramètre | Valeur | Justification |
|-----------|--------|---------------|
| **Algorithme** | Argon2id | Winner du Password Hashing Competition, résistant GPU/ASIC |
| **Mémoire** | 64 MB | Memory-hard, coût élevé pour les attaques par force brute |
| **Itérations** | 3 | Bon compromis performance/sécurité |
| **Parallélisme** | 1 | Un thread par hash |
| **Sel** | 16 bytes (auto-généré) | Unique par mot de passe |

Utilisé pour :
- Mots de passe des comptes utilisateurs (`User.passwordHash`)
- PINs des profils enfants (`ChildProfile.pinHash`)

### 1.2. JWT (JSON Web Tokens)

| Token | Algorithme | TTL | Stockage | Contenu |
|-------|-----------|-----|----------|---------|
| **Access Token** | HS256 | 15 min | Header `Authorization: Bearer` | `{ sub: userId, role: UserRole }` |
| **Refresh Token** | Random 64 bytes | 7 jours | Cookie HttpOnly/Secure/SameSite=Lax | Token brut (hashé SHA-256 en base) |

**Rotation des tokens** : chaque appel à `POST /auth/refresh` :
1. Vérifie le hash du refresh token en base
2. Vérifie le fingerprint (hash User-Agent + IP subnet)
3. Révoque l'ancien refresh token
4. Génère un nouveau refresh token + nouveau access token
5. Stocke le hash du nouveau refresh token

**Blacklist** : les access tokens révoqués (logout) sont stockés dans Redis avec un TTL égal à la durée restante du token.

### 1.3. 2FA TOTP

| Paramètre | Valeur |
|-----------|--------|
| **Standard** | RFC 6238 (TOTP) |
| **Algorithme** | SHA-1 (compatibilité Google Authenticator) |
| **Période** | 30 secondes |
| **Chiffrement du secret** | AES-256-GCM au niveau applicatif |
| **Stockage** | `User.twoFactorSecret` (chiffré) |

### 1.4. OAuth Google

| Paramètre | Valeur |
|-----------|--------|
| **Bibliothèque** | Passport.js (`passport-google-oauth20`) |
| **Scopes** | `email`, `profile` |
| **Création de compte** | Automatique si le googleId n'existe pas |
| **Liaison** | Champ `User.googleId` (unique) |

### 1.5. Magic Link

| Paramètre | Valeur |
|-----------|--------|
| **Token** | JWT signé HS256 |
| **TTL** | 15 minutes |
| **Usage unique** | Vérifié et invalidé après utilisation |
| **Canal** | Email via Resend/MailHog |

---

## 2. Autorisation (RBAC)

### 2.1. Hiérarchie des rôles

```
ADMIN (accès total)
  └── MODERATOR (modération + lecture admin)
        └── TEACHER (fonctions utilisateur + partage classe)
              └── PARENT (fonctions de base)
```

### 2.2. Implémentation

**Guard** : `RolesGuard` dans `packages/api/src/common/guards/roles.guard.ts`

```typescript
// Décorateur personnalisé
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('admin/users')
async listUsers() { ... }
```

Le guard extrait les rôles requis via le `Reflector` et vérifie que le rôle de l'utilisateur courant est dans la liste.

### 2.3. Matrice des permissions

| Ressource | PARENT | TEACHER | MODERATOR | ADMIN |
|-----------|--------|---------|-----------|-------|
| Ses playlists (CRUD) | ✅ | ✅ | ✅ | ✅ |
| Ses profils enfants (CRUD) | ✅ | ✅ | ✅ | ✅ |
| Soumettre des vidéos | ✅ | ✅ | ✅ | ✅ |
| Signaler une vidéo | ✅ | ✅ | ✅ | ✅ |
| Gérer ses consentements | ✅ | ✅ | ✅ | ✅ |
| Demande RGPD (export/delete) | ✅ | ✅ | ✅ | ✅ |
| File de modération | ❌ | ❌ | ✅ | ✅ |
| Approuver/rejeter vidéos | ❌ | ❌ | ✅ | ✅ |
| Résoudre signalements | ❌ | ❌ | ✅ | ✅ |
| Lister tous les utilisateurs | ❌ | ❌ | ❌ | ✅ |
| Modifier les rôles | ❌ | ❌ | ❌ | ✅ |
| Journal d'audit | ❌ | ❌ | ❌ | ✅ |
| Gestion des plans | ❌ | ❌ | ❌ | ✅ |
| Documents légaux (CRUD) | ❌ | ❌ | ❌ | ✅ |

### 2.4. Ownership check

Au-delà du RBAC, chaque ressource vérifie la propriété :
- **Playlists** : `playlist.ownerId === currentUser.id` ou `PlaylistAccess` existant
- **Profils enfants** : `childProfile.userId === currentUser.id`
- **Consentements** : filtré par `userId` automatiquement
- **GDPR requests** : filtré par `userId`

---

## 3. Protection du réseau

### 3.1. Rate limiting

| Scope | Limite | Fenêtre | Implémentation |
|-------|--------|---------|---------------|
| **Global** | 100 requêtes | 60 secondes | `ThrottlerGuard` (NestJS, APP_GUARD) |
| **Auth (login)** | 5 requêtes | 60 secondes | Throttle personnalisé |
| **Auth (register)** | 5 requêtes | 60 secondes | Throttle personnalisé |
| **Auth (forgot-password)** | 3 requêtes | 60 secondes | Throttle personnalisé |

Configurable via variables d'environnement `RATE_LIMIT_TTL` et `RATE_LIMIT_MAX`.

### 3.2. CORS

```typescript
app.enableCors({
  origin: corsOrigins,          // CORS_ORIGINS (explicite)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
})
```

En production : `CORS_ORIGINS=https://nourplay.app,https://admin.nourplay.app`

### 3.3. Headers de sécurité (Helmet)

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameSrc: [
        "'self'",
        'https://www.youtube.com',
        'https://player.vimeo.com',
        'https://www.dailymotion.com',
      ],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
}))
```

Headers appliqués :
- `Content-Security-Policy` : CSP restrictive, iframe autorisée uniquement pour YouTube/Vimeo/Dailymotion
- `Strict-Transport-Security` : HSTS 2 ans, preload
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (sauf iframes vidéo)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`

### 3.4. TLS

- **Version** : TLS 1.3 (imposé par le reverse proxy Caddy)
- **Certificats** : Let's Encrypt (auto-renouvelé par Caddy)
- **HSTS preload** : activé

### 3.5. Validation des entrées

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Supprime les propriétés non déclarées
  forbidNonWhitelisted: true,   // Rejette si propriétés inconnues
  transform: true,              // Transformation automatique des types
  transformOptions: { enableImplicitConversion: true },
}))
```

Tous les DTOs utilisent `class-validator` avec des décorateurs typés (`@IsEmail()`, `@MinLength()`, `@IsEnum()`, etc.).

---

## 4. Protection des données

### 4.1. Chiffrement au repos

| Donnée | Méthode | Emplacement |
|--------|---------|-------------|
| Mots de passe | Argon2id (hash irréversible) | PostgreSQL |
| PINs enfants | Argon2id | PostgreSQL |
| Secret 2FA | AES-256-GCM (application-level) | PostgreSQL |
| Refresh tokens | SHA-256 (hash) | PostgreSQL |
| IPs (consentements) | SHA-256 (hash non réversible) | PostgreSQL |
| Base de données | Chiffrement provider (Managed PG) | PostgreSQL |
| Fichiers S3 | Chiffrement at-rest (R2 default) | Cloudflare R2 |

### 4.2. Chiffrement en transit

| Flux | Protocole |
|------|-----------|
| Client → API | HTTPS (TLS 1.3) |
| API → PostgreSQL | TLS (si managed) |
| API → Redis | TLS (si managed, en prod) |
| API → S3/R2 | HTTPS |
| API → Services externes | HTTPS |

### 4.3. Gestion des secrets

| Environnement | Méthode |
|---------------|---------|
| **Local** | Fichier `.env` (gitignored) |
| **CI/CD** | GitHub Secrets |
| **Production** | Gestionnaire de secrets (Vault/Doppler/AWS SM) |

**Règle stricte** : aucun secret n'est jamais committé en clair dans le code source. Le fichier `.env` est dans le `.gitignore`.

---

## 5. Audit et traçabilité

### 5.1. Journal d'audit

- **Table** : `audit_logs` (insert-only)
- **Service** : `AuditService` dans `packages/api/src/common/audit/audit.service.ts`
- **Politique** : aucun UPDATE ni DELETE autorisé au niveau application

```typescript
await this.auditService.log({
  actorId: user.id,
  actorRole: user.role,
  action: 'video.approve',
  resourceType: 'Video',
  resourceId: videoId,
  metadata: { score: 0.92 },
  ip: request.ip,
  userAgent: request.headers['user-agent'],
})
```

### 5.2. Observabilité

| Composant | Outil | Port |
|-----------|-------|------|
| **Logs structurés** | Grafana Loki | :3100 |
| **Traces distribuées** | Grafana Tempo | :4318 (OTLP) |
| **Métriques** | Prometheus | :9090 |
| **Dashboards** | Grafana | :3002 |

L'API émet des traces OpenTelemetry via le SDK `@opentelemetry/sdk-node` configuré dans la variable `OTEL_EXPORTER_OTLP_ENDPOINT`.

---

## 6. Sécurité des dépendances

### 6.1. Audit automatique

| Outil | Scope | Seuil | CI Job |
|-------|-------|-------|--------|
| `pnpm audit` | Dépendances npm | HIGH | `security` |
| Trivy | Filesystem + images Docker | CRITICAL, HIGH | `security` |
| Dependabot | Dépendances GitHub | — | PR automatiques |

### 6.2. Politique de mise à jour

- **Dépendances critiques** (sécurité) : mise à jour immédiate
- **Dépendances majeures** : évaluation et test avant mise à jour
- **Dépendances mineures/patch** : mise à jour automatique via Dependabot

---

## 7. Checklist de sécurité pré-production

- [x] Argon2id pour tous les hachages de mots de passe et PINs
- [x] JWT avec rotation des refresh tokens
- [x] 2FA TOTP avec secret chiffré AES-256
- [x] Rate limiting global + routes sensibles
- [x] CORS restrictif (origins explicites)
- [x] Headers de sécurité (Helmet, CSP, HSTS)
- [x] Validation des entrées (class-validator, whitelist)
- [x] Audit log insert-only
- [x] Scan de vulnérabilités dans le CI (pnpm audit + Trivy)
- [x] Secrets gérés via variables d'environnement (jamais en dur)
- [x] Soft delete RGPD
- [x] IP hashée SHA-256 (non réversible)
- [ ] Chiffrement TLS pour la connexion Redis en production
- [ ] Chiffrement TLS pour la connexion PostgreSQL en production
- [ ] 2FA obligatoire pour les comptes ADMIN
- [ ] Audit de sécurité externe (pentest)
- [ ] Plan de réponse aux incidents
- [ ] Processus de notification de violation de données (72h CNIL)

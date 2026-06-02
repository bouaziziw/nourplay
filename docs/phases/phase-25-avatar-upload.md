# Phase 25 — S3/R2 Avatar Upload

## Objectif

Implémenter le téléversement d'avatars pour les profils enfants via Cloudflare R2 (ou tout S3-compatible). Architecture "direct upload" : le navigateur/l'app mobile envoie directement le fichier vers S3 via une URL pré-signée générée par le backend — NestJS ne voit jamais le contenu du fichier.

## Architecture

```
Browser / Mobile             NestJS API               Cloudflare R2
───────────────────────────────────────────────────────────────────
1. POST /storage/presigned-url
   { folder, contentType, sizeBytes }
                           → validate
                           → S3Client.putObject presigned URL
                           ← { uploadUrl, key, publicUrl }

2. PUT {uploadUrl} + file binary
   ─────────────────────────────────────────────────────────────→ R2

3. PATCH /users/me/profiles/:id
   { avatarKey: "avatars/uuid.webp" }
```

## Ce qui a été fait

### 1. Backend — `StorageModule` (`packages/api/src/modules/storage/`)

**`StorageService`** (`storage.service.ts`)

- `onModuleInit()` — initialise `S3Client` si `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` + `S3_BUCKET` sont configurés (sinon mode dev sans R2)
- `getPresignedUploadUrl(folder, contentType, sizeBytes)` :
  - Valide le type MIME (jpeg / png / webp / gif uniquement)
  - Valide la taille (max 5 MB)
  - Génère une clé `{folder}/{uuid}.{ext}`
  - Retourne `{ uploadUrl, key, publicUrl }`
  - En mode dev (pas de credentials R2) : retourne un placeholder sans erreur
- `getPublicUrl(key)` — construit l'URL publique depuis `S3_PUBLIC_URL`
- `getPresignedDownloadUrl(key, expiresIn)` — URL signée pour objets privés (réservé aux exports RGPD)
- `deleteObject(key)` — suppression (nettoyage lors de remplacement d'avatar)
- `isHealthy()` — HeadBucket pour les health checks

**`StorageController`** (`storage.controller.ts`)

```
POST /api/v1/storage/presigned-url   (auth requis)
Body: { folder: "avatars"|"thumbnails", contentType: string, sizeBytes: number }
→ { uploadUrl: string, key: string, publicUrl: string }
```

### 2. Backend — `UpdateProfileDto` étendu

Ajout de `avatarKey?: string | null` dans `update-profile.dto.ts`.
Le service `user.service.ts` propage la valeur via `'avatarKey' in dto && { avatarKey: dto.avatarKey }`.

### 3. Variables d'environnement (`.env`)

Ajout des variables publiques pour les clients :
```
NEXT_PUBLIC_S3_PUBLIC_URL=https://assets.nourplay.app
EXPO_PUBLIC_S3_PUBLIC_URL=https://assets.nourplay.app
```

Ces variables dupliquent `S3_PUBLIC_URL` pour être accessibles côté client.

### 4. Web — Client API (`apps/web/src/lib/api.ts`)

Ajout de `api.storage.getPresignedUploadUrl(token, { folder, contentType, sizeBytes })`.
Ajout de `avatarKey?: string | null` dans l'appel `updateProfile`.

### 5. Web — UI de téléversement (`apps/web/src/app/[locale]/(dashboard)/profiles/[id]/page.tsx`)

**Nouveaux états** : `avatarUploading`, `avatarError`, `avatarPreview`

**`handleAvatarUpload`** :
1. Obtient l'URL pré-signée
2. `fetch(uploadUrl, { method: 'PUT', body: file })`
3. PATCH `avatarKey` sur le profil
4. Met à jour l'état local + prévisualisation

**UI** :
- Cercle 64×64 px avec avatar ou initiales en fallback
- Bouton-label (cachant un `<input type="file">`) — déclenche le sélecteur de fichier
- Accept: `image/jpeg,image/png,image/webp`
- Messages d'erreur inline + état "Téléversement…"

**Header** : remplacé les initiales par l'image si `avatarKey` présent.

### 6. Web — Dashboard (`apps/web/src/app/[locale]/(dashboard)/page.tsx`)

Affiche l'avatar dans les cartes profil si `avatarKey` disponible.

### 7. Mobile — `ProfileSelectorScreen`

Affiche l'avatar via `<Image>` si `avatarKey` présent et `EXPO_PUBLIC_S3_PUBLIC_URL` configuré, sinon fallback initiales colorées.

## Configuration Cloudflare R2

1. Créer un bucket `nourplay-assets` dans Cloudflare R2
2. Activer l'accès public custom domain → `assets.nourplay.app`
3. Créer des credentials R2 (Access Key ID + Secret) avec permission `Object Read & Write`
4. Remplir dans `.env` :
   ```
   S3_ENDPOINT=https://{ACCOUNT_ID}.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=xxx
   S3_SECRET_ACCESS_KEY=xxx
   S3_BUCKET=nourplay-assets
   S3_PUBLIC_URL=https://assets.nourplay.app
   NEXT_PUBLIC_S3_PUBLIC_URL=https://assets.nourplay.app
   EXPO_PUBLIC_S3_PUBLIC_URL=https://assets.nourplay.app
   ```
5. Ajouter une règle CORS sur le bucket R2 autorisant `PUT` depuis `https://app.nourplay.app`

## Tests

- `pnpm exec tsc --noEmit` → 0 erreurs dans `@nourplay/api` (les erreurs `Link`/`bigint` du web sont pré-existantes depuis la phase 14 et liées à un conflit entre `@types/react@19` et les types Next.js — non introduites par cette phase)
- En développement sans credentials R2 : le service retourne un URL placeholder sans erreur — l'UI peut être testée localement

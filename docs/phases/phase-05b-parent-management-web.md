# Phase 05B — Parent Management UI (Web)

## Scope

Complete parent-facing management screens: child profile CRUD with parental controls, playlist builder with video search and drag-reorder, video submission, browsable video library, and a proper dashboard navigation bar.

## New / Updated Files

### API Client (`apps/web/src/lib/api.ts`)
Extended with:
- `api.users.createProfile` / `updateProfile` / `deleteProfile` / `getWatchHistory`
- `api.playlists.create` / `update` / `delete` / `addVideo` / `removeVideo` / `reorderVideos`
- `api.videos.search` / `getById` / `submit`
- Added `VideoSearchResult` type interface

### Dashboard Layout (`(dashboard)/layout.tsx`)
Replaced static header with `DashboardNav` client component:
- Sticky top nav with active-link highlighting
- Links: Accueil, Playlists, Vidéothèque
- "Mode enfant" shortcut button
- Displays logged-in user email

### Profile Management
- `profiles/new/page.tsx` — Create form: displayName, 5-option age group selector, PIN + confirm, dailyLimitMin, sessionLimitMin
- `profiles/[id]/page.tsx` — Edit/view with two tabs:
  - *Paramètres*: displayName, age group, limits, per-day viewing schedule (free-text `HH:MM-HH:MM` slots)
  - *Historique*: watch history with thumbnail, title, date, duration, completion indicator
  - Soft-delete with confirmation prompt

### Playlist Management
- `playlists/new/page.tsx` — Create form: name, description, visibility (radio with description), age targets (multi-select), languages; navigates straight to edit page on success
- `playlists/[id]/edit/page.tsx` — Two-column builder:
  - Left: metadata form + ordered video list with up/down reorder buttons and remove button
  - Right: search panel (q + language filter) with add/already-added state per result; link to video submission
  - Optimistic reorder (reverts on error)

### Video Library
- `videos/page.tsx` — Searchable grid: q, language, age-rating filter, paginated 24/page with prev/next; initial load on mount
- `videos/new/page.tsx` — Submit form: URL (YouTube/Vimeo), age-rating selector, language; success state with "submit another" / "back to dashboard" options; amber warning about validation pipeline

### Child Route Fix
- `(child)/playlists/page.tsx` — Missing list page added: shows all accessible playlists as large cards navigating to playlist detail

## Architecture Decisions

### Reorder strategy
Optimistic UI: positions are swapped locally before the PATCH fires. If the API call fails, `load()` re-fetches to restore server state. No drag-and-drop library needed — up/down arrow buttons are simpler on mobile.

### Viewing schedule format
Free-text input per day (`08:00-12:00, 14:00-18:00`). Parsed on save to `{ mon: ["08:00-12:00"] }` JSON. No calendar widget — keeps the form compact and avoids a heavy dependency.

### Video add state
When searching, each result card shows "✓ Ajoutée" (disabled) if the video is already in the playlist by ID set lookup. This prevents duplicates without an extra API call.

### Navigation
`DashboardNav` uses `usePathname` + `startsWith` for active-link detection. Wrapped inside `AuthProvider` so it can access `useAuth()`.

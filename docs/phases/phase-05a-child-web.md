# Phase 05A — Child Experience + Video Player (Web)

## Scope

Child-facing web experience: profile selector with PIN verification, schedule/session enforcement, playlist browsing, and privacy-safe embedded video playback. Parent dashboard updated with inline child-mode entry.

## New Files

### Hooks & Utilities
- `apps/web/src/hooks/useChildSession.ts` — sessionStorage-backed child session (SSR-safe, `hydrated` flag)
  - `isWithinSchedule(schedule)` — checks current day+time against viewing slots
  - `sessionElapsedMin(activatedAt)` — minutes since session start
  - `isSessionExpired()` — compares elapsed to `sessionLimitMin`

### Components
- `apps/web/src/components/PinModal.tsx` — PIN entry modal (numeric, max 6 digits, Escape/backdrop close, error state)
- `apps/web/src/components/VideoPlayer.tsx` — privacy-safe iframe embed
  - `buildSafeEmbedUrl()` normalizes YouTube / Vimeo / Dailymotion URLs, strips tracking params
  - Minimal `allow` policy, `sandbox`, `referrerPolicy: "strict-origin"`
  - `onWatched(durationSec, completed)` fires on unmount

### Child Route Group `(child)/`
- `layout.tsx` — `ChildGuard` wraps all child routes: redirects to `/child` if no session, shows blocking screen if outside schedule or session expired. Sticky header with avatar, remaining time, Quitter button.
- `page.tsx` — Profile selector "Qui regarde ?" — PIN flow → `useChildSession.set()` → `/child/playlists`
- `playlists/page.tsx` — Grid of playlists with video count badges
- `playlists/[id]/page.tsx` — Playlist detail: video cards with position badges, big play overlay
- `watch/[videoId]/page.tsx` — Video player page: fetches playlist for embed URL, renders `VideoPlayer`, posts watch event on unmount, "Up next" card

### Dashboard Update
- `(dashboard)/page.tsx` — Profile cards now open `PinModal` on click → navigate to child mode. Edit icon visible on hover for profile management.

### i18n
- `child.*` keys added to `fr.json`, `en.json`, `ar.json`, `es.json`

## Architecture Decisions

### Child session storage
`sessionStorage` (not `localStorage`) — auto-clears on tab/browser close, preventing a child from resuming a session after a parent closes the browser. Hydrated asynchronously in `useEffect` to avoid SSR mismatch.

### Schedule enforcement
Client-side check from session data. Server-side `viewingSchedule` JSON is stored at PIN time and evaluated against `new Date()` on every route render. The blocking screen replaces all children — the video route is never reached.

### PIN verification
PIN is verified server-side via `POST /users/me/profiles/:profileId/pin/verify` (Argon2id comparison). The child session is only written after a successful server response.

### Video privacy
`buildSafeEmbedUrl` enforces platform-specific privacy params:
- YouTube: `rel=0&modestbranding=1&enablejsapi=0` (no recommendations, no API bridge)
- Vimeo: `dnt=1&byline=0&title=0&portrait=0`
- Dailymotion: `sharing-enable=false&ui-logo=false`

iframe sandbox: `allow-scripts allow-same-origin allow-presentation allow-fullscreen` — no forms, no top navigation, no popups.

## TypeScript Fixes
- Renamed `useAuth.ts` → `useAuth.tsx` (file contained JSX but had wrong extension)
- Added `"DOM", "DOM.Iterable"` to `apps/web/tsconfig.json` lib array (base config only had `ES2022`)

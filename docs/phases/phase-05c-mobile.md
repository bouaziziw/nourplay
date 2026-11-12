# Phase 05C — Mobile App (React Native / Expo)

## Scope

Expo managed-workflow app (`apps/mobile`) targeting iOS and Android. Focus: child-facing experience (profile selector, playlist browsing, video playback with schedule/session enforcement) plus a parent overview dashboard.

## Tech Stack

| Concern | Library |
|---|---|
| Framework | Expo SDK ~53 (React Native 0.79) |
| Navigation | React Navigation v7 (native-stack) |
| Video | `react-native-webview` — same embed-URL sanitisation as web |
| Auth token | `expo-secure-store` — OS keychain (encrypted) |
| Child session | `@react-native-async-storage/async-storage` — persists across app background |
| Safe areas | `react-native-safe-area-context` |

## File Map

```
apps/mobile/
├── App.tsx                          Root component — providers + NavigationContainer
├── app.json                         Expo config (iOS bundle ID, Android package, splash)
├── babel.config.js
├── package.json
├── tsconfig.json
└── src/
    ├── api.ts                       Typed API client (mirrors web api.ts, no httpOnly cookies)
    ├── hooks/
    │   ├── useAuth.ts               AuthContext + useAuthState (SecureStore-backed JWT)
    │   └── useChildSession.ts       ChildSessionContext + useChildSessionState (AsyncStorage)
    ├── navigation/
    │   └── AppNavigator.tsx         Stack: Auth | ProfileSelector | Child | ParentDashboard
    ├── components/
    │   ├── PinModal.tsx             Numeric PIN entry modal (4–6 digits)
    │   └── VideoPlayer.tsx          WebView embed wrapper (buildSafeEmbedUrl)
    └── screens/
        ├── LoginScreen.tsx          Email + password login, branches to TwoFactor
        ├── TwoFactorScreen.tsx      TOTP code entry
        ├── child/
        │   ├── ProfileSelectorScreen.tsx   "Qui regarde ?" grid + PIN flow
        │   ├── PlaylistsScreen.tsx         Playlists list + session/schedule enforcement
        │   ├── PlaylistDetailScreen.tsx    2-column video grid with play overlay
        │   └── WatchScreen.tsx             VideoPlayer + "Up next" card + recordWatch on unmount
        └── parent/
            └── DashboardScreen.tsx         Profile grid (tap → PIN → child mode) + playlist list
```

## Navigation Logic

```
AppNavigator decides stack based on context:
  auth.token == null  →  Auth stack (Login → TwoFactor)
  token && session    →  Child stack (Playlists → PlaylistDetail → Watch)
  token && !session   →  Profile selector → ParentDashboard
```
Switching between child/parent stacks is instant — no unmount/remount cost because React Navigation maintains a single stack tree and the condition drives which screens are in scope.

## Architecture Decisions

### Token storage
`expo-secure-store` writes to iOS Keychain / Android Keystore — survives app restarts, encrypted at rest. Cleared on logout.

### Child session vs web
Web uses `sessionStorage` (auto-cleared on tab close). Mobile uses `AsyncStorage` (survives background). The child can return to an in-progress session if they background the app — intentional for mobile UX. Session expiry is still checked on every `PlaylistsScreen` mount and on a 60-second interval.

### API client differences from web
- No `credentials: 'include'` — httpOnly refresh cookies don't work in React Native's fetch
- No automatic token refresh on 401 — parent must re-login (acceptable for MVP; can add interceptor later)
- `EXPO_PUBLIC_API_URL` env var instead of `NEXT_PUBLIC_API_URL`

### Video embed
`react-native-webview` renders the same sanitised embed URLs built by `buildSafeEmbedUrl`. `mediaPlaybackRequiresUserAction: false` enables autoplay on iOS. `thirdPartyCookiesEnabled: false` and `domStorageEnabled: false` preserve privacy posture.

### Schedule enforcement
`isWithinSchedule` and `isSessionExpired` run on `PlaylistsScreen` mount and via a `setInterval` every 60 seconds — matching web's layout-level guard. Violations show an `Alert` and clear the session, returning to the profile selector.

## Running the App

```bash
cd apps/mobile
npx expo start          # Expo Go on device or simulator
npx expo start --ios    # iOS simulator
npx expo start --android
```

Set `EXPO_PUBLIC_API_URL` in a `.env` file or `app.json` extra config pointing to your API server.

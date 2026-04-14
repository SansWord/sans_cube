# Analytics Implementation Design

## Goal

Integrate Firebase Analytics to track how users discover and interact with sans_cube, starting with traffic driven by the v1.10 LinkedIn post.

## Architecture

Three pieces:

1. **`src/services/firebase.ts`** — initialize Analytics alongside the existing app, auth, and Firestore.
2. **`src/services/analytics.ts`** (new) — typed wrapper around `logEvent` and `setUserId`. All event calls go through this module so call sites stay clean and event names stay consistent.
3. **`src/components/AnalyticsBanner.tsx`** (new) — one-time dismissable bottom bar. Dismissed state persists in `localStorage` under `sans_cube_analytics_acknowledged`.

## Firebase Setup

- Enable Analytics in the Firebase Console for the existing project.
- Add `measurementId` to the Firebase config (already present in the Console — it looks like `G-XXXXXXXXXX`).
- Add `VITE_FIREBASE_MEASUREMENT_ID` to `.env.local` and to the GitHub Actions secrets (alongside the existing Firebase env vars) so the GitHub Pages build picks it up.
- `firebase.ts` change:

```ts
import { getAnalytics } from 'firebase/analytics'

export const analytics = getAnalytics(app)
```

## User Identity

Since Google sign-in is already integrated, set the Firebase Analytics user ID when auth state changes:

- **Sign-in:** `setUserId(analytics, user.uid)` — links events across devices for the same user.
- **Sign-out:** `setUserId(analytics, null)` — clears the identity.

Wired in `useCloudSync` where `onAuthStateChanged` is already handled.

## Events

| Event name | Fired from | Notes |
|---|---|---|
| `page_view` | automatic | Firebase fires this by default |
| `shared_solve_viewed` | `TimerScreen` boot effect | When URL contains `#shared-xxx`; passes `share_id` param |
| `solve_shared` | `SolveDetailModal` | After share succeeds; passes `method` param |
| `solve_recorded` | `useSolveRecorder` | On solve complete; passes `method` param |
| `cube_connected` | `useCubeDriver` | On Bluetooth connect |
| `cube_first_move` | `useSolveRecorder` | First cube move per page load; guarded by a `useRef` session flag; passes `driver` param (`"ble"`, `"mouse"`, `"button"`) |
| `cloud_sync_enabled` | `TimerScreen` | When user toggles cloud sync on |

### `analytics.ts` API

```ts
export function logSharedSolveViewed(shareId: string): void
export function logSolveShared(method: string): void
export function logSolveRecorded(method: string): void
export function logCubeConnected(): void
export function logCubeFirstMove(driver: 'ble' | 'mouse' | 'button'): void
export function logCloudSyncEnabled(): void
export function setAnalyticsUser(uid: string | null): void
```

Each function calls `logEvent(analytics, eventName, params?)` internally. No error handling needed — Firebase Analytics is fire-and-forget.

## Consent Banner

A fixed bottom bar shown on first visit:

- **Text:** "This site uses analytics to improve the experience."
- **Action:** Single dismiss button ("Got it") — stores `sans_cube_analytics_acknowledged = true` in `localStorage`.
- **Behavior:** Not shown again after dismissal. Does not block app use.
- **Placement:** Rendered in `App.tsx`, outside all other layout.
- **Style:** Matches app theme (dark background `#0a0a1a`, muted text `#888`, border-top `#222`).

## localStorage Key

Add to `docs/storage.md`:

| Key | Value | Notes |
|---|---|---|
| `sans_cube_analytics_acknowledged` | `"true"` | Set when user dismisses the analytics banner |

## What is NOT tracked

- Individual move sequences or scrambles (user privacy)
- Solve times (not useful for analytics)
- Any PII beyond Firebase UID (already anonymized by Firebase)

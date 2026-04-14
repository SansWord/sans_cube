# Analytics

sans_cube uses Firebase Analytics (GA4) to track how users discover and interact with the app.

## Events

| Event | Fired from | Parameters |
|---|---|---|
| `page_view` | automatic (Firebase) | — |
| `shared_solve_viewed` | `TimerScreen` boot effect | `share_id: string` |
| `solve_shared` | `SolveDetailModal` after share succeeds | `method: string` |
| `solve_recorded` | `TimerScreen` on solve complete | `method: string` |
| `cube_connected` | `App` on BLE connection | — |
| `cube_first_move` | `App` on first move per page load | `driver: 'ble' \| 'mouse' \| 'touch'` |
| `cloud_sync_enabled` | `useCloudSync` on enable | — |

`cube_first_move` fires at most once per page load. `driver` is `'ble'` for a GAN cube, `'touch'` for mouse driver on a touch device, `'mouse'` otherwise.

## User Identity

`setUserId` is called in `useCloudSync` when auth state changes:
- **Sign-in:** sets the Firebase UID — links events across devices for the same user
- **Sign-out:** clears the user ID

## Consent Banner

A one-time dismissable banner appears at the bottom of the screen on first visit:
> "This site uses analytics to improve the experience."

Dismissed state is stored in `localStorage` under `sans_cube_analytics_acknowledged`. Once dismissed, the banner never shows again.

## Implementation

- **`src/services/firebase.ts`** — `analytics` is exported as `Analytics | null`. It is `null` when `VITE_FIREBASE_MEASUREMENT_ID` is not set (local dev without `.env.local`).
- **`src/services/analytics.ts`** — typed wrappers around `logEvent`. Every function guards against `null` analytics and is a no-op when analytics is disabled.
- **`src/components/AnalyticsBanner.tsx`** — consent banner component, rendered in `App.tsx`.

## Local Development

Analytics is disabled locally unless `VITE_FIREBASE_MEASUREMENT_ID` is set in `.env.local`. Events will silently no-op.

To test events locally, install the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger) Chrome extension, enable it, then open Firebase Console → Analytics → DebugView.

## Viewing Data

- **DebugView** (Firebase Console → Analytics → DebugView) — real-time events, useful for testing
- **Events page** — per-event parameter breakdowns; 24–48 hour reporting delay
- **Dashboard** — aggregated stats, near real-time

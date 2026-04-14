# Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Firebase Analytics to track page views and key user interactions, with a one-time consent banner.

**Architecture:** Firebase Analytics is initialized alongside the existing Firebase app. A thin `analytics.ts` service wraps all `logEvent` calls with typed functions. Events are wired at their natural call sites: `App.tsx` for cube-level events, `TimerScreen` for solve and shared-solve events, `SolveDetailModal` for sharing, and `useCloudSync` for auth identity and cloud sync toggle.

**Tech Stack:** Firebase Analytics (`firebase/analytics`), React, TypeScript, Vite env vars, GitHub Actions secrets.

---

## File Map

| File | Change |
|---|---|
| `src/services/firebase.ts` | Add `measurementId` to config; export `analytics` |
| `src/services/analytics.ts` | **New** — typed wrapper around `logEvent` and `setUserId` |
| `src/utils/storageKeys.ts` | Add `ANALYTICS_ACKNOWLEDGED` key |
| `src/components/AnalyticsBanner.tsx` | **New** — one-time dismiss consent banner |
| `src/App.tsx` | Render banner; wire `cube_connected` and `cube_first_move` |
| `src/hooks/useCloudSync.ts` | Wire `setAnalyticsUser` on auth change; `logCloudSyncEnabled` on enable |
| `src/components/TimerScreen.tsx` | Wire `shared_solve_viewed` and `solve_recorded` |
| `src/components/SolveDetailModal.tsx` | Wire `solve_shared` |
| `.github/workflows/deploy.yml` | Add `VITE_FIREBASE_MEASUREMENT_ID` to build env |
| `docs/storage.md` | Document new localStorage key |

---

### Task 1: Initialize Firebase Analytics

**Files:**
- Modify: `src/services/firebase.ts`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add `measurementId` to `.env.local`**

Open `.env.local` and add one line. Get the value from Firebase Console → Project Settings → General → Your apps → Web app → `measurementId` (looks like `G-XXXXXXXXXX`):

```
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

- [ ] **Step 2: Add secret to GitHub Actions**

Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret.
Name: `VITE_FIREBASE_MEASUREMENT_ID`, Value: same `G-XXXXXXXXXX` value.

- [ ] **Step 3: Add `measurementId` to Firebase config and export analytics**

Replace the full content of `src/services/firebase.ts`:

```ts
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
export const analytics = getAnalytics(app)
```

- [ ] **Step 4: Update `deploy.yml` to pass the new secret**

In `.github/workflows/deploy.yml`, add one line to the `env:` block under `npm run build`:

```yaml
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
```

The full `env:` block becomes:

```yaml
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/services/firebase.ts .github/workflows/deploy.yml
git commit -m "feat: initialize Firebase Analytics"
```

---

### Task 2: Create `analytics.ts` service

**Files:**
- Create: `src/services/analytics.ts`

- [ ] **Step 1: Create the file**

```ts
import { logEvent, setUserId as firebaseSetUserId } from 'firebase/analytics'
import { analytics } from './firebase'

export function logSharedSolveViewed(shareId: string): void {
  logEvent(analytics, 'shared_solve_viewed', { share_id: shareId })
}

export function logSolveShared(method: string): void {
  logEvent(analytics, 'solve_shared', { method })
}

export function logSolveRecorded(method: string): void {
  logEvent(analytics, 'solve_recorded', { method })
}

export function logCubeConnected(): void {
  logEvent(analytics, 'cube_connected')
}

export function logCubeFirstMove(driver: 'ble' | 'mouse' | 'touch'): void {
  logEvent(analytics, 'cube_first_move', { driver })
}

export function logCloudSyncEnabled(): void {
  logEvent(analytics, 'cloud_sync_enabled')
}

export function setAnalyticsUser(uid: string | null): void {
  firebaseSetUserId(analytics, uid)
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/analytics.ts
git commit -m "feat: add analytics.ts typed event wrappers"
```

---

### Task 3: Add storage key and update docs

**Files:**
- Modify: `src/utils/storageKeys.ts`
- Modify: `docs/storage.md`

- [ ] **Step 1: Add key to `storageKeys.ts`**

```ts
export const STORAGE_KEYS = {
  SOLVES: 'sans_cube_solves',
  NEXT_ID: 'sans_cube_next_id',
  DISMISSED_EXAMPLES: 'sans_cube_dismissed_examples',
  ORIENTATION_CONFIG: 'cubeOrientationConfig',
  SIDEBAR_WIDTH: 'sidebarWidth',
  METHOD: 'sans_cube_method',
  CLOUD_SYNC_ENABLED: 'sans_cube_cloud_sync_enabled',
  ANALYTICS_ACKNOWLEDGED: 'sans_cube_analytics_acknowledged',
} as const
```

- [ ] **Step 2: Add entry to `docs/storage.md`**

In the localStorage table, add a new row after `sans_cube_cloud_sync_enabled`:

```
| `sans_cube_analytics_acknowledged` | `"true"` | Set when user dismisses the analytics consent banner |
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/storageKeys.ts docs/storage.md
git commit -m "feat: add analytics_acknowledged storage key"
```

---

### Task 4: Create `AnalyticsBanner` component

**Files:**
- Create: `src/components/AnalyticsBanner.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { STORAGE_KEYS } from '../utils/storageKeys'

export function AnalyticsBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.ANALYTICS_ACKNOWLEDGED) === 'true'
  )

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEYS.ANALYTICS_ACKNOWLEDGED, 'true')
    setDismissed(true)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#0a0a1a',
      borderTop: '1px solid #222',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      zIndex: 200,
      fontSize: 12,
      color: '#888',
    }}>
      <span>This site uses analytics to improve the experience.</span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: '1px solid #333',
          color: '#888',
          fontSize: 11,
          padding: '2px 10px',
          borderRadius: 3,
          cursor: 'pointer',
          flexShrink: 0,
          marginLeft: 16,
        }}
      >
        Got it
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Render in `App.tsx`**

Add the import at the top of `src/App.tsx`:

```ts
import { AnalyticsBanner } from './components/AnalyticsBanner'
```

In the JSX return of `App`, add `<AnalyticsBanner />` as the last element before the closing tag. Find the closing `</div>` or `</>` of the root return and insert it just before:

```tsx
      <AnalyticsBanner />
    </>
  )
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`, open Chrome. The banner should appear at the bottom. Click "Got it" — it should disappear and not return on reload.

- [ ] **Step 4: Commit**

```bash
git add src/components/AnalyticsBanner.tsx src/App.tsx
git commit -m "feat: add analytics consent banner"
```

---

### Task 5: Wire user identity and cloud sync event in `useCloudSync`

**Files:**
- Modify: `src/hooks/useCloudSync.ts`

- [ ] **Step 1: Add imports**

At the top of `src/hooks/useCloudSync.ts`, add:

```ts
import { setAnalyticsUser, logCloudSyncEnabled } from '../services/analytics'
```

- [ ] **Step 2: Wire `setAnalyticsUser` in `onAuthStateChanged`**

Replace the existing `onAuthStateChanged` callback:

```ts
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
      setAnalyticsUser(u ? u.uid : null)
    })
    return unsub
  }, [])
```

- [ ] **Step 3: Wire `logCloudSyncEnabled` in the `enable` callback**

Replace the existing `enable` callback:

```ts
  const enable = useCallback(() => {
    setEnabled(true)
    saveToStorage(STORAGE_KEYS.CLOUD_SYNC_ENABLED, true)
    logCloudSyncEnabled()
  }, [])
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCloudSync.ts
git commit -m "feat: wire setAnalyticsUser and logCloudSyncEnabled"
```

---

### Task 6: Wire `cube_connected` and `cube_first_move` in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import**

Add to the imports at the top of `src/App.tsx`:

```ts
import { logCubeConnected, logCubeFirstMove } from './services/analytics'
```

- [ ] **Step 2: Wire `cube_connected`**

Add this `useEffect` in `App` after the existing `cloudSync` and driver setup lines (around line 40, after `const cloudSync = useCloudSync()`):

```ts
  const prevStatusRef = useRef<string>('')
  useEffect(() => {
    if (status === 'connected' && prevStatusRef.current !== 'connected') {
      logCubeConnected()
    }
    prevStatusRef.current = status
  }, [status])
```

- [ ] **Step 3: Wire `cube_first_move`**

Add this `useEffect` immediately after the one above. It fires once per page load on the first move from any driver:

```ts
  const hasFiredFirstMoveRef = useRef(false)
  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = () => {
      if (hasFiredFirstMoveRef.current) return
      hasFiredFirstMoveRef.current = true
      const isTouch = window.matchMedia('(pointer: coarse)').matches
      const driverParam = driverType === 'cube' ? 'ble' : isTouch ? 'touch' : 'mouse'
      logCubeFirstMove(driverParam)
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, driverVersion, driverType])
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire cube_connected and cube_first_move analytics events"
```

---

### Task 7: Wire `shared_solve_viewed` and `solve_recorded` in `TimerScreen`

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Add import**

Add to the imports at the top of `src/components/TimerScreen.tsx`:

```ts
import { logSharedSolveViewed, logSolveRecorded } from '../services/analytics'
```

- [ ] **Step 2: Wire `shared_solve_viewed`**

In the boot effect that resolves `#shared-` hashes (starts at line ~108), add `logSharedSolveViewed(shareId)` after `setSharedSolveLoading(true)`:

```ts
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#shared-')) return
    const shareId = hash.replace('#shared-', '')
    if (!SHARE_ID_RE.test(shareId)) return

    setSharedSolveLoading(true)
    logSharedSolveViewed(shareId)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    void Promise.race([loadSharedSolve(shareId), timeout]).then((solve) => {
      // ... rest unchanged
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Wire `solve_recorded`**

Find the block that fires when `status === 'solved'` (around line 231). Add `logSolveRecorded(method.id)` after `addSolve(...)`:

```ts
  if (status === 'solved' && prevStatusRef.current !== 'solved') {
    const { id, seq } = nextSolveIds()
    addSolve({
      id,
      seq,
      scramble: scramble ?? '',
      timeMs: elapsedMs,
      moves: recordedMoves,
      phases: phaseRecords,
      quaternionSnapshots,
      date: Date.now(),
      driver: driverType,
      method: method.id,
    })
    logSolveRecorded(method.id)
    // Generate next scramble after short delay
    setTimeout(() => {
      regenerate()
      setArmed(false)
      resetTimer()
    }, 1000)
  }
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: wire shared_solve_viewed and solve_recorded analytics events"
```

---

### Task 8: Wire `solve_shared` in `SolveDetailModal`

**Files:**
- Modify: `src/components/SolveDetailModal.tsx`

- [ ] **Step 1: Add import**

Add to the imports at the top of `src/components/SolveDetailModal.tsx`:

```ts
import { logSolveShared } from '../services/analytics'
```

- [ ] **Step 2: Wire `solve_shared`**

In `handleShare`, after `shareId` is successfully obtained from `onShare`, add `logSolveShared(localSolve.method ?? 'cfop')`. The relevant block:

```ts
    let shareId: string | undefined
    try {
      shareId = await onShare(localSolve)
      logSolveShared(localSolve.method ?? 'cfop')
    } catch (e) {
      console.error('[share] onShare failed:', e)
      setShareState('idle')
      return
    }
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SolveDetailModal.tsx
git commit -m "feat: wire solve_shared analytics event"
```

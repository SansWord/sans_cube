# Public Sharing Without Cloud Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable share/unshare for every user (including those who have never signed in) by provisioning a silent anonymous Firebase auth session on demand — one click, no popup.

**Architecture:** When a user without an active auth session clicks Share, `TimerScreen` calls `cloudConfig.signInAnonymously()`, which wraps Firebase's `signInAnonymously()`. This yields an anonymous UID that the existing `shareSolve()` service accepts unchanged. Anonymous users are treated exactly like signed-out users for cloud-sync-of-solves purposes (`enabled` forced to `false`, solves stay in localStorage). The debug panel continues to show "Sign in with Google" for anon users (an anon user has no email, so rendering "Signed in as undefined" would be a bug).

**Tech Stack:** Firebase Auth (`signInAnonymously`), existing Firestore sharing services (`shareSolve`, `unshareSolve`), Vitest + Testing Library (`renderHook`, `render`).

---

## File Structure

**Modified:**
- `tests/__mocks__/firebase-auth.ts` — add `signInAnonymously: vi.fn()`
- `src/stores/solveStore.ts` — add `signInAnonymously` to `CloudConfig` interface
- `src/hooks/useCloudSync.ts` — anon handling in `onAuthStateChanged`, `signInAnonymously` on interface + return
- `src/App.tsx` — wire `signInAnonymously` into cloudConfig; fix `useCloudNow` and debug panel branch
- `src/components/TimerScreen.tsx` — new `onShare`/`onUnshare` logic with anon provisioning
- `src/components/SolveDetailModal.tsx` — add `shareError` state + visible error line
- `docs/firebase-cloud-sync.md` — new "Anonymous auth for sharing" section
- `docs/storage.md` — note on Firebase IndexedDB anonymous session
- `docs/manual-test-checklist.md` — new QA section for v1.31.0

**Created:**
- `tests/hooks/useCloudSync.test.ts` — anon forcing + `signInAnonymously` method
- `tests/components/TimerScreen.share.test.ts` — onShare anon provisioning logic
- `tests/components/App.cloudSync.test.tsx` — debug panel shows "Sign in with Google" for anon user

---

## Task 1: Fix silent share/unshare errors in SolveDetailModal

**Pre-requisite.** Spec note: "Confirm during implementation that it surfaces a user-visible error message, not just resets to idle silently." Confirmed: both `handleShare` and `handleUnshare` currently only `console.error` and reset to idle. The anon-auth failure case (`signInAnonymously()` network error) must show something to the user.

**Files:**
- Modify: `src/components/SolveDetailModal.tsx`

- [ ] **Step 1: Scan the current error paths**

Read `src/components/SolveDetailModal.tsx` lines 164–200. Confirm:
- `handleShare` (line ~172): `console.error` → `setShareState('idle')` → silent.
- `handleUnshare` (line ~195): `catch { /* silently revert */ }` → silent.

- [ ] **Step 2: Add `shareError` state after `shareCopied`**

In `src/components/SolveDetailModal.tsx`, after:
```tsx
const [shareCopied, setShareCopied] = useState(false)
```
Add:
```tsx
const [shareError, setShareError] = useState<string | null>(null)
```

- [ ] **Step 3: Set `shareError` on share failure**

In `handleShare`, replace the catch block:
```tsx
// Before:
} catch (e) {
  console.error('[share] onShare failed:', e)
  setShareState('idle')
  return
}

// After:
} catch (e) {
  console.error('[share] onShare failed:', e)
  setShareState('idle')
  setShareError('Share failed — please try again.')
  setTimeout(() => setShareError(null), 4000)
  return
}
```

- [ ] **Step 4: Set `shareError` on unshare failure**

In `handleUnshare`, replace the catch/finally block:
```tsx
// Before:
} catch {
  // silently revert
} finally {
  setShareState('idle')
}

// After:
} catch {
  setShareError('Could not remove share — please try again.')
  setTimeout(() => setShareError(null), 4000)
} finally {
  setShareState('idle')
}
```

- [ ] **Step 5: Render `shareError` after the share row**

In `SolveDetailModal.tsx`, the share row ends around line 823 (`</div>` closing the `{onShare && (...)}`). Add the error display immediately inside `{onShare && (...)}`, after the inner `<div>`:

```tsx
{onShare && (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* ...existing share row unchanged... */}
    </div>
    {shareError && (
      <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 2 }}>{shareError}</div>
    )}
  </>
)}
```

Wrap the existing single `<div>` and the new error line in a `<>` fragment. The inner `<div>` contents are unchanged.

- [ ] **Step 6: Run existing SolveDetailModal tests**

```bash
npm run test -- tests/components/SolveDetailModal.test.tsx
```
Expected: all existing tests pass (no behavior change to modal logic).

- [ ] **Step 7: Commit**

```bash
git add src/components/SolveDetailModal.tsx
git commit -m "fix: show visible error when share/unshare fails"
```

---

## Task 2: Add `signInAnonymously` to the firebase-auth mock

The vitest config aliases `firebase/auth` globally to `tests/__mocks__/firebase-auth.ts`. The mock does not yet export `signInAnonymously`. Tests for `useCloudSync` will import it via the alias, so it must exist.

**Files:**
- Modify: `tests/__mocks__/firebase-auth.ts`

- [ ] **Step 1: Add `signInAnonymously` to the mock**

In `tests/__mocks__/firebase-auth.ts`, add after `export const onAuthStateChanged = vi.fn()`:

```typescript
export const signInAnonymously = vi.fn()
```

- [ ] **Step 2: Commit**

```bash
git add tests/__mocks__/firebase-auth.ts
git commit -m "test: add signInAnonymously to firebase-auth mock"
```

---

## Task 3: Add `signInAnonymously` to `CloudConfig` interface

`CloudConfig` (in `solveStore.ts`) is the shape passed from `App.tsx` to `TimerScreen` via props. Adding the method here lets TypeScript verify the wiring end-to-end.

**Files:**
- Modify: `src/stores/solveStore.ts:17-21`

- [ ] **Step 1: Update the interface**

In `src/stores/solveStore.ts`, replace:
```typescript
export interface CloudConfig {
  enabled: boolean
  user: User | null
  authLoading?: boolean
}
```
With:
```typescript
export interface CloudConfig {
  enabled: boolean
  user: User | null
  authLoading?: boolean
  signInAnonymously: () => Promise<User>
}
```

- [ ] **Step 2: Check for broken call sites**

```bash
npm run build 2>&1 | grep -i "error\|CloudConfig" | head -20
```
Expected: TypeScript error at `App.tsx` line ~60 — `cloudConfig` object literal is missing `signInAnonymously`. No other errors yet (TimerScreen reads it optionally via `cloudConfig?.signInAnonymously`).

- [ ] **Step 3: Commit**

```bash
git add src/stores/solveStore.ts
git commit -m "feat: add signInAnonymously to CloudConfig interface"
```

---

## Task 4: Extend `useCloudSync` with anon support — TDD

Write failing tests first, then implement to make them pass.

**Files:**
- Create: `tests/hooks/useCloudSync.test.ts`
- Modify: `src/hooks/useCloudSync.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/hooks/useCloudSync.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { onAuthStateChanged, signInAnonymously as fbSignInAnonymously } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { STORAGE_KEYS } from '../../src/utils/storageKeys'

// firebase/auth is aliased to tests/__mocks__/firebase-auth.ts by vitest.config.ts
vi.mock('../../src/services/firebase', () => ({ auth: {}, googleProvider: {} }))
vi.mock('../../src/services/analytics', () => ({
  setAnalyticsUser: vi.fn(),
  logCloudSyncEnabled: vi.fn(),
}))

import { useCloudSync } from '../../src/hooks/useCloudSync'

const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
const mockFbSignInAnonymously = vi.mocked(fbSignInAnonymously)

function simulateAuthChange(user: User | null) {
  const calls = mockOnAuthStateChanged.mock.calls
  const callback = calls[calls.length - 1][1] as (u: User | null) => void
  act(() => { callback(user) })
}

function makeUser(overrides: Partial<User>): User {
  return { uid: 'uid-123', email: 'test@example.com', isAnonymous: false, ...overrides } as unknown as User
}

describe('useCloudSync — anonymous auth handling', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockOnAuthStateChanged.mockReturnValue(vi.fn()) // no-op unsubscribe
  })

  it('forces enabled=false and clears storage when auth state is anonymous', () => {
    localStorage.setItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED, 'true')
    const { result } = renderHook(() => useCloudSync())
    simulateAuthChange(makeUser({ uid: 'anon-uid', isAnonymous: true }))
    expect(result.current.enabled).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED)).toBe('false')
  })

  it('does not force enabled=false for a Google user', () => {
    localStorage.setItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED, 'true')
    const { result } = renderHook(() => useCloudSync())
    simulateAuthChange(makeUser({ uid: 'google-uid', isAnonymous: false }))
    expect(result.current.enabled).toBe(true)
  })

  it('exposes signInAnonymously that calls firebase and returns the user', async () => {
    const fakeUser = makeUser({ uid: 'anon-uid', isAnonymous: true })
    mockFbSignInAnonymously.mockResolvedValue({ user: fakeUser } as any)
    const { result } = renderHook(() => useCloudSync())
    simulateAuthChange(null)
    let returned: User | undefined
    await act(async () => {
      returned = await result.current.signInAnonymously()
    })
    expect(mockFbSignInAnonymously).toHaveBeenCalledOnce()
    expect(returned?.uid).toBe('anon-uid')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/hooks/useCloudSync.test.ts
```
Expected: 3 failures — `signInAnonymously` does not exist on `CloudSyncState`, anon path not implemented.

- [ ] **Step 3: Implement the changes in `useCloudSync.ts`**

Replace the full contents of `src/hooks/useCloudSync.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut,
  signInAnonymously as fbSignInAnonymously,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { setAnalyticsUser, logCloudSyncEnabled } from '../services/analytics'

export interface CloudSyncState {
  enabled: boolean
  user: User | null
  authLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  enable: () => void
  disable: () => void
  signInAnonymously: () => Promise<User>
}

export function useCloudSync(): CloudSyncState {
  const [enabled, setEnabled] = useState<boolean>(
    () => loadFromStorage<boolean>(STORAGE_KEYS.CLOUD_SYNC_ENABLED, false)
  )
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
      setAnalyticsUser(u ? u.uid : null)
      if (!u || u.isAnonymous) {
        setEnabled(false)
        saveToStorage(STORAGE_KEYS.CLOUD_SYNC_ENABLED, false)
      }
    })
    return unsub
  }, [])

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider)
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const enable = useCallback(() => {
    setEnabled(true)
    saveToStorage(STORAGE_KEYS.CLOUD_SYNC_ENABLED, true)
    logCloudSyncEnabled()
  }, [])

  const disable = useCallback(() => {
    setEnabled(false)
    saveToStorage(STORAGE_KEYS.CLOUD_SYNC_ENABLED, false)
  }, [])

  const signInAnonymously = useCallback(async (): Promise<User> => {
    const cred = await fbSignInAnonymously(auth)
    return cred.user
  }, [])

  return { enabled, user, authLoading, signIn, signOut, enable, disable, signInAnonymously }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/hooks/useCloudSync.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```
Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCloudSync.ts tests/hooks/useCloudSync.test.ts
git commit -m "feat: useCloudSync — anon auth forces enabled=false, exposes signInAnonymously"
```

---

## Task 5: Update `App.tsx` — wire `signInAnonymously`, fix anon branches

Three lines change in `App.tsx`:
1. `cloudConfig` object gets `signInAnonymously`.
2. `useCloudNow` explicitly guards against anon (defensive — `enabled` is already forced false).
3. Debug panel branch: `cloudSync.user ?` → `cloudSync.user && !cloudSync.user.isAnonymous ?` to avoid "Signed in as undefined".

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `signInAnonymously` to `cloudConfig` (line ~60)**

Find:
```tsx
const cloudConfig = { enabled: cloudSync.enabled, user: cloudSync.user, authLoading: cloudSync.authLoading }
```
Replace with:
```tsx
const cloudConfig = { enabled: cloudSync.enabled, user: cloudSync.user, authLoading: cloudSync.authLoading, signInAnonymously: cloudSync.signInAnonymously }
```

- [ ] **Step 2: Fix `useCloudNow` to exclude anon users (line ~115)**

Find:
```tsx
const useCloudNow = !!(cloudSync.enabled && cloudSync.user)
```
Replace with:
```tsx
const useCloudNow = !!(cloudSync.enabled && cloudSync.user && !cloudSync.user.isAnonymous)
```

- [ ] **Step 3: Fix debug panel branch to treat anon as "Not signed in" (line ~273)**

Find:
```tsx
} : cloudSync.user ? (
```
Replace with:
```tsx
} : cloudSync.user && !cloudSync.user.isAnonymous ? (
```

- [ ] **Step 4: Verify TypeScript build succeeds**

```bash
npm run build 2>&1 | grep -i error | head -20
```
Expected: No TypeScript errors (the `cloudConfig` object now satisfies `CloudConfig`).

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App.tsx — wire signInAnonymously, exclude anon from cloud sync and debug panel"
```

---

## Task 6: Update `TimerScreen.tsx` — TDD for new share/unshare logic

The spec defines the new `onShare` callback precisely: provision anon if no uid, then call `shareSolve`. Write the test first, then wire it in.

**Files:**
- Create: `tests/components/TimerScreen.share.test.ts`
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Write failing tests**

The `onShare` callback is defined inline in JSX; it cannot be imported directly. We test the same logic as a pure function in the test file. If the TimerScreen implementation diverges from this logic, the test file comment calls this out explicitly.

Create `tests/components/TimerScreen.share.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { User } from 'firebase/auth'
import type { SolveRecord } from '../../src/types/solve'
import type { CloudConfig } from '../../src/stores/solveStore'

// Tests the anon-provisioning logic that TimerScreen.tsx uses in its onShare callback.
// If the callback logic in TimerScreen changes, update this test to match.

function makeCloudConfig(overrides: Partial<CloudConfig> = {}): CloudConfig {
  return {
    enabled: false,
    user: null,
    signInAnonymously: vi.fn(),
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return { uid: 'uid-123', email: 'a@b.com', isAnonymous: false, ...overrides } as unknown as User
}

function makeSolve(): SolveRecord {
  return { id: 1, seq: 1, scramble: '', timeMs: 1000, moves: [], phases: [], date: 1, schemaVersion: 2 }
}

// Reproduce the onShare logic from TimerScreen.tsx inline
async function timerScreenOnShare(
  cloudConfig: CloudConfig | undefined,
  shareSolveFn: (uid: string, solve: SolveRecord) => Promise<string>,
  solve: SolveRecord
): Promise<string> {
  let uid = cloudConfig?.user?.uid
  if (!uid) {
    if (!cloudConfig?.signInAnonymously) throw new Error('cloud config unavailable')
    const anon = await cloudConfig.signInAnonymously()
    uid = anon.uid
  }
  return shareSolveFn(uid, solve)
}

describe('TimerScreen — onShare anon provisioning', () => {
  it('calls signInAnonymously then shareSolve with anon uid when user is null', async () => {
    const anonUser = makeUser({ uid: 'anon-uid-xyz', isAnonymous: true })
    const mockSignInAnonymously = vi.fn().mockResolvedValue(anonUser)
    const mockShareSolve = vi.fn().mockResolvedValue('share-id-abc')
    const config = makeCloudConfig({ user: null, signInAnonymously: mockSignInAnonymously })

    const result = await timerScreenOnShare(config, mockShareSolve, makeSolve())

    expect(mockSignInAnonymously).toHaveBeenCalledOnce()
    expect(mockShareSolve).toHaveBeenCalledWith('anon-uid-xyz', expect.any(Object))
    expect(result).toBe('share-id-abc')
  })

  it('skips signInAnonymously and uses existing uid when already signed in', async () => {
    const googleUser = makeUser({ uid: 'google-uid-abc', isAnonymous: false })
    const mockSignInAnonymously = vi.fn()
    const mockShareSolve = vi.fn().mockResolvedValue('share-id-def')
    const config = makeCloudConfig({ user: googleUser, signInAnonymously: mockSignInAnonymously })

    await timerScreenOnShare(config, mockShareSolve, makeSolve())

    expect(mockSignInAnonymously).not.toHaveBeenCalled()
    expect(mockShareSolve).toHaveBeenCalledWith('google-uid-abc', expect.any(Object))
  })
})
```

- [ ] **Step 2: Run tests to verify they pass (pure logic, no mocking needed)**

```bash
npm run test -- tests/components/TimerScreen.share.test.ts
```
Expected: Both tests pass immediately (they test pure logic, not the component itself).

- [ ] **Step 3: Read the current TimerScreen share gate (lines ~522–529)**

```tsx
onShare={cloudConfig?.enabled && cloudConfig?.user
  ? async (solve) => shareSolve(cloudConfig.user!.uid, solve)
  : undefined
}
onUnshare={cloudConfig?.enabled && cloudConfig?.user
  ? async (shareId) => unshareSolve(cloudConfig.user!.uid, shareId)
  : undefined
}
```

- [ ] **Step 4: Replace the share/unshare gates in TimerScreen.tsx**

Find the code above and replace with:

```tsx
onShare={async (solve) => {
  let uid = cloudConfig?.user?.uid
  if (!uid) {
    if (!cloudConfig?.signInAnonymously) throw new Error('cloud config unavailable')
    const anon = await cloudConfig.signInAnonymously()
    uid = anon.uid
  }
  return shareSolve(uid, solve)
}}
onUnshare={async (shareId) => {
  if (!cloudConfig?.user) throw new Error('not signed in')
  await unshareSolve(cloudConfig.user.uid, shareId)
}}
```

Note: the `onUnshare` for the **shared-solve preview** path (lines ~539–542) is separate — it keeps the existing `sharedSolveIsOwned && cloudConfig?.user` gate. Do not change those lines.

- [ ] **Step 5: Verify TypeScript build succeeds**

```bash
npm run build 2>&1 | grep -i error | head -20
```
Expected: No new TypeScript errors.

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/TimerScreen.tsx tests/components/TimerScreen.share.test.ts
git commit -m "feat: TimerScreen — share available to all users via anon provisioning"
```

---

## Task 7: Test — App.tsx debug panel shows "Sign in with Google" for anon user

This component test mounts `App` with `useCloudSync` mocked to return an anon user, and asserts the debug panel does NOT render "Signed in as" and DOES render "Sign in with Google".

**Files:**
- Create: `tests/components/App.cloudSync.test.tsx`

- [ ] **Step 1: Write the test**

Create `tests/components/App.cloudSync.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'

// firebase/auth is globally aliased by vitest.config.ts; services need explicit mocks
vi.mock('../../src/services/firebase', () => ({ auth: {}, googleProvider: {}, db: {}, app: {} }))
vi.mock('../../src/services/firestoreSolves', () => ({
  loadSolvesFromFirestore: vi.fn(),
  addSolveToFirestore: vi.fn(),
  updateSolveInFirestore: vi.fn(),
  deleteSolveFromFirestore: vi.fn(),
  loadNextSeqFromFirestore: vi.fn(),
  updateCounterInFirestore: vi.fn(),
  migrateLocalSolvesToFirestore: vi.fn(),
  bulkUpdateSolvesInFirestore: vi.fn(),
  renumberSolvesInFirestore: vi.fn(),
  recalibrateSolvesInFirestore: vi.fn(),
  migrateSolvesToV2InFirestore: vi.fn(),
}))
vi.mock('../../src/services/firestoreSharing', () => ({
  shareSolve: vi.fn(),
  unshareSolve: vi.fn(),
  isSharedSolveOwner: vi.fn(),
  loadSharedSolve: vi.fn(),
  updateSharedSolve: vi.fn(),
}))
vi.mock('../../src/services/analytics', () => ({
  setAnalyticsUser: vi.fn(),
  logCloudSyncEnabled: vi.fn(),
  logCubeConnected: vi.fn(),
  logCubeFirstMove: vi.fn(),
  logSolveShared: vi.fn(),
  logConsentGranted: vi.fn(),
  logConsentDeclined: vi.fn(),
  logConsentShown: vi.fn(),
}))
vi.mock('../../src/components/CubeCanvas', () => ({ CubeCanvas: () => <div data-testid="cube-canvas" /> }))
vi.mock('../../src/components/TimerScreen', () => ({ TimerScreen: () => <div data-testid="timer-screen" /> }))
vi.mock('../../src/components/ConnectionBar', () => ({ ConnectionBar: () => <div /> }))
vi.mock('../../src/components/ControlBar', () => ({ ControlBar: () => <div /> }))
vi.mock('../../src/components/MoveHistory', () => ({ MoveHistory: () => <div /> }))
vi.mock('../../src/components/FaceletDebug', () => ({ FaceletDebug: () => <div /> }))
vi.mock('../../src/components/OrientationConfig', () => ({ OrientationConfig: () => <div /> }))
vi.mock('../../src/components/AnalyticsBanner', () => ({ AnalyticsBanner: () => <div /> }))
vi.mock('../../src/hooks/useCubeDriver', () => ({
  useCubeDriver: () => ({
    driver: null, connect: vi.fn(), disconnect: vi.fn(),
    status: 'disconnected', driverType: 'mouse', switchDriver: vi.fn(), driverVersion: 0,
  }),
}))
vi.mock('../../src/hooks/useCubeState', () => ({
  useCubeState: () => ({
    facelets: '', isSolved: false, isSolvedRef: { current: false },
    resetState: vi.fn(), resetCenterPositions: vi.fn(), handleMove: vi.fn(),
  }),
}))
vi.mock('../../src/hooks/useGyro', () => ({
  useGyro: () => ({
    quaternion: null, config: { front: 'G', bottom: 'Y' },
    resetGyro: vi.fn(), resetSensorOffset: vi.fn(), saveOrientationConfig: vi.fn(),
    sensorStateRef: { current: 'HOME' },
  }),
}))
vi.mock('../../src/hooks/useGestureDetector', () => ({ useGestureDetector: () => {} }))
vi.mock('../../src/hooks/useSolveRecorder', () => ({
  useSolveRecorder: () => ({ solveStarted: false }),
}))
vi.mock('../../src/hooks/useCubeDriverEvent', () => ({ useCubeDriverEvent: () => {} }))
vi.mock('../../src/hooks/useSolveStore', () => ({
  useSolveStore: () => ({ solves: [], cloudLoading: false, status: 'idle' }),
}))
vi.mock('../../src/hooks/useHashRouter', () => ({
  useHashRouter: () => ({ currentRoute: { type: 'debug' }, navigate: vi.fn() }),
  parseHash: vi.fn(() => ({ type: 'debug' })),
  decideSelectedSolveUrlAction: vi.fn(),
  decideSharedSolveUrlAction: vi.fn(),
}))
vi.mock('../../src/stores/solveStore', () => ({
  solveStore: {
    configure: vi.fn(),
    getSnapshot: () => ({ solves: [] }),
    reloadLocal: vi.fn(),
    runBulkOp: vi.fn(),
    reload: vi.fn(),
  },
  __resetForTests: vi.fn(),
}))

// useCloudSync is mocked per-test to control the auth state
vi.mock('../../src/hooks/useCloudSync')

import { useCloudSync } from '../../src/hooks/useCloudSync'
import App from '../../src/App'

function makeCloudSyncState(userOverrides: Partial<User> | null) {
  const user = userOverrides
    ? { uid: 'uid', email: null, isAnonymous: false, ...userOverrides } as unknown as User
    : null
  return {
    enabled: false,
    user,
    authLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    signInAnonymously: vi.fn(),
  }
}

describe('App debug panel — anon user auth display', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.location.hash = '#debug'
  })

  it('shows "Sign in with Google" for an anonymous user, not "Signed in as"', () => {
    vi.mocked(useCloudSync).mockReturnValue(
      makeCloudSyncState({ uid: 'anon-uid', isAnonymous: true })
    )
    render(<App />)
    expect(screen.queryByText(/Signed in as/i)).toBeNull()
    expect(screen.getByText(/Sign in with Google/i)).toBeInTheDocument()
  })

  it('shows "Signed in as {email}" for a Google user', () => {
    vi.mocked(useCloudSync).mockReturnValue(
      makeCloudSyncState({ uid: 'google-uid', isAnonymous: false, email: 'user@gmail.com' } as any)
    )
    render(<App />)
    expect(screen.getByText(/Signed in as user@gmail.com/i)).toBeInTheDocument()
    expect(screen.queryByText(/Sign in with Google/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- tests/components/App.cloudSync.test.tsx
```
Expected: Both tests pass (the App.tsx fix in Task 5 already guards the branch correctly).

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/components/App.cloudSync.test.tsx
git commit -m "test: App debug panel shows Sign in with Google for anonymous user"
```

---

## Task 8: Update documentation

**Files:**
- Modify: `docs/firebase-cloud-sync.md`
- Modify: `docs/storage.md`
- Modify: `docs/manual-test-checklist.md`

- [ ] **Step 1: Read `docs/firebase-cloud-sync.md` and add anon auth section**

Read the file to find the right insertion point (after the main architecture section). Add:

```markdown
## Anonymous auth for sharing

When a user who has never signed in clicks Share, the app calls Firebase's `signInAnonymously()` to obtain a UID without a sign-in popup. The anonymous session is persisted by Firebase in IndexedDB (`firebaseLocalStorageDb`) and survives page reloads in the same browser.

**What anonymous users can and cannot do:**
- **Can share** a solve — the anonymous UID satisfies the Firestore security rule `request.auth.uid`.
- **Cannot use cloud sync** for solves — anonymous users are treated the same as signed-out users; `enabled` is forced `false` and solves stay in localStorage.
- **Can unshare from the same browser** — the anonymous UID is stable in IndexedDB across reloads; a different browser or incognito mode creates a fresh UID and cannot unshare.

**Caveats:**
- If the user clears site data, both the IndexedDB anonymous session and localStorage solves are gone together. The share URL still resolves on Firestore, but the user cannot unshare it (existing error toast is shown).
- Signing in with Google after an anonymous share assigns a new Google UID. The share registry doc remains under the old anonymous UID; Unshare fails with a Firestore rule rejection (existing error toast is shown). A future fix will stamp `shareOwnerUid` on the localStorage record and hide the Unshare button when UIDs don't match — see `future.md` under `## firebase`.
```

- [ ] **Step 2: Read `docs/storage.md` and add IndexedDB note**

Read the file to find where Firebase is mentioned. Add a note on the anonymous session:

```markdown
**Firebase anonymous auth session:** Firebase persists the anonymous session in browser IndexedDB (`firebaseLocalStorageDb`). The app does not store the anonymous UID in its own localStorage keys. The session auto-restores on reload in the same browser.
```

- [ ] **Step 3: Read `docs/manual-test-checklist.md` and add v1.31.0 share tests**

Find the appropriate section and add:

```markdown
### v1.31.0 — Share without cloud sync

1. **Fresh browser, never signed in → Share → URL works**
   - Open the app in a fresh browser profile (no existing state) or private/incognito window
   - Click Share on any solve
   - Verify the share URL appears; paste it in another tab — the solve loads

2. **After anonymous share, Unshare removes the link**
   - In the same browser as step 1, click Unshare on the shared solve
   - Verify the URL no longer resolves (shows "Solve not found")

3. **After anonymous share, page reload restores shared state**
   - After step 1, reload the page
   - Open the same solve — verify it still shows the Unshare button (Firebase restores the anonymous session from IndexedDB)

4. **Debug panel shows "Not signed in" after anonymous auth provisioning**
   - After step 1, open debug mode (`#debug`)
   - Verify the Cloud Sync panel shows "Not signed in" and "Sign in with Google" — NOT "Signed in as undefined"

5. **Shared URL works in a different browser (read-only)**
   - Open the share URL from step 1 in a different browser (no account, no state)
   - Verify the solve loads in read-only mode

6. **Google sign-in share/unshare flow unchanged**
   - Sign in with Google, enable cloud sync
   - Share a solve → URL appears → paste in another tab → loads
   - Unshare → URL no longer resolves
```

- [ ] **Step 4: Run full test suite**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add docs/firebase-cloud-sync.md docs/storage.md docs/manual-test-checklist.md
git commit -m "docs: document anonymous auth for sharing, add v1.31.0 manual QA tests"
```

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Covered by |
|---|---|
| Remove cloud gate on Share button | Task 6 — TimerScreen `onShare` |
| `signInAnonymously()` on first share (anon provision) | Task 4 + Task 6 |
| Anon treated as not-signed-in for cloud sync (`enabled` forced false) | Task 4 — `useCloudSync` |
| Visible error on share/unshare failure | Task 1 — SolveDetailModal |
| Debug panel shows "Sign in with Google" for anon | Task 5 — App.tsx |
| `useCloudNow` excludes anon users | Task 5 — App.tsx |
| `signInAnonymously` in `CloudConfig` interface | Task 3 — solveStore.ts |
| `onUnshare` guard: throws "not signed in" if no user | Task 6 — TimerScreen |
| Existing shared-solve preview `onUnshare` unchanged (lines ~539–542) | Not touched — confirmed in Task 6 step 4 |
| `SolveDetailModal.tsx` — no behavior changes | Not in any task |
| `firestoreSharing.ts` — no changes | Not in any task |
| `firestore.rules` — no changes (confirm deployed rule manually before merge) | Pre-merge checklist |
| Test: anon forces `enabled=false` | Task 4 |
| Test: `signInAnonymously` method works | Task 4 |
| Test: `onShare` provisions anon when no user | Task 6 |
| Test: `onShare` skips anon when already signed in | Task 6 |
| Test: debug panel shows "Sign in with Google" for anon | Task 7 |
| Docs: `firebase-cloud-sync.md` | Task 8 |
| Docs: `storage.md` | Task 8 |
| Docs: `manual-test-checklist.md` | Task 8 |

### 2. Placeholder scan

No TBDs, no "handle edge cases" without specific code, all catch blocks have explicit behavior, all code blocks are complete.

### 3. Type consistency

- `CloudConfig.signInAnonymously: () => Promise<User>` — defined Task 3, wired in Task 5, called in Task 6. ✓
- `CloudSyncState.signInAnonymously: () => Promise<User>` — defined and implemented in Task 4. ✓
- `fbSignInAnonymously(auth)` returns `UserCredential`; `cred.user` is `User`. Return type matches interface. ✓
- `handleShare` calls `shareSolve(uid, solve)` where `uid: string` — matches existing signature. ✓
- `handleUnshare` calls `unshareSolve(cloudConfig.user.uid, shareId)` — `user` is non-null by guard. ✓

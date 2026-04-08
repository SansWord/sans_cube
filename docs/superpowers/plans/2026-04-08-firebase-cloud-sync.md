# Firebase Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in Firebase cloud sync for solve history so solves persist across devices, with localStorage remaining the default.

**Architecture:** A `useCloudSync` hook manages Firebase Auth state and the opt-in toggle flag. `useSolveHistory` accepts a `cloudConfig` parameter — when provided, it reads/writes Firestore instead of localStorage. `App.tsx` wires the two together and shows auth + toggle UI in debug mode. Migration from localStorage to Firestore runs once when the user first enables the feature.

**Tech Stack:** Firebase 11 (Firestore + Google Auth), React 19, TypeScript, Vite, GitHub Actions (Pages deploy)

---

## File Map

| File | Change | Purpose |
|------|--------|---------|
| `src/services/firebase.ts` | Create | Firebase app init, exports `auth` and `db` |
| `src/services/firestoreSolves.ts` | Create | Firestore CRUD for solve records |
| `src/hooks/useCloudSync.ts` | Create | Auth state + cloud sync toggle + migration |
| `src/utils/storageKeys.ts` | Modify | Add `CLOUD_SYNC_ENABLED` key |
| `src/hooks/useSolveHistory.ts` | Modify | Accept `cloudConfig`, branch localStorage vs Firestore |
| `src/components/TimerScreen.tsx` | Modify | Accept + forward `cloudConfig` prop |
| `src/App.tsx` | Modify | Call `useCloudSync`, pass to TimerScreen, add debug UI |
| `.env.local` | Create | Firebase config (not committed — covered by `*.local` in .gitignore) |
| `.github/workflows/deploy.yml` | Create | GitHub Actions deploy to Pages |

---

## Task 1: Install Firebase and create config files

**Files:**
- Create: `.env.local`
- Create: `src/services/firebase.ts`

- [ ] **Step 1: Install the Firebase package**

```bash
npm install firebase
```

Expected: `firebase` appears in `package.json` dependencies.

- [ ] **Step 2: Create a Firebase project and get config**

1. Go to https://console.firebase.google.com
2. Create a new project (e.g. `sans-cube`)
3. Add a **Web app** to the project
4. Copy the config object — it looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "sans-cube.firebaseapp.com",
     projectId: "sans-cube",
     storageBucket: "sans-cube.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   }
   ```
5. Enable **Authentication → Sign-in method → Google**
6. Enable **Firestore Database** (start in **production mode**)

- [ ] **Step 3: Create `.env.local` with the Firebase config**

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=sans-cube.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sans-cube
VITE_FIREBASE_STORAGE_BUCKET=sans-cube.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

Replace each value with your actual Firebase config values. This file is already git-ignored via `*.local`.

- [ ] **Step 4: Create `src/services/firebase.ts`**

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
```

- [ ] **Step 5: Set Firestore security rules**

In the Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/solves/{solveId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

- [ ] **Step 6: Verify TypeScript build compiles**

```bash
npm run build
```

Expected: no TypeScript errors. (Firebase types are bundled with the package.)

- [ ] **Step 7: Commit**

```bash
git add src/services/firebase.ts package.json package-lock.json
git commit -m "feat: add Firebase app init and config"
```

---

## Task 2: Create Firestore solve service

**Files:**
- Create: `src/services/firestoreSolves.ts`

- [ ] **Step 1: Create `src/services/firestoreSolves.ts`**

```typescript
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { SolveRecord } from '../types/solve'

function solvesRef(uid: string) {
  return collection(db, 'users', uid, 'solves')
}

// Document ID is String(solve.date) — unique per solve (Date.now() at solve time)
function solveDocRef(uid: string, solve: SolveRecord) {
  return doc(db, 'users', uid, 'solves', String(solve.date))
}

export async function loadSolvesFromFirestore(uid: string): Promise<SolveRecord[]> {
  const q = query(solvesRef(uid), orderBy('date', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as SolveRecord)
}

export async function addSolveToFirestore(uid: string, solve: SolveRecord): Promise<void> {
  await setDoc(solveDocRef(uid, solve), solve)
}

export async function deleteSolveFromFirestore(uid: string, solve: SolveRecord): Promise<void> {
  await deleteDoc(solveDocRef(uid, solve))
}

export async function migrateLocalSolvesToFirestore(uid: string, solves: SolveRecord[]): Promise<void> {
  await Promise.all(solves.map((s) => addSolveToFirestore(uid, s)))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/firestoreSolves.ts
git commit -m "feat: add Firestore solve CRUD service"
```

---

## Task 3: Add cloud sync storage key and create useCloudSync hook

**Files:**
- Modify: `src/utils/storageKeys.ts`
- Create: `src/hooks/useCloudSync.ts`

- [ ] **Step 1: Add `CLOUD_SYNC_ENABLED` to `src/utils/storageKeys.ts`**

```typescript
export const STORAGE_KEYS = {
  SOLVES: 'sans_cube_solves',
  NEXT_ID: 'sans_cube_next_id',
  DISMISSED_EXAMPLES: 'sans_cube_dismissed_examples',
  ORIENTATION_CONFIG: 'cubeOrientationConfig',
  SIDEBAR_WIDTH: 'sidebarWidth',
  METHOD: 'sans_cube_method',
  CLOUD_SYNC_ENABLED: 'sans_cube_cloud_sync_enabled',
} as const
```

- [ ] **Step 2: Create `src/hooks/useCloudSync.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'

export interface CloudSyncState {
  enabled: boolean
  user: User | null
  authLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  enable: () => void
  disable: () => void
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
  }, [])

  const disable = useCallback(() => {
    setEnabled(false)
    saveToStorage(STORAGE_KEYS.CLOUD_SYNC_ENABLED, false)
  }, [])

  return { enabled, user, authLoading, signIn, signOut, enable, disable }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storageKeys.ts src/hooks/useCloudSync.ts
git commit -m "feat: add cloud sync toggle hook with Firebase Auth"
```

---

## Task 4: Update useSolveHistory to support Firestore

**Files:**
- Modify: `src/hooks/useSolveHistory.ts`

The hook currently initializes synchronously from localStorage. In cloud mode, it loads asynchronously from Firestore. We add a `cloudConfig` parameter and a `loading` state.

- [ ] **Step 1: Replace `src/hooks/useSolveHistory.ts`**

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'
import type { User } from 'firebase/auth'
import type { SolveRecord } from '../types/solve'
import { EXAMPLE_SOLVES } from '../data/exampleSolves'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import {
  loadSolvesFromFirestore,
  addSolveToFirestore,
  deleteSolveFromFirestore,
  migrateLocalSolvesToFirestore,
} from '../services/firestoreSolves'

export interface CloudConfig {
  enabled: boolean
  user: User | null
}

function loadNextId(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NEXT_ID)
    return raw ? Math.max(1, parseInt(raw, 10)) : 1
  } catch {
    return 1
  }
}

function saveNextId(id: number): void {
  localStorage.setItem(STORAGE_KEYS.NEXT_ID, String(id))
}

function loadLocalSolves(): SolveRecord[] {
  return loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
}

function saveLocalSolves(solves: SolveRecord[]): void {
  saveToStorage(STORAGE_KEYS.SOLVES, solves)
}

function loadDismissedExamples(): Set<number> {
  return new Set(loadFromStorage<number[]>(STORAGE_KEYS.DISMISSED_EXAMPLES, []))
}

function dismissExample(id: number): void {
  const dismissed = loadDismissedExamples()
  dismissed.add(id)
  saveToStorage(STORAGE_KEYS.DISMISSED_EXAMPLES, [...dismissed])
}

// Exported for tests
export function computeAo(solves: SolveRecord[], n: number): number | null {
  if (solves.length < n) return null
  const slice = solves.slice(solves.length - n)
  if (n <= 4) {
    return slice.reduce((sum, s) => sum + s.timeMs, 0) / n
  }
  const times = slice.map((s) => s.timeMs).sort((a, b) => a - b)
  const trimmed = times.slice(1, -1)
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
}

function bestAo(solves: SolveRecord[], n: number): number | null {
  if (solves.length < n) return null
  let best: number | null = null
  for (let i = n; i <= solves.length; i++) {
    const ao = computeAo(solves.slice(0, i), n)
    if (ao !== null && (best === null || ao < best)) best = ao
  }
  return best
}

interface StatEntry {
  current: number | null
  best: number | null
}

interface SolveStats {
  single: StatEntry
  ao5: StatEntry
  ao12: StatEntry
  ao100: StatEntry
}

// Exported for tests
export function computeStats(solves: SolveRecord[]): SolveStats {
  const single: StatEntry = {
    current: solves.length > 0 ? solves[solves.length - 1].timeMs : null,
    best: solves.length > 0 ? Math.min(...solves.map((s) => s.timeMs)) : null,
  }
  return {
    single,
    ao5:   { current: computeAo(solves, 5),   best: bestAo(solves, 5) },
    ao12:  { current: computeAo(solves, 12),  best: bestAo(solves, 12) },
    ao100: { current: computeAo(solves, 100), best: bestAo(solves, 100) },
  }
}

export function useSolveHistory(cloudConfig?: CloudConfig) {
  const useCloud = !!(cloudConfig?.enabled && cloudConfig?.user)
  const uid = cloudConfig?.user?.uid ?? null

  // localStorage state (always initialized, used when cloud is off)
  const [localSolves, setLocalSolves] = useState<SolveRecord[]>(() => loadLocalSolves())
  const [dismissedExamples, setDismissedExamples] = useState<Set<number>>(() => loadDismissedExamples())

  // Cloud state
  const [cloudSolves, setCloudSolves] = useState<SolveRecord[]>([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const migratedRef = useRef(false)

  // Sequential ID counter (for localStorage mode)
  const nextIdRef = useRef(Math.max(
    loadNextId(),
    localSolves.length > 0 ? Math.max(...localSolves.map(s => s.id)) + 1 : 1
  ))

  // Load from Firestore when cloud is enabled
  useEffect(() => {
    if (!useCloud || !uid) return

    setCloudLoading(true)

    // Migrate localStorage solves on first enable (only once per session)
    const doLoad = async () => {
      if (!migratedRef.current && localSolves.length > 0) {
        migratedRef.current = true
        await migrateLocalSolvesToFirestore(uid, localSolves)
      }
      const solves = await loadSolvesFromFirestore(uid)
      setCloudSolves(solves)
      setCloudLoading(false)
    }

    doLoad()
  }, [useCloud, uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextId = useCallback((): number => {
    if (useCloud) {
      // In cloud mode, use timestamp as ID to avoid cross-device conflicts
      return Date.now()
    }
    const id = nextIdRef.current
    nextIdRef.current = id + 1
    saveNextId(nextIdRef.current)
    return id
  }, [useCloud])

  const addSolve = useCallback((solve: SolveRecord) => {
    if (useCloud && uid) {
      setCloudSolves((prev) => [...prev, solve])
      addSolveToFirestore(uid, solve)
    } else {
      setLocalSolves((prev) => {
        const next = [...prev, solve]
        saveLocalSolves(next)
        return next
      })
    }
  }, [useCloud, uid])

  const deleteSolve = useCallback((id: number) => {
    if (id < 0) {
      dismissExample(id)
      setDismissedExamples((prev) => new Set([...prev, id]))
      return
    }
    if (useCloud && uid) {
      setCloudSolves((prev) => {
        const solve = prev.find((s) => s.id === id)
        if (solve) deleteSolveFromFirestore(uid, solve)
        return prev.filter((s) => s.id !== id)
      })
    } else {
      setLocalSolves((prev) => {
        const next = prev.filter((s) => s.id !== id)
        saveLocalSolves(next)
        return next
      })
    }
  }, [useCloud, uid])

  const solves = useCloud ? cloudSolves : localSolves
  const visibleExamples = EXAMPLE_SOLVES.filter((e) => !dismissedExamples.has(e.id))
  const allSolves = [...visibleExamples, ...solves]
  const stats = computeStats(solves)

  return { solves: allSolves, addSolve, deleteSolve, stats, nextId, cloudLoading }
}
```

- [ ] **Step 2: Run existing tests to make sure the pure functions are unaffected**

```bash
npm run test
```

Expected: all tests pass (the tests only cover `computeStats` and `computeAo` which are unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSolveHistory.ts
git commit -m "feat: useSolveHistory supports Firestore via cloudConfig param"
```

---

## Task 5: Wire cloudConfig through TimerScreen

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Add `cloudConfig` to TimerScreen's Props interface and forward it**

Find the `Props` interface (line 25) and the `useSolveHistory()` call (line 57).

In the `Props` interface, add:
```typescript
  cloudConfig?: CloudConfig
```

Add the import at the top of the file (with the existing imports):
```typescript
import type { CloudConfig } from '../hooks/useSolveHistory'
```

In the destructured props (line 42), add `cloudConfig` to the list:
```typescript
export function TimerScreen({
  driver,
  facelets,
  quaternion,
  onResetGyro,
  onResetState,
  isSolvingRef,
  gestureResetRef,
  driverVersion = 0,
  driverType,
  interactive,
  onCubeMove,
  cloudConfig,
}: Props) {
```

Change the `useSolveHistory()` call (line 57) to:
```typescript
  const { solves, addSolve, deleteSolve, stats, nextId } = useSolveHistory(cloudConfig)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: TimerScreen forwards cloudConfig to useSolveHistory"
```

---

## Task 6: Add useCloudSync to App.tsx and debug UI

**Files:**
- Modify: `src/App.tsx`

This task wires `useCloudSync` in `App.tsx`, passes `cloudConfig` to `TimerScreen`, and adds a debug panel showing auth status and the enable/disable toggle.

- [ ] **Step 1: Add the `useCloudSync` import and call in `App.tsx`**

Add to imports at top of `src/App.tsx`:
```typescript
import { useCloudSync } from './hooks/useCloudSync'
```

Inside the `App()` function body, after the existing hooks (e.g. after the `battery` state), add:
```typescript
  const cloudSync = useCloudSync()
  const cloudConfig = { enabled: cloudSync.enabled, user: cloudSync.user }
```

- [ ] **Step 2: Pass `cloudConfig` to `TimerScreen`**

In the `TimerScreen` JSX element, add the `cloudConfig` prop:
```tsx
        <TimerScreen
          driver={driver}
          status={status}
          facelets={facelets}
          quaternion={quaternion}
          onConnect={connect}
          onDisconnect={disconnect}
          onResetGyro={resetGyro}
          onResetState={resetState}
          isSolvingRef={isSolvingRef}
          gestureResetRef={gestureResetRef}
          driverVersion={driverVersion}
          driverType={driverType}
          interactive={driverType === 'mouse'}
          onCubeMove={handleCubeMove}
          cloudConfig={cloudConfig}
        />
```

- [ ] **Step 3: Add cloud sync debug panel in the debug section of `App.tsx`**

In the debug section (inside `mode === 'debug'`), add this block **before** the existing debug buttons div (the one with "Clear localStorage"):

```tsx
          <div style={{
            fontFamily: 'monospace',
            fontSize: 11,
            background: '#111',
            color: '#ccc',
            padding: '12px 16px',
            borderRadius: 6,
            marginTop: 8,
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#aaa' }}>Cloud Sync (Firebase)</div>

            {cloudSync.authLoading ? (
              <div style={{ color: '#666' }}>Loading auth...</div>
            ) : cloudSync.user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: '#4c4' }}>Signed in as {cloudSync.user.email}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cloudSync.enabled}
                      onChange={(e) => e.target.checked ? cloudSync.enable() : cloudSync.disable()}
                    />
                    Enable cloud sync
                  </label>
                </div>
                <button
                  onClick={cloudSync.signOut}
                  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: 'pointer', background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: 3, fontSize: 11 }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: '#888' }}>Not signed in</div>
                <button
                  onClick={cloudSync.signIn}
                  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: 'pointer', background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: 3, fontSize: 11 }}
                >
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
```

- [ ] **Step 4: Verify TypeScript compiles and dev server starts**

```bash
npm run build
```

Expected: no errors.

```bash
npm run dev
```

Open in Chrome, switch to debug mode, verify the Cloud Sync panel appears.

- [ ] **Step 5: Manual smoke test**

1. Click "Sign in with Google" — Google popup should appear, sign in works
2. Enable the checkbox — cloud sync enabled
3. Add a solve (switch to timer mode, do a solve)
4. Open the app in a second browser/tab signed in to the same account — solve should appear

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/hooks/useCloudSync.ts
git commit -m "feat: add cloud sync debug panel with Google Auth and Firestore toggle"
```

---

## Task 7: GitHub Actions deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

`vite.config.ts` already has `base: '/sans_cube/'` so no change needed there.

- [ ] **Step 1: Add Firebase config as GitHub Actions secrets**

In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret, add one secret per line from `.env.local`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

> Note: Firebase web API keys are not secret in the traditional sense (they're safe to expose in browsers — Firestore security rules enforce access control). But storing them as GitHub secrets keeps them out of your git history and is good practice.

- [ ] **Step 2: In your GitHub repo → Settings → Pages, set source to "GitHub Actions"**

- [ ] **Step 3: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 4: Add the GitHub Pages domain to Firebase Auth's authorized domains**

In Firebase Console → Authentication → Settings → Authorized domains, add:
```
sansword.github.io
```

Without this, Google Sign-In will be blocked on the deployed site.

- [ ] **Step 5: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow for GitHub Pages"
git push origin main
```

- [ ] **Step 6: Verify deployment**

Go to your repo → Actions tab. The "Deploy to GitHub Pages" workflow should run and succeed. The app will be live at `https://sansword.github.io/sans_cube/`.

---

## Self-Review

**Spec coverage:**
- ✅ Default localStorage behavior unchanged (cloudConfig is optional, defaults to off)
- ✅ Opt-in toggle in debug section
- ✅ Google Sign-In required before enabling
- ✅ Multi-user: each user's solves are isolated under `users/{uid}/solves`
- ✅ Firebase only (no dual-write) — simplest path for cross-device testing
- ✅ Migration: existing localStorage solves are pushed to Firestore on first enable
- ✅ GitHub Pages deployment with Firebase config via secrets

**Placeholder scan:** No TBDs, all code blocks are complete.

**Type consistency:**
- `CloudConfig` defined in `useSolveHistory.ts`, imported in `TimerScreen.tsx` — consistent
- `cloudSolves` / `localSolves` are both `SolveRecord[]` — consistent
- Firestore doc ID = `String(solve.date)` used consistently in `solveDocRef` and all callers — consistent
- `useCloudSync` returns `enable/disable` (verbs), consumed as `cloudSync.enable()` / `cloudSync.disable()` — consistent

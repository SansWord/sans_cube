# Cache Loaded Solves Across Timer/Debug Toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `useSolveHistory` (re-mounted per timer/debug toggle, plus 5 duplicate debug-mode reads) with a module-level singleton store that holds the signed-in user's solves across the whole app session and is shared by timer mode, debug mode, and the acubemy import flow.

**Architecture:**
- Module-level singleton `src/stores/solveStore.ts` owns `solves`, `dismissedExamples`, `status`, `error`, `cloudReady`. Subscribers read via React 18 `useSyncExternalStore`.
- Thin hook `src/hooks/useSolveStore.ts` wraps the singleton so components keep the same `{ solves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading }` shape (plus a few new fields).
- Pure helpers (`computeAo`, `computeStats`, `filterSolves`) move out to `src/utils/solveStats.ts`; they have nothing to do with state management.
- `App.tsx` drives the store with a single `useEffect(() => solveStore.configure(cloudConfig), [cloudConfig])` — everywhere else just reads the store.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Firebase Firestore. First use of `vi.mock` in the project — for the `firestoreSolves` service module.

**Spec:** [`docs/superpowers/specs/2026-04-20-cache-solves-across-toggles-design.md`](../specs/2026-04-20-cache-solves-across-toggles-design.md)

---

## File Structure

**Create:**
- `src/stores/solveStore.ts` — module-level singleton; state + CRUD + bulk + lifecycle + migration, backed by localStorage and Firestore services.
- `src/hooks/useSolveStore.ts` — `useSyncExternalStore` wrapper returning the ergonomic object consumers expect.
- `src/utils/solveStats.ts` — pure helpers extracted from `useSolveHistory`: `computeAo`, `computeStats`, `filterSolves`, plus the shared `StatEntry` / `SolveStats` types.
- `tests/stores/solveStore.test.ts` — unit tests with `vi.mock`'d firestoreSolves service.
- `tests/hooks/useSolveStore.test.tsx` — thin hook/integration tests.
- `tests/utils/solveStats.test.ts` — pure stats tests (ported from `tests/hooks/useSolveHistory.test.ts`).

**Modify:**
- `src/App.tsx` — add `configure()` effect, replace 5 direct Firestore calls (lines 126, 342, 410, 425, 440) and 3 debug handlers with store methods, add "Refresh" button.
- `src/components/TimerScreen.tsx` — swap `useSolveHistory(cloudConfig)` for `useSolveStore()`; drop `cloudConfig?` prop (still accepted for share/unshare but no longer piped to a hook).
- `src/components/SolveHistorySidebar.tsx` — change imports from `'../hooks/useSolveHistory'` to `'../utils/solveStats'`.
- `src/components/TrendsModal.tsx` — change `filterSolves` import to `'../utils/solveStats'`.
- `src/components/AcubemyImportModal.tsx` — change `CloudConfig` import to `'../stores/solveStore'` (store re-exports the type).
- `tests/filterSolves.test.ts` — change `filterSolves` import to `'../src/utils/solveStats'`.
- `tests/components/AcubemyImportModal.test.tsx` — change `CloudConfig` import to `'../../src/stores/solveStore'`.
- `docs/ui-architecture.md` — rewrite the `App` and `TimerScreen` hook-ownership sections; add a "Stores" section for the new module-level state.
- `docs/debug-mode.md` — document the new **Refresh solves** button + mention the consolidated store.
- `docs/manual-test-checklist.md` — append cache/toggle QA entries.
- `docs/devlog.md` — new `vX.Y.0 — Shared solve store` entry + TL;DR row.
- `future.md` — cross out the "Cache loaded Firestore solves across debug/timer toggles" line.

**Delete:**
- `src/hooks/useSolveHistory.ts` — entire file gone.
- `tests/hooks/useSolveHistory.test.ts` — replaced by `tests/utils/solveStats.test.ts` + `tests/stores/solveStore.test.ts`.

---

## Task 1: Extract pure helpers to `src/utils/solveStats.ts`

**Files:**
- Create: `src/utils/solveStats.ts`
- Create: `tests/utils/solveStats.test.ts`
- Modify: `src/components/SolveHistorySidebar.tsx`
- Modify: `src/components/TrendsModal.tsx`
- Modify: `tests/filterSolves.test.ts`

Goal: move `computeAo`, `computeStats`, `filterSolves`, `StatEntry`, `SolveStats` out of `useSolveHistory.ts` without changing any behavior. Do this first so later tasks can edit `useSolveHistory.ts` aggressively without worrying about these imports.

- [ ] **Step 1: Write the failing test file at the new location**

Create `tests/utils/solveStats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeAo, computeStats, filterSolves } from '../../src/utils/solveStats'
import type { SolveRecord, SolveFilter } from '../../src/types/solve'

function makeSolve(id: number, timeMs: number): SolveRecord {
  return { id, scramble: '', timeMs, moves: [], phases: [], date: 0 }
}

describe('computeAo', () => {
  it('returns null when not enough solves', () => {
    expect(computeAo([makeSolve(1, 20000), makeSolve(2, 22000)], 5)).toBeNull()
  })

  it('computes ao5 dropping best and worst', () => {
    const solves = [10000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    expect(computeAo(solves, 5)).toBeCloseTo(30000)
  })

  it('ao5 uses last 5 solves', () => {
    const solves = [10000, 99000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    expect(computeAo(solves, 5)).toBeCloseTo(40000)
  })

  it('computes ao1 (single) without dropping', () => {
    expect(computeAo([makeSolve(1, 23000)], 1)).toBeCloseTo(23000)
  })
})

describe('computeStats', () => {
  it('returns null stats when no solves', () => {
    const stats = computeStats([])
    expect(stats.single.current).toBeNull()
    expect(stats.single.best).toBeNull()
  })

  it('returns single time when one solve', () => {
    const stats = computeStats([makeSolve(1, 23000)])
    expect(stats.single.current).toBeCloseTo(23000)
    expect(stats.single.best).toBeCloseTo(23000)
  })

  it('best single is the lowest time', () => {
    const solves = [makeSolve(1, 30000), makeSolve(2, 20000), makeSolve(3, 25000)]
    const stats = computeStats(solves)
    expect(stats.single.best).toBeCloseTo(20000)
    expect(stats.single.current).toBeCloseTo(25000)
  })
})

describe('filterSolves (smoke)', () => {
  it('all+all returns every solve', () => {
    const s1 = { ...makeSolve(1, 10000), method: 'cfop', driver: 'cube' as const }
    const s2 = { ...makeSolve(2, 12000), method: 'roux', driver: 'mouse' as const }
    const f: SolveFilter = { method: 'all', driver: 'all' }
    expect(filterSolves([s1, s2], f)).toEqual([s1, s2])
  })
})
```

- [ ] **Step 2: Run the test — expect it to fail because the file doesn't exist**

Run: `npm run test -- tests/utils/solveStats.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/utils/solveStats"`.

- [ ] **Step 3: Create `src/utils/solveStats.ts`**

```typescript
import type { SolveRecord, SolveFilter } from '../types/solve'

export interface StatEntry {
  current: number | null
  best: number | null
}

export interface SolveStats {
  single: StatEntry
  ao5: StatEntry
  ao12: StatEntry
  ao100: StatEntry
}

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

export function filterSolves(solves: SolveRecord[], filter: SolveFilter): SolveRecord[] {
  let result = solves
  if (filter.method !== 'all')
    result = result.filter(s => s.isExample || (s.method ?? 'cfop') === filter.method)
  if (filter.driver !== 'all')
    result = result.filter(s => s.isExample || (s.driver ?? 'cube') === filter.driver)
  return result
}
```

- [ ] **Step 4: Re-export from `useSolveHistory.ts` to avoid breaking imports mid-migration**

In `src/hooks/useSolveHistory.ts`, delete the in-file definitions of `computeAo`, `bestAo`, `computeStats`, `filterSolves`, `StatEntry`, `SolveStats` and replace with a re-export at the top of the file (right after the existing `import` block):

```typescript
// Re-export for back-compat during the solveStore migration; will be removed in a later task.
export { computeAo, computeStats, filterSolves } from '../utils/solveStats'
export type { StatEntry, SolveStats } from '../utils/solveStats'
```

Also update the internal `computeStats` usage inside this file — but there is none (hook doesn't use `computeStats` itself); `computeAo` is used only inside the now-extracted helpers. So no other changes needed in this file for this task.

- [ ] **Step 5: Run both tests — solveStats passes; old useSolveHistory tests still pass via the re-export**

Run: `npm run test -- tests/utils/solveStats.test.ts tests/hooks/useSolveHistory.test.ts tests/filterSolves.test.ts`
Expected: all pass.

- [ ] **Step 6: Update imports in the three consumer files**

In `src/components/SolveHistorySidebar.tsx` replace:

```typescript
import { computeStats, filterSolves, type StatEntry, type SolveStats } from '../hooks/useSolveHistory'
```

with:

```typescript
import { computeStats, filterSolves, type StatEntry, type SolveStats } from '../utils/solveStats'
```

In `src/components/TrendsModal.tsx` replace:

```typescript
import { filterSolves } from '../hooks/useSolveHistory'
```

with:

```typescript
import { filterSolves } from '../utils/solveStats'
```

In `tests/filterSolves.test.ts` replace:

```typescript
import { filterSolves } from '../src/hooks/useSolveHistory'
```

with:

```typescript
import { filterSolves } from '../src/utils/solveStats'
```

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm run test`
Expected: all green.

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/utils/solveStats.ts tests/utils/solveStats.test.ts \
  src/hooks/useSolveHistory.ts src/components/SolveHistorySidebar.tsx \
  src/components/TrendsModal.tsx tests/filterSolves.test.ts
git commit -m "refactor: extract pure solve-stat helpers to src/utils/solveStats"
```

---

## Task 2: Add `__resetForTests` and `bulkAddSolvesToFirestore` helper plumbing for the store

**Files:**
- Modify: `src/services/firestoreSolves.ts`

The store will expose `__resetForTests()` itself. But we also want test-friendly service boundaries. Currently `migrateLocalSolvesToFirestore` already uses `Promise.all` per item — the store will rely on that existing API. `addMany` will chunk-by-100 using `Promise.allSettled` directly inside the store (so no new service helper is strictly needed). Double-check by reading `src/services/firestoreSolves.ts` — confirm no new symbols required, just the existing ones. If that check passes, skip this task's code changes and proceed to Task 3.

- [ ] **Step 1: Confirm no service changes required**

Run: `grep -n "^export " src/services/firestoreSolves.ts`
Expected output includes: `loadSolvesFromFirestore`, `addSolveToFirestore`, `updateSolveInFirestore`, `deleteSolveFromFirestore`, `migrateLocalSolvesToFirestore`, `loadNextSeqFromFirestore`, `updateCounterInFirestore`, `bulkUpdateSolvesInFirestore`, `renumberSolvesInFirestore`, `recalibrateSolvesInFirestore`, `migrateSolvesToV2InFirestore`.

- [ ] **Step 2: No commit — this task is a verification step only**

If anything is missing, stop and surface the gap before continuing. Otherwise proceed to Task 3.

---

## Task 3: Create the store skeleton — state shape + `subscribe` / `getSnapshot` / `__resetForTests`

**Files:**
- Create: `src/stores/solveStore.ts`
- Create: `tests/stores/solveStore.test.ts`

- [ ] **Step 1: Write the failing test for the initial snapshot**

Create `tests/stores/solveStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

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

import { solveStore, __resetForTests } from '../../src/stores/solveStore'

describe('solveStore — initial snapshot', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
  })

  it('getSnapshot returns a default StoreState before configure() is called', () => {
    const s = solveStore.getSnapshot()
    expect(s.solves).toEqual([])
    expect(s.dismissedExamples).toBeInstanceOf(Set)
    expect(s.dismissedExamples.size).toBe(0)
    expect(s.status).toBe('idle')
    expect(s.error).toBeNull()
    expect(s.cloudReady).toBe(false)
  })

  it('subscribe returns an unsubscribe function', () => {
    const listener = vi.fn()
    const unsub = solveStore.subscribe(listener)
    expect(typeof unsub).toBe('function')
    unsub()
  })
})
```

- [ ] **Step 2: Run the test — expect the import to fail**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/stores/solveStore"`.

- [ ] **Step 3: Create the skeleton store**

Create `src/stores/solveStore.ts`:

```typescript
import type { User } from 'firebase/auth'
import type { SolveRecord } from '../types/solve'

export interface CloudConfig {
  enabled: boolean
  user: User | null
  authLoading?: boolean
}

export type Status = 'idle' | 'loading' | 'refreshing' | 'error'

export interface StoreState {
  solves: SolveRecord[]
  dismissedExamples: Set<number>
  status: Status
  error: string | null
  cloudReady: boolean
}

function initialState(): StoreState {
  return {
    solves: [],
    dismissedExamples: new Set<number>(),
    status: 'idle',
    error: null,
    cloudReady: false,
  }
}

let state: StoreState = initialState()
const listeners = new Set<() => void>()

function notify(): void {
  for (const l of listeners) l()
}

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch }
  notify()
}

export const solveStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getSnapshot(): StoreState {
    return state
  },
}

export function __resetForTests(): void {
  state = initialState()
  listeners.clear()
}

// HMR: when this module hot-reloads, wipe state so stale closures don't stick around.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { __resetForTests() })
}

// Internal setState — exported for implementation files in later tasks.
export const _internal = { setState, notify }
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/solveStore.ts tests/stores/solveStore.test.ts
git commit -m "feat(solveStore): skeleton with state, subscribe, getSnapshot"
```

---

## Task 4: `configure()` — local-only path (cloud off)

**Files:**
- Modify: `src/stores/solveStore.ts`
- Modify: `tests/stores/solveStore.test.ts`

Covers the "first call, cloud off" row and the "cloud on → off" row of the configuration matrix. Cloud paths come in Task 5.

- [ ] **Step 1: Write failing tests for local configure**

Append to `tests/stores/solveStore.test.ts` (inside a new `describe('solveStore — configure (local)')`):

```typescript
import { STORAGE_KEYS } from '../../src/utils/storageKeys'
import type { SolveRecord } from '../../src/types/solve'

function localSolve(id: number): SolveRecord {
  return { id, seq: id, scramble: '', timeMs: 1000 * id, moves: [], phases: [], date: id, schemaVersion: 2 }
}

describe('solveStore — configure (local)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
  })

  it('loads solves from localStorage synchronously when cloud is off', () => {
    const solves = [localSolve(1), localSolve(2)]
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify(solves))
    solveStore.configure({ enabled: false, user: null })
    const s = solveStore.getSnapshot()
    expect(s.solves).toHaveLength(2)
    expect(s.status).toBe('idle')
    expect(s.cloudReady).toBe(false)
  })

  it('loads dismissedExamples from localStorage', () => {
    localStorage.setItem(STORAGE_KEYS.DISMISSED_EXAMPLES, JSON.stringify([-1, -2]))
    solveStore.configure({ enabled: false, user: null })
    const s = solveStore.getSnapshot()
    expect([...s.dismissedExamples].sort()).toEqual([-2, -1])
  })

  it('second call with the same tuple is a no-op (solves reference is stable)', () => {
    solveStore.configure({ enabled: false, user: null })
    const before = solveStore.getSnapshot()
    solveStore.configure({ enabled: false, user: null })
    const after = solveStore.getSnapshot()
    expect(after.solves).toBe(before.solves)
  })
})
```

The test signature expects `solveStore.configure(config)` — add that to the exports.

- [ ] **Step 2: Run the tests — expect fail**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: FAIL — `solveStore.configure is not a function`.

- [ ] **Step 3: Implement the local-only `configure()` path**

In `src/stores/solveStore.ts`, add at the top of the file:

```typescript
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { migrateSolveV1toV2 } from '../utils/migrateSolveV1toV2'
```

Add these helpers above `export const solveStore`:

```typescript
function loadLocalSolves(): SolveRecord[] {
  const raw = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
  const migrated = raw.map(s => {
    if ((s.schemaVersion ?? 1) < 2) {
      const result = migrateSolveV1toV2(s)
      const { movesV1: _, ...toSave } = result
      return toSave
    }
    return s
  })
  if (migrated.some((s, i) => s !== raw[i])) {
    saveToStorage(STORAGE_KEYS.SOLVES, migrated)
  }
  return migrated
}

function loadDismissedExamples(): Set<number> {
  return new Set(loadFromStorage<number[]>(STORAGE_KEYS.DISMISSED_EXAMPLES, []))
}

let lastConfigKey: string | null = null

function configKey(config: CloudConfig): string {
  const enabled = !!(config.enabled && config.user)
  return `${enabled ? '1' : '0'}:${config.user?.uid ?? ''}`
}
```

Replace the existing `export const solveStore = { … }` block with:

```typescript
export const solveStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getSnapshot(): StoreState {
    return state
  },
  configure(config: CloudConfig): void {
    const key = configKey(config)
    if (key === lastConfigKey) return
    lastConfigKey = key

    const useCloud = !!(config.enabled && config.user)
    const solves = loadLocalSolves()
    const dismissedExamples = loadDismissedExamples()

    if (!useCloud) {
      setState({ solves, dismissedExamples, status: 'idle', error: null, cloudReady: false })
      return
    }

    // Cloud path — implemented in the next task.
    setState({ solves, dismissedExamples, status: 'loading', error: null, cloudReady: false })
  },
}
```

Also update `__resetForTests()` to reset `lastConfigKey`:

```typescript
export function __resetForTests(): void {
  state = initialState()
  listeners.clear()
  lastConfigKey = null
}
```

- [ ] **Step 4: Run the tests — expect pass**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/solveStore.ts tests/stores/solveStore.test.ts
git commit -m "feat(solveStore): configure() local path — load from localStorage, idempotent on repeat"
```

---

## Task 5: `configure()` — cloud path, migration, `uid` transitions, sign-out

**Files:**
- Modify: `src/stores/solveStore.ts`
- Modify: `tests/stores/solveStore.test.ts`

- [ ] **Step 1: Write failing tests for the cloud path**

Append to `tests/stores/solveStore.test.ts`:

```typescript
import * as firestoreMock from '../../src/services/firestoreSolves'
import type { User } from 'firebase/auth'

const U1 = { uid: 'u1', email: 'u1@x.co' } as unknown as User
const U2 = { uid: 'u2', email: 'u2@x.co' } as unknown as User

describe('solveStore — configure (cloud)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([])
    vi.mocked(firestoreMock.loadNextSeqFromFirestore).mockResolvedValue(1)
    vi.mocked(firestoreMock.migrateLocalSolvesToFirestore).mockResolvedValue(undefined)
  })

  it('cloud-enabled first call enters loading, then idle + cloudReady after fetch', async () => {
    const remote = [localSolve(10), localSolve(11)]
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue(remote)
    solveStore.configure({ enabled: true, user: U1 })
    expect(solveStore.getSnapshot().status).toBe('loading')
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    const s = solveStore.getSnapshot()
    expect(s.cloudReady).toBe(true)
    expect(s.solves.map(x => x.id).sort()).toEqual([10, 11])
  })

  it('runs one-time localStorage→Firestore migration when local solves exist', async () => {
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify([localSolve(1)]))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    expect(firestoreMock.migrateLocalSolvesToFirestore).toHaveBeenCalledTimes(1)
  })

  it('does not re-run migration for the same uid on repeat configure()', async () => {
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify([localSolve(1)]))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    expect(firestoreMock.migrateLocalSolvesToFirestore).toHaveBeenCalledTimes(1)
  })

  it('uid change re-fetches', async () => {
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockClear()
    solveStore.configure({ enabled: true, user: U2 })
    expect(solveStore.getSnapshot().cloudReady).toBe(false)
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    expect(firestoreMock.loadSolvesFromFirestore).toHaveBeenCalledWith('u2')
  })

  it('cloud-on → cloud-off reverts to localStorage view with status=idle', async () => {
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify([localSolve(5)]))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    solveStore.configure({ enabled: false, user: null })
    const s = solveStore.getSnapshot()
    expect(s.status).toBe('idle')
    expect(s.cloudReady).toBe(false)
    expect(s.solves.map(x => x.id)).toEqual([5])
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: FAIL — cloud path not implemented (remains at `status: 'loading'` forever).

- [ ] **Step 3: Implement the cloud path**

In `src/stores/solveStore.ts`, add the imports:

```typescript
import {
  loadSolvesFromFirestore,
  loadNextSeqFromFirestore,
  migrateLocalSolvesToFirestore,
} from '../services/firestoreSolves'
```

Add above `export const solveStore`:

```typescript
const migratedUids = new Set<string>()
let nextId: number = 1
let activeLoadToken = 0

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

async function doCloudLoad(uid: string, localSolves: SolveRecord[], token: number): Promise<void> {
  if (!migratedUids.has(uid) && localSolves.length > 0) {
    migratedUids.add(uid)
    await migrateLocalSolvesToFirestore(uid, localSolves)
  }
  const [solves, nextSeq] = await Promise.all([
    loadSolvesFromFirestore(uid),
    loadNextSeqFromFirestore(uid),
  ])
  if (token !== activeLoadToken) return
  if (nextSeq > nextId) {
    nextId = nextSeq
    saveNextId(nextId)
  }
  setState({ solves, status: 'idle', cloudReady: true, error: null })
}
```

Replace the cloud branch in `configure()`:

```typescript
  configure(config: CloudConfig): void {
    const key = configKey(config)
    if (key === lastConfigKey) return
    lastConfigKey = key

    const useCloud = !!(config.enabled && config.user)
    const localSolves = loadLocalSolves()
    const dismissedExamples = loadDismissedExamples()
    nextId = Math.max(
      loadNextId(),
      localSolves.length > 0 ? Math.max(...localSolves.map(s => s.id)) + 1 : 1,
    )

    if (!useCloud) {
      activeLoadToken++
      setState({ solves: localSolves, dismissedExamples, status: 'idle', error: null, cloudReady: false })
      return
    }

    const uid = config.user!.uid
    activeLoadToken++
    const token = activeLoadToken
    setState({ solves: localSolves, dismissedExamples, status: 'loading', error: null, cloudReady: false })
    doCloudLoad(uid, localSolves, token).catch((e) => {
      if (token !== activeLoadToken) return
      setState({ status: 'error', error: String(e) })
    })
  },
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/solveStore.ts tests/stores/solveStore.test.ts
git commit -m "feat(solveStore): configure() cloud path — fetch, per-uid migration guard, sign-out"
```

---

## Task 6: Single-record CRUD — `addSolve`, `updateSolve`, `deleteSolve`, `dismissExample`, `nextSolveIds`

**Files:**
- Modify: `src/stores/solveStore.ts`
- Modify: `tests/stores/solveStore.test.ts`

- [ ] **Step 1: Write failing tests for CRUD**

Append to `tests/stores/solveStore.test.ts`:

```typescript
describe('solveStore — CRUD (local mode)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    solveStore.configure({ enabled: false, user: null })
  })

  it('addSolve appends and persists to localStorage', async () => {
    await solveStore.addSolve(localSolve(1))
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([1])
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.SOLVES) ?? '[]') as SolveRecord[]
    expect(raw.map(s => s.id)).toEqual([1])
  })

  it('updateSolve replaces by id', async () => {
    await solveStore.addSolve({ ...localSolve(1), method: 'cfop' })
    await solveStore.updateSolve({ ...localSolve(1), method: 'roux' })
    expect(solveStore.getSnapshot().solves[0].method).toBe('roux')
  })

  it('deleteSolve removes by id', async () => {
    await solveStore.addSolve(localSolve(1))
    await solveStore.addSolve(localSolve(2))
    await solveStore.deleteSolve(1)
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([2])
  })

  it('deleteSolve(-1) routes to dismissExample', async () => {
    await solveStore.deleteSolve(-1)
    expect(solveStore.getSnapshot().dismissedExamples.has(-1)).toBe(true)
  })

  it('addSolve({ isExample: true }) is a no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await solveStore.addSolve({ ...localSolve(99), isExample: true })
    expect(solveStore.getSnapshot().solves).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('nextSolveIds increments seq and persists', () => {
    const a = solveStore.nextSolveIds()
    const b = solveStore.nextSolveIds()
    expect(b.seq).toBe(a.seq + 1)
    expect(localStorage.getItem(STORAGE_KEYS.NEXT_ID)).toBe(String(b.seq + 1))
  })
})

describe('solveStore — CRUD (cloud mode, optimistic + rollback)', () => {
  beforeEach(async () => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([])
    vi.mocked(firestoreMock.loadNextSeqFromFirestore).mockResolvedValue(1)
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
  })

  it('addSolve success — record stays in state, Firestore add called', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await solveStore.addSolve(localSolve(1))
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([1])
    expect(firestoreMock.addSolveToFirestore).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 1 }))
  })

  it('addSolve failure — state rolled back, error set, original thrown', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockRejectedValue(new Error('boom'))
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await expect(solveStore.addSolve(localSolve(1))).rejects.toThrow('boom')
    const s = solveStore.getSnapshot()
    expect(s.solves).toEqual([])
    expect(s.error).toMatch(/boom/)
  })

  it('updateSolve failure rolls back', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await solveStore.addSolve({ ...localSolve(1), method: 'cfop' })
    vi.mocked(firestoreMock.updateSolveInFirestore).mockRejectedValue(new Error('write failed'))
    await expect(solveStore.updateSolve({ ...localSolve(1), method: 'roux' })).rejects.toThrow('write failed')
    expect(solveStore.getSnapshot().solves[0].method).toBe('cfop')
  })

  it('deleteSolve failure rolls back', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await solveStore.addSolve(localSolve(1))
    vi.mocked(firestoreMock.deleteSolveFromFirestore).mockRejectedValue(new Error('nope'))
    await expect(solveStore.deleteSolve(1)).rejects.toThrow('nope')
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([1])
  })
})
```

- [ ] **Step 2: Run the tests — expect fail**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: FAIL — CRUD methods not implemented.

- [ ] **Step 3: Implement CRUD inside the store**

In `src/stores/solveStore.ts`, add imports:

```typescript
import {
  addSolveToFirestore,
  updateSolveInFirestore,
  deleteSolveFromFirestore,
  updateCounterInFirestore,
} from '../services/firestoreSolves'
import { updateSharedSolve } from '../services/firestoreSharing'
```

Keep a cached `lastCloudConfig: CloudConfig | null` so CRUD methods know whether to write to cloud or local. Update the module-level state:

```typescript
let lastCloudConfig: CloudConfig | null = null
```

Inside `configure()`, set `lastCloudConfig = config` at the top (right after the idempotency check). Add to `__resetForTests()`:

```typescript
  lastCloudConfig = null
  migratedUids.clear()
```

Add these methods inside the `solveStore` object (alongside `configure`):

```typescript
  nextSolveIds(): { id: number; seq: number } {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const seq = nextId
    nextId = seq + 1
    saveNextId(nextId)
    return { id: useCloud ? Date.now() : seq, seq }
  },

  dismissExample(id: number): void {
    const dismissedExamples = new Set(state.dismissedExamples)
    dismissedExamples.add(id)
    saveToStorage(STORAGE_KEYS.DISMISSED_EXAMPLES, [...dismissedExamples])
    setState({ dismissedExamples })
  },

  async addSolve(solve: SolveRecord): Promise<void> {
    if (solve.isExample) { console.warn('solveStore.addSolve called with example solve; ignored'); return }
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null
    const snapshot = state.solves
    setState({ solves: [...snapshot, solve] })
    try {
      if (useCloud && uid) {
        const nextSeq = (solve.seq ?? 0) + 1
        await Promise.all([
          addSolveToFirestore(uid, solve),
          updateCounterInFirestore(uid, nextSeq),
        ])
      } else {
        saveToStorage(STORAGE_KEYS.SOLVES, [...snapshot, solve])
      }
      if (state.error) setState({ error: null })
    } catch (e) {
      setState({ solves: snapshot, error: String(e) })
      throw e
    }
  },

  async updateSolve(updated: SolveRecord): Promise<void> {
    if (updated.isExample) { console.warn('solveStore.updateSolve called with example solve; ignored'); return }
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null
    const snapshot = state.solves
    const next = snapshot.map(s => s.id === updated.id ? updated : s)
    setState({ solves: next })
    try {
      if (useCloud && uid) {
        await updateSolveInFirestore(uid, updated)
        if (updated.shareId) {
          void updateSharedSolve(updated.shareId, updated)
        }
      } else {
        saveToStorage(STORAGE_KEYS.SOLVES, next)
      }
      if (state.error) setState({ error: null })
    } catch (e) {
      setState({ solves: snapshot, error: String(e) })
      throw e
    }
  },

  async deleteSolve(id: number): Promise<void> {
    if (id < 0) { this.dismissExample(id); return }
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null
    const snapshot = state.solves
    const target = snapshot.find(s => s.id === id)
    if (!target) return
    const next = snapshot.filter(s => s.id !== id)
    setState({ solves: next })
    try {
      if (useCloud && uid) {
        await deleteSolveFromFirestore(uid, target)
      } else {
        saveToStorage(STORAGE_KEYS.SOLVES, next)
      }
      if (state.error) setState({ error: null })
    } catch (e) {
      setState({ solves: snapshot, error: String(e) })
      throw e
    }
  },
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/solveStore.ts tests/stores/solveStore.test.ts
git commit -m "feat(solveStore): CRUD with optimistic writes and rollback on failure"
```

---

## Task 7: `addMany` — chunked `Promise.allSettled` bulk insert

**Files:**
- Modify: `src/stores/solveStore.ts`
- Modify: `tests/stores/solveStore.test.ts`

- [ ] **Step 1: Write failing tests for `addMany`**

Append to `tests/stores/solveStore.test.ts`:

```typescript
describe('solveStore — addMany', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([])
    vi.mocked(firestoreMock.loadNextSeqFromFirestore).mockResolvedValue(1)
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
  })

  it('local mode: appends synchronously, persists once', async () => {
    solveStore.configure({ enabled: false, user: null })
    const drafts = [localSolve(1), localSolve(2), localSolve(3)]
    const result = await solveStore.addMany(drafts)
    expect(result.committed).toHaveLength(3)
    expect(result.failed).toEqual([])
    expect(solveStore.getSnapshot().solves).toHaveLength(3)
    expect(firestoreMock.addSolveToFirestore).not.toHaveBeenCalled()
  })

  it('cloud mode: 1 chunk all success', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    const drafts = Array.from({ length: 50 }, (_, i) => localSolve(100 + i))
    const result = await solveStore.addMany(drafts)
    expect(result.committed).toHaveLength(50)
    expect(result.failed).toEqual([])
  })

  it('cloud mode: 250 drafts → 3 chunks with progress ticks', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    const drafts = Array.from({ length: 250 }, (_, i) => localSolve(100 + i))
    const onProgress = vi.fn()
    const result = await solveStore.addMany(drafts, onProgress)
    expect(result.committed).toHaveLength(250)
    // onProgress fires once per chunk completion: (1,3) (2,3) (3,3)
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
  })

  it('cloud mode: partial failures are collected and rolled back', async () => {
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    vi.mocked(firestoreMock.addSolveToFirestore).mockImplementation(async (_uid, s) => {
      if (s.id === 102 || s.id === 105) throw new Error(`fail-${s.id}`)
    })
    const drafts = Array.from({ length: 10 }, (_, i) => localSolve(100 + i))
    const result = await solveStore.addMany(drafts)
    expect(result.committed.map(s => s.id).sort()).toEqual([100, 101, 103, 104, 106, 107, 108, 109])
    expect(result.failed.map(f => f.draft.id).sort()).toEqual([102, 105])
    expect(solveStore.getSnapshot().solves.map(s => s.id).sort()).toEqual(
      [100, 101, 103, 104, 106, 107, 108, 109]
    )
  })

  it('cloud mode: subsequent chunks keep running after earlier-chunk failures', async () => {
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    vi.mocked(firestoreMock.addSolveToFirestore).mockImplementation(async (_uid, s) => {
      if (s.id < 110) throw new Error('first-chunk-fail')
    })
    const drafts = Array.from({ length: 150 }, (_, i) => localSolve(100 + i))
    const result = await solveStore.addMany(drafts)
    expect(result.committed.some(s => s.id === 149)).toBe(true)
    expect(result.failed).toHaveLength(10)
  })
})
```

- [ ] **Step 2: Run the tests — expect fail**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: FAIL — `solveStore.addMany is not a function`.

- [ ] **Step 3: Implement `addMany`**

Add the result type near the top of `src/stores/solveStore.ts`:

```typescript
export interface AddManyResult {
  committed: SolveRecord[]
  failed: Array<{ draft: SolveRecord; error: Error }>
}
```

Add the method inside `solveStore`:

```typescript
  async addMany(
    drafts: SolveRecord[],
    onProgress: (chunkDone: number, chunkTotal: number) => void = () => {},
  ): Promise<AddManyResult> {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null

    if (!useCloud || !uid) {
      const next = [...state.solves, ...drafts]
      setState({ solves: next })
      saveToStorage(STORAGE_KEYS.SOLVES, next)
      const maxSeq = Math.max(0, ...drafts.map(d => d.seq ?? 0))
      if (maxSeq + 1 > nextId) {
        nextId = maxSeq + 1
        saveNextId(nextId)
      }
      onProgress(1, 1)
      return { committed: [...drafts], failed: [] }
    }

    // Cloud path — optimistic append all, then chunk through setDoc with allSettled.
    setState({ solves: [...state.solves, ...drafts] })

    const CHUNK = 100
    const chunks: SolveRecord[][] = []
    for (let i = 0; i < drafts.length; i += CHUNK) chunks.push(drafts.slice(i, i + CHUNK))

    const failed: Array<{ draft: SolveRecord; error: Error }> = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const results = await Promise.allSettled(
        chunk.map(d => addSolveToFirestore(uid, d))
      )
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        if (r.status === 'rejected') {
          failed.push({ draft: chunk[j], error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)) })
        }
      }
      onProgress(i + 1, chunks.length)
    }

    // Update counter to the max seq we intended to commit.
    const maxSeq = Math.max(0, ...drafts.map(d => d.seq ?? 0))
    try {
      await updateCounterInFirestore(uid, maxSeq + 1)
    } catch {
      // Counter write is best-effort; per-solve writes already reflect reality.
    }

    // Roll back failed drafts in a single state update.
    if (failed.length > 0) {
      const failedIds = new Set(failed.map(f => f.draft.id))
      setState({ solves: state.solves.filter(s => !failedIds.has(s.id)) })
    }

    const committedIds = new Set(drafts.map(d => d.id))
    for (const f of failed) committedIds.delete(f.draft.id)
    const committed = drafts.filter(d => committedIds.has(d.id))
    return { committed, failed }
  },
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/solveStore.ts tests/stores/solveStore.test.ts
git commit -m "feat(solveStore): addMany with chunked allSettled and partial-failure rollback"
```

---

## Task 8: `reload()` and `runBulkOp()`

**Files:**
- Modify: `src/stores/solveStore.ts`
- Modify: `tests/stores/solveStore.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/stores/solveStore.test.ts`:

```typescript
describe('solveStore — reload and runBulkOp', () => {
  beforeEach(async () => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    vi.mocked(firestoreMock.loadNextSeqFromFirestore).mockResolvedValue(1)
  })

  it('reload in cloud mode refetches', async () => {
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([localSolve(1)])
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([localSolve(1), localSolve(2)])
    await solveStore.reload()
    expect(solveStore.getSnapshot().solves).toHaveLength(2)
  })

  it('reload in local mode is a no-op', async () => {
    solveStore.configure({ enabled: false, user: null })
    await solveStore.reload()
    expect(firestoreMock.loadSolvesFromFirestore).not.toHaveBeenCalled()
  })

  it('runBulkOp success: status refreshing → idle, reload runs', async () => {
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([])
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([localSolve(1)])
    const observed: string[] = []
    const unsub = solveStore.subscribe(() => observed.push(solveStore.getSnapshot().status))
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await solveStore.runBulkOp(fn)
    unsub()
    expect(result).toBe('ok')
    expect(observed).toContain('refreshing')
    expect(solveStore.getSnapshot().status).toBe('idle')
    expect(solveStore.getSnapshot().solves).toHaveLength(1)
  })

  it('runBulkOp failure: status error, no reload, error re-thrown', async () => {
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([])
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockClear()
    await expect(solveStore.runBulkOp(() => Promise.reject(new Error('oops')))).rejects.toThrow('oops')
    expect(solveStore.getSnapshot().status).toBe('error')
    expect(firestoreMock.loadSolvesFromFirestore).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: FAIL — methods not implemented.

- [ ] **Step 3: Implement `reload` and `runBulkOp`**

Extract the common fetch path so both `configure()`'s cloud branch and `reload()` can share it. Add a private helper at module scope:

```typescript
async function reloadInternal(): Promise<void> {
  const uid = lastCloudConfig?.user?.uid ?? null
  const useCloud = !!(lastCloudConfig?.enabled && uid)
  if (!useCloud || !uid) return
  activeLoadToken++
  const token = activeLoadToken
  const [solves, nextSeq] = await Promise.all([
    loadSolvesFromFirestore(uid),
    loadNextSeqFromFirestore(uid),
  ])
  if (token !== activeLoadToken) return
  if (nextSeq > nextId) {
    nextId = nextSeq
    saveNextId(nextId)
  }
  setState({ solves, cloudReady: true, error: null })
}
```

Add the methods to `solveStore`:

```typescript
  async reload(): Promise<void> {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    if (!useCloud) return
    setState({ status: 'refreshing', error: null })
    try {
      await reloadInternal()
      setState({ status: 'idle' })
    } catch (e) {
      setState({ status: 'error', error: String(e) })
      throw e
    }
  },

  async runBulkOp<T>(fn: () => Promise<T>): Promise<T> {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    setState({ status: 'refreshing', error: null })
    try {
      const result = await fn()
      if (useCloud) await reloadInternal()
      setState({ status: 'idle' })
      return result
    } catch (e) {
      setState({ status: 'error', error: String(e) })
      throw e
    }
  },
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- tests/stores/solveStore.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/solveStore.ts tests/stores/solveStore.test.ts
git commit -m "feat(solveStore): reload and runBulkOp with status transitions"
```

---

## Task 9: `useSolveStore()` hook wrapper with example composition

**Files:**
- Create: `src/hooks/useSolveStore.ts`
- Create: `tests/hooks/useSolveStore.test.tsx`

- [ ] **Step 1: Write failing integration test**

Create `tests/hooks/useSolveStore.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

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

import { useSolveStore } from '../../src/hooks/useSolveStore'
import { solveStore, __resetForTests } from '../../src/stores/solveStore'
import type { SolveRecord } from '../../src/types/solve'

function Viewer() {
  const { solves, cloudLoading } = useSolveStore()
  return (
    <div>
      <div data-testid="count">{solves.length}</div>
      <div data-testid="loading">{String(cloudLoading)}</div>
    </div>
  )
}

function makeSolve(id: number): SolveRecord {
  return { id, seq: id, scramble: '', timeMs: 1000, moves: [], phases: [], date: id, schemaVersion: 2 }
}

describe('useSolveStore', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    solveStore.configure({ enabled: false, user: null })
  })

  it('mounts and reflects current state including examples', () => {
    render(<Viewer />)
    // At minimum, examples are present.
    expect(parseInt(screen.getByTestId('count').textContent!, 10)).toBeGreaterThan(0)
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('re-renders when store state changes', async () => {
    render(<Viewer />)
    const initial = parseInt(screen.getByTestId('count').textContent!, 10)
    await act(async () => { await solveStore.addSolve(makeSolve(1)) })
    expect(parseInt(screen.getByTestId('count').textContent!, 10)).toBe(initial + 1)
  })
})
```

- [ ] **Step 2: Run the test — expect fail**

Run: `npm run test -- tests/hooks/useSolveStore.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/hooks/useSolveStore"`.

- [ ] **Step 3: Create `src/hooks/useSolveStore.ts`**

```typescript
import { useSyncExternalStore } from 'react'
import { solveStore } from '../stores/solveStore'
import type { StoreState } from '../stores/solveStore'
import { EXAMPLE_SOLVES } from '../data/exampleSolves'
import type { SolveRecord } from '../types/solve'

export function getAllSolves(state: StoreState): SolveRecord[] {
  const visibleExamples = EXAMPLE_SOLVES.filter(e => !state.dismissedExamples.has(e.id))
  return [...visibleExamples, ...state.solves]
}

export function useSolveStore() {
  const state = useSyncExternalStore(solveStore.subscribe, solveStore.getSnapshot, solveStore.getSnapshot)
  const solves = getAllSolves(state)
  const cloudLoading = state.status === 'loading'

  return {
    solves,
    addSolve:      solveStore.addSolve.bind(solveStore),
    updateSolve:   solveStore.updateSolve.bind(solveStore),
    deleteSolve:   solveStore.deleteSolve.bind(solveStore),
    addMany:       solveStore.addMany.bind(solveStore),
    nextSolveIds:  solveStore.nextSolveIds.bind(solveStore),
    reload:        solveStore.reload.bind(solveStore),
    runBulkOp:     solveStore.runBulkOp.bind(solveStore),
    dismissExample: solveStore.dismissExample.bind(solveStore),
    status:        state.status,
    error:         state.error,
    cloudReady:    state.cloudReady,
    cloudLoading,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- tests/hooks/useSolveStore.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSolveStore.ts tests/hooks/useSolveStore.test.tsx
git commit -m "feat(useSolveStore): hook wrapper with example composition"
```

---

## Task 10: Wire `solveStore.configure()` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

This task only wires the effect. `useSolveHistory` in `TimerScreen` continues to work unchanged; the store runs in parallel during migration.

- [ ] **Step 1: Add the configure effect**

In `src/App.tsx`, add the import at the top:

```typescript
import { solveStore } from './stores/solveStore'
```

After the existing `const cloudConfig = { enabled: cloudSync.enabled, user: cloudSync.user, authLoading: cloudSync.authLoading }` line (around line 56), add:

```typescript
  useEffect(() => {
    solveStore.configure(cloudConfig)
  }, [cloudConfig.enabled, cloudConfig.user?.uid])
```

- [ ] **Step 2: Run tests and build**

Run: `npm run test`
Expected: all pass (nothing consumes the store yet, but it's configured).

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(App): configure solveStore on mount and when cloud config changes"
```

---

## Task 11: Migrate `TimerScreen` to `useSolveStore()`

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Swap the hook**

In `src/components/TimerScreen.tsx`, replace:

```typescript
import { useSolveHistory } from '../hooks/useSolveHistory'
import type { CloudConfig } from '../hooks/useSolveHistory'
```

with:

```typescript
import { useSolveStore } from '../hooks/useSolveStore'
import type { CloudConfig } from '../stores/solveStore'
```

And replace line 74:

```typescript
const { solves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading } = useSolveHistory(cloudConfig)
```

with:

```typescript
const { solves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading } = useSolveStore()
```

`cloudConfig` is still needed by `onShare` / `onUnshare` callbacks further down (lines 522–543) and by `useSharedSolve`-adjacent code — leave the prop intact.

- [ ] **Step 2: Update the `addSolve` callsite**

The existing code at line 321–334 calls `addSolve({ … })` without awaiting. The new `addSolve` returns a Promise; keep the non-awaited form (`addSolve({…})`) — the Promise resolves silently unless it throws, and that's the same fire-and-forget behavior as before. No change needed here except to verify it still compiles.

The existing line 519: `onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}` — `deleteSolve` now returns a Promise, but the arrow-body pattern still compiles. Leave as-is.

- [ ] **Step 3: Run tests and build**

Run: `npm run test`
Expected: all pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Manual smoke test (no cloud)**

Run: `npm run dev`

In the browser:
- Start app in localStorage mode, record a solve, verify it appears in the history sidebar.
- Delete a solve, verify it's removed.
- Reload page, verify state is restored from localStorage.

- [ ] **Step 5: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "refactor(TimerScreen): consume useSolveStore instead of useSolveHistory"
```

---

## Task 12: Migrate `AcubemyImportModal` type import + `handleAcubemyCommit` to use `addMany`

**Files:**
- Modify: `src/components/AcubemyImportModal.tsx`
- Modify: `tests/components/AcubemyImportModal.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update the `CloudConfig` type import in the modal**

In `src/components/AcubemyImportModal.tsx`, replace:

```typescript
import type { CloudConfig } from '../hooks/useSolveHistory'
```

with:

```typescript
import type { CloudConfig } from '../stores/solveStore'
```

Same change in `tests/components/AcubemyImportModal.test.tsx` — replace:

```typescript
import type { CloudConfig } from '../../src/hooks/useSolveHistory'
```

with:

```typescript
import type { CloudConfig } from '../../src/stores/solveStore'
```

- [ ] **Step 2: Replace `handleAcubemyCommit` body with a single `addMany` call**

In `src/App.tsx`, replace the existing `handleAcubemyCommit` (currently lines 121–155) with:

```typescript
  const handleAcubemyCommit = async (drafts: SolveRecord[]): Promise<void> => {
    // Compute deterministic ids/seqs from store state + the Firestore counter (if cloud).
    const current = solveStore.getSnapshot().solves
    const useCloudNow = !!(cloudSync.enabled && cloudSync.user)
    const uid = cloudSync.user?.uid ?? null

    const usedDates = new Set(current.map(s => s.date))
    const maxSeqLocal = Math.max(0, ...current.map(s => s.seq ?? 0))
    const storedCounter = parseInt(localStorage.getItem(STORAGE_KEYS.NEXT_ID) ?? '1', 10) || 1
    const cloudCounter = useCloudNow && uid ? await loadNextSeqFromFirestore(uid) : 0
    let nextSeq = Math.max(maxSeqLocal + 1, storedCounter, cloudCounter)

    const prepared: SolveRecord[] = drafts.map(draft => {
      let date = draft.date
      while (usedDates.has(date)) date += 1
      usedDates.add(date)
      const id = useCloudNow ? date : nextSeq
      const record: SolveRecord = { ...draft, date, id, seq: nextSeq }
      nextSeq++
      return record
    })

    const { failed } = await solveStore.addMany(prepared)
    if (failed.length > 0) {
      throw new Error(`${failed.length} of ${prepared.length} failed to import`)
    }
  }
```

Remove now-unused imports from the top of `App.tsx` that were only used by the old `handleAcubemyCommit`. Do **not** remove `loadNextSeqFromFirestore` — it's still used for the counter probe above.

Keep `loadFromStorage`, `saveToStorage`, `STORAGE_KEYS` imports — still used elsewhere in the file.

- [ ] **Step 3: Run the test suite**

Run: `npm run test -- tests/components/AcubemyImportModal.test.tsx`
Expected: PASS.

Run: `npm run test`
Expected: all pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/AcubemyImportModal.tsx tests/components/AcubemyImportModal.test.tsx src/App.tsx
git commit -m "refactor(App): route acubemy commit through solveStore.addMany"
```

---

## Task 13: Route debug-mode reads and writes through the store (methods + mismatch + update/delete)

**Files:**
- Modify: `src/App.tsx`

Removes four direct Firestore calls (lines 126, 342, 410, 425, and 440 in the pre-migration source). After this task, the only place `loadSolvesFromFirestore` is imported into `App.tsx` is the acubemy counter probe (if still needed) — ideally zero direct calls.

- [ ] **Step 1: Replace `handleDebugUpdate`**

In `src/App.tsx`, replace:

```typescript
  const handleDebugUpdate = async (updated: SolveRecord): Promise<void> => {
    if (cloudSync.enabled && cloudSync.user) {
      await updateSolveInFirestore(cloudSync.user.uid, updated)
    } else {
      const solves = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
      saveToStorage(STORAGE_KEYS.SOLVES, solves.map((s) => s.id === updated.id ? updated : s))
    }
    setSelectedDebugSolve(updated)
    setMethodMismatches((prev) => {
      if (!prev) return prev
      const recheck = detectMethodMismatches([updated])
      if (recheck.length === 0) return prev.filter((m) => m.solve.id !== updated.id)
      return prev.map((m) => m.solve.id === updated.id ? recheck[0] : m)
    })
  }
```

with:

```typescript
  const handleDebugUpdate = async (updated: SolveRecord): Promise<void> => {
    await solveStore.updateSolve(updated)
    setSelectedDebugSolve(updated)
    setMethodMismatches((prev) => {
      if (!prev) return prev
      const recheck = detectMethodMismatches([updated])
      if (recheck.length === 0) return prev.filter((m) => m.solve.id !== updated.id)
      return prev.map((m) => m.solve.id === updated.id ? recheck[0] : m)
    })
  }
```

- [ ] **Step 2: Replace `handleDebugDelete`**

Replace:

```typescript
  const handleDebugDelete = (id: number): void => {
    if (cloudSync.enabled && cloudSync.user) {
      const solve = selectedDebugSolve
      if (solve) void deleteSolveFromFirestore(cloudSync.user.uid, solve)
    } else {
      const solves = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
      saveToStorage(STORAGE_KEYS.SOLVES, solves.filter((s) => s.id !== id))
    }
    setSelectedDebugSolve(null)
    setMethodMismatches((prev) => prev ? prev.filter((m) => m.solve.id !== id) : prev)
  }
```

with:

```typescript
  const handleDebugDelete = (id: number): void => {
    void solveStore.deleteSolve(id)
    setSelectedDebugSolve(null)
    setMethodMismatches((prev) => prev ? prev.filter((m) => m.solve.id !== id) : prev)
  }
```

- [ ] **Step 3: Replace "Migrate solves to v2" handler**

Find the button at (pre-migration) line 338–363. Replace the `onClick` body — the two direct Firestore calls become store-mediated:

```typescript
                  onClick={async () => {
                    if (!cloudSync.user) return
                    const pending = solveStore.getSnapshot().solves.filter(s => (s.schemaVersion ?? 1) < 2).length
                    if (pending === 0) {
                      setMigrateV2Result({ migrated: 0, failed: 0 })
                      setMigratingV2('done')
                      setTimeout(() => { setMigratingV2('idle'); setMigrateV2Result(null) }, 3000)
                      return
                    }
                    if (!confirm(`Migrate ${pending} solve${pending !== 1 ? 's' : ''} to v2 (correct M/E/S face labels)?`)) return
                    setMigratingV2('running')
                    const result = await solveStore.runBulkOp(() => migrateSolvesToV2InFirestore(cloudSync.user!.uid))
                    setMigrateV2Result(result)
                    setMigratingV2('done')
                    setTimeout(() => { setMigratingV2('idle'); setMigrateV2Result(null) }, 5000)
                  }}
```

Do the same for the "Renumber solves" button (pre-migration line 311): wrap `renumberSolvesInFirestore(cloudSync.user.uid)` in `solveStore.runBulkOp(...)`. Keep the `localStorage.setItem(STORAGE_KEYS.NEXT_ID, ...)` and the `setTimeout(reload)` as-is.

And for "Recalibrate solve times (hw clock)" (pre-migration line 327): wrap `recalibrateSolvesInFirestore(cloudSync.user.uid)` in `solveStore.runBulkOp(...)`.

- [ ] **Step 4: Replace "Detect method mismatches" handler**

Find the button at (pre-migration) line 405–421. Replace `onClick` body with:

```typescript
              onClick={() => {
                const scope = solveStore.getSnapshot().solves
                setDetectingMismatches(true)
                setMethodMismatches(detectMethodMismatches(scope))
                setDetectingMismatches(false)
              }}
```

The label logic (`Firestore | localStorage`) stays as-is — still driven by `cloudSync.enabled && cloudSync.user`.

- [ ] **Step 5: Replace "Import from acubemy" handler**

At (pre-migration) lines 422–434, the modal is opened with a pre-loaded `existingSolves` array. Replace the `onClick` body:

```typescript
              onClick={() => {
                setExistingSolvesForImport(solveStore.getSnapshot().solves)
                setShowAcubemyImport(true)
              }}
```

- [ ] **Step 6: Replace the `RecomputePhasesPanel` loader + committer**

At (pre-migration) lines 436–457, replace the `loadSolves` callback with a synchronous read:

```typescript
            loadSolves={() => solveStore.getSnapshot().solves}
```

And wrap `commitChanges` in `runBulkOp` so the store reloads after bulk write. Replace the current `commitChanges` body with:

```typescript
            commitChanges={async (changes: RecomputeChange[], onProgress) => {
              if (cloudSync.enabled && cloudSync.user) {
                const updated = changes.map((c) => ({ ...c.solve, phases: c.newPhases }))
                await solveStore.runBulkOp(() => bulkUpdateSolvesInFirestore(cloudSync.user!.uid, updated, onProgress))
              } else {
                const solves = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
                const byId = new Map(changes.map((c) => [c.solve.id, c.newPhases]))
                const updated = solves.map((s) => byId.has(s.id) ? { ...s, phases: byId.get(s.id)! } : s)
                saveToStorage(STORAGE_KEYS.SOLVES, updated)
                onProgress(1, 1)
                // Refresh store from localStorage so the changes reflect in the UI.
                solveStore.configure({ enabled: false, user: null })
              }
            }}
```

Note: the local-mode re-configure is a hack-free way to re-read from localStorage since `configure()` is already the path that reloads the local snapshot. However, because `configure()` is idempotent by tuple, we need to force a reload. Simpler alternative — add a tiny `reloadLocal()` helper to the store. **Choose this alternative:**

In `src/stores/solveStore.ts`, add to the `solveStore` object:

```typescript
  reloadLocal(): void {
    if (lastCloudConfig?.enabled && lastCloudConfig?.user) return
    setState({ solves: loadLocalSolves() })
  },
```

Then in `App.tsx`, replace the local-mode branch with:

```typescript
                solveStore.reloadLocal()
```

- [ ] **Step 7: Clean up unused imports in `App.tsx`**

After all the rewrites above, these should no longer be used inside `App.tsx`:
- `updateSolveInFirestore`
- `deleteSolveFromFirestore`
- `addSolveToFirestore`
- `updateCounterInFirestore`
- `loadSolvesFromFirestore` (unless still needed by the `handleAcubemyCommit` counter probe from Task 12 — check)
- `loadNextSeqFromFirestore` (only if still used by Task 12's probe; otherwise remove)

Leave `renumberSolvesInFirestore`, `recalibrateSolvesInFirestore`, `migrateSolvesToV2InFirestore`, `bulkUpdateSolvesInFirestore` — they are passed into `runBulkOp`.

Update the top-of-file import line to reflect what's still used.

- [ ] **Step 8: Run tests and build**

Run: `npm run test`
Expected: all pass.

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/stores/solveStore.ts
git commit -m "refactor(App): route debug-mode reads/writes through solveStore; drop direct Firestore calls"
```

---

## Task 14: Add "Refresh solves" button to debug maintenance panel

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Insert the button into the maintenance toolbar**

In `src/App.tsx`, inside the debug-mode maintenance toolbar (the `<div>` starting at pre-migration line 377 "display: 'flex'; justifyContent: 'center'; …"), add this button *before* the existing "Recalibrate solve times" button:

```tsx
            <button
              disabled={!(cloudSync.enabled && cloudSync.user) || solveStore.getSnapshot().status !== 'idle'}
              onClick={() => { void solveStore.reload() }}
              style={{ padding: '6px 14px', color: '#3498db', border: '1px solid #3498db', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}
            >
              Refresh solves
            </button>
```

The `disabled` check reads synchronously from the store — that's fine for UI disabling since the store updates the `status` field and React re-renders via the `useSolveStore` hook consumers, and `App.tsx` re-renders whenever `cloudSync` changes. If the button needs to re-render on `status` changes directly, subscribe to the store in `App` too — add at the top of `App`:

```typescript
  const storeStatus = useSolveStore().status
```

Then change the disabled line to:

```tsx
              disabled={!(cloudSync.enabled && cloudSync.user) || storeStatus !== 'idle'}
```

- [ ] **Step 2: Run tests and build**

Run: `npm run test`
Expected: all pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`

- Sign in with cloud sync enabled.
- Toggle debug mode.
- Click **Refresh solves** — button briefly disabled during refresh, re-enables; no error.
- With cloud OFF — button stays disabled.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(debug): add 'Refresh solves' button backed by solveStore.reload"
```

---

## Task 15: Delete `useSolveHistory` and its tests

**Files:**
- Delete: `src/hooks/useSolveHistory.ts`
- Delete: `tests/hooks/useSolveHistory.test.ts`

At this point nothing should import from either file. Verify and delete.

- [ ] **Step 1: Grep for remaining imports**

Run (via the Grep tool, not shell): search pattern `useSolveHistory` across `src/` and `tests/`.
Expected: zero matches outside the files about to be deleted.

If any match exists, stop and migrate it before proceeding.

- [ ] **Step 2: Delete the files**

```bash
git rm src/hooks/useSolveHistory.ts tests/hooks/useSolveHistory.test.ts
```

- [ ] **Step 3: Run tests and build**

Run: `npm run test`
Expected: all pass.

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: delete legacy useSolveHistory hook (superseded by solveStore)"
```

---

## Task 16: Manual QA additions and docs

**Files:**
- Modify: `docs/manual-test-checklist.md`
- Modify: `docs/ui-architecture.md`
- Modify: `docs/debug-mode.md`
- Modify: `future.md`
- Modify: `docs/devlog.md`

- [ ] **Step 1: Append QA entries to `docs/manual-test-checklist.md`**

Under a new section `## N. Solve Store — cache and refresh` (pick the next unused number), add:

```markdown
- [ ] With cloud sync ON, open DevTools Network tab filtered to `firestore.googleapis.com`.
- [ ] Reload the page → observe exactly **one** `loadSolves`-style read on boot.
- [ ] Toggle `[timer]` → `[debug]` → `[timer]` → **zero** additional reads.
- [ ] In debug mode, click **Detect method mismatches** → **zero** additional reads.
- [ ] In debug mode, click **Import from acubemy** → modal opens; **zero** additional reads to populate `existingSolves`.
- [ ] Import 250 solves via acubemy → progress indicator runs; 3 chunked rounds of writes; state updates to reflect new rows.
- [ ] Run **Recompute phases** → debug panel shows updated phase labels without a manual refresh.
- [ ] Click **Refresh solves** in debug → one additional `loadSolves` read; button briefly disabled.
- [ ] Sign out mid-session → `solves` list reverts to the localStorage view.
```

- [ ] **Step 2: Update `docs/ui-architecture.md`**

Under the `App` hook table, delete the `handleDebugUpdate` / `handleDebugDelete` bullet about "bypasses `useSolveHistory`" and replace with:

```markdown
**Debug-mode solve editing state (App-level):**
- `selectedDebugSolve: SolveRecord | null` — solve currently open in the debug-mode `SolveDetailModal` overlay
- `methodMismatches: MethodMismatch[] | null` — mismatch detector results; scans `solveStore.getSnapshot().solves`
- `handleDebugUpdate` / `handleDebugDelete` — delegate to `solveStore.updateSolve` / `solveStore.deleteSolve`
```

Under the `TimerScreen` hook table, replace the `useSolveHistory` row with:

```markdown
| `useSolveStore` | `solves`, `addSolve`, `deleteSolve`, `updateSolve`, `nextSolveIds`, `cloudLoading` (derived from `status === 'loading'`) |
```

Add a new top-level section before "Hook Ownership":

```markdown
## Stores

Module-level singletons held outside the React tree. Consumers subscribe via dedicated hooks.

- `src/stores/solveStore.ts` — single source of truth for the signed-in user's solves. Owns `solves`, `dismissedExamples`, `status`, `error`, `cloudReady`. `App` drives `solveStore.configure(cloudConfig)` in an effect; every consumer reads via `useSolveStore()`. CRUD methods are optimistic with rollback on Firestore errors. `addMany()` chunks writes by 100 via `Promise.allSettled`. `runBulkOp()` wraps server-side maintenance ops and reloads afterward.
```

- [ ] **Step 3: Update `docs/debug-mode.md`**

Under "Maintenance buttons (bottom toolbar)", insert near the top:

```markdown
- **Refresh solves** — re-reads solves from Firestore (cloud mode only). Button disabled when cloud sync is off or a refresh is already in-flight. Use this to pick up changes made from another tab or device.
```

- [ ] **Step 4: Cross out the future.md line**

In `future.md`, replace the line:

```markdown
- **Cache loaded Firestore solves across debug/timer toggles** — switching between debug and timer mode appears to re-fetch solves from Firestore each time. Verify this is happening, then decide whether to keep the loaded data in memory (e.g. lift the cache into a hook/context) so the round-trip only happens on first load and explicit refresh.
```

with (strikethrough and version tag — pick the current release version):

```markdown
- ~~**Cache loaded Firestore solves across debug/timer toggles** — switching between debug and timer mode appears to re-fetch solves from Firestore each time. Verify this is happening, then decide whether to keep the loaded data in memory (e.g. lift the cache into a hook/context) so the round-trip only happens on first load and explicit refresh.~~ — done in v1.26.0
```

(Use whatever the next unreleased version is in `docs/devlog.md`. If uncertain, leave `vX.Y.0` as a placeholder and match it to the devlog entry in the next step.)

- [ ] **Step 5: Add devlog entry**

Follow the project convention (global CLAUDE.md). At the top of `docs/devlog.md` (newest-first), add an entry of the form:

```markdown
## vX.Y.0 — Shared solve store (YYYY-MM-DD)

**Review:** not yet
**Design docs:**
- Solve Store: [Spec](superpowers/specs/2026-04-20-cache-solves-across-toggles-design.md) [Plan](superpowers/plans/2026-04-20-cache-solves-across-toggles.md)

**What was built:**
- New module-level `solveStore` with `useSyncExternalStore`; replaces `useSolveHistory`
- `TimerScreen`, `AcubemyImportModal`, `RecomputePhasesPanel`, debug-mode handlers all read from the store
- Debug-mode "Refresh solves" button
- `addMany` chunk-of-100 `Promise.allSettled` bulk insert with optimistic rollback on failure
- `runBulkOp` helper wraps server-side maintenance operations and reloads the store afterward
- Pure `computeAo` / `computeStats` / `filterSolves` moved to `src/utils/solveStats.ts`
- First use of `vi.mock` for `firestoreSolves` in the project

**Key technical learnings:**
- `[insight]` Module-level state + `useSyncExternalStore` cuts ~100 lines of state management out of `TimerScreen` and eliminates all debug-mode duplicate Firestore reads, without pulling in a state library.
- `[note]` `Promise.allSettled` per chunk (vs `Promise.all`) was necessary to keep partial-failure reporting aligned with the existing `migrateSolvesToV2InFirestore` pattern.
- `[gotcha]` `configure()` must be idempotent by `(enabled, uid)` tuple — otherwise StrictMode's double-invoke re-migrates on mount.
```

Also update the TL;DR table at the top with a matching one-liner and section anchor.

- [ ] **Step 6: Run tests and build one last time**

Run: `npm run test`
Expected: all pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 7: Commit docs**

```bash
git add docs/manual-test-checklist.md docs/ui-architecture.md docs/debug-mode.md docs/devlog.md future.md
git commit -m "docs: solveStore — update architecture, debug-mode, devlog, QA checklist"
```

---

## Self-Review Notes (for the executor)

When you reach the end of this plan, verify by inspection:

1. **Zero direct Firestore reads in `App.tsx`** outside of `handleAcubemyCommit`'s counter probe (if kept). Search: `loadSolvesFromFirestore`, `addSolveToFirestore`, `updateSolveInFirestore`, `deleteSolveFromFirestore`, `updateCounterInFirestore` — none should appear in `App.tsx`.
2. **`useSolveHistory` is gone.** Grep the whole repo.
3. **All CRUD paths share the same rollback discipline** — no silent failures.
4. **Manual QA**: the big one is the Network tab during toggle. Exactly one `loadSolves` on boot, zero on toggles. If you see more than one on boot, `configure()` is firing with an unstable `cloudConfig` object — check the dependency array on the effect in `App.tsx`.

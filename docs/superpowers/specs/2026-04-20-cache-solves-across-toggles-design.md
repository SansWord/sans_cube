# Cache Loaded Solves Across Timer/Debug Toggles — Design

**Date:** 2026-04-20
**Status:** Draft
**Related:** `future.md` → "Cache loaded Firestore solves across debug/timer toggles"

## Problem

Switching between timer and debug mode re-fetches solves from Firestore every time the user returns to timer mode. Inside debug mode, multiple independent buttons each issue their own `loadSolvesFromFirestore` call (method mismatch detector, acubemy import open, acubemy commit, v2-migration count). This produces redundant round-trips and no shared source of truth across the app.

**Confirmed re-fetch path:**
- `useSolveHistory` (src/hooks/useSolveHistory.ts:113) owns `cloudSolves` state and calls `loadSolvesFromFirestore` inside a `useEffect` (src/hooks/useSolveHistory.ts:147-171).
- That hook lives in `TimerScreen` (per `docs/ui-architecture.md:65-77`).
- `App.tsx:202-223` conditionally renders `<TimerScreen>` only when `mode === 'timer'`. Toggling to debug unmounts TimerScreen, discarding `cloudSolves` and `cloudReady`. Toggling back remounts it; the effect fires and refetches.

**Debug-mode duplicate reads** (src/App.tsx:126, 342, 410, 425, 440) — every operation reads from Firestore independently because the debug-mode code path intentionally bypasses `useSolveHistory` (comment at App.tsx:118-120).

**Scope of impact:** cloud-sync users only. Local-storage users re-read from localStorage, which is synchronous and effectively free.

## Goals

1. Single in-memory source of truth for the signed-in user's solves, shared by timer mode and debug mode.
2. No redundant Firestore round-trips on mode toggles.
3. No redundant Firestore round-trips for intra-debug actions.
4. Manual "Refresh" escape hatch for drift from other tabs / other devices.
5. Coherent loading/lifecycle state exposed to every consumer.

## Non-Goals

- Live sync via Firestore `onSnapshot`.
- Cross-tab coordination via `BroadcastChannel` or storage events.
- Changing storage schema or the localStorage ↔ Firestore migration behavior.
- Changing how examples, shared solves, or the acubemy parser work.

---

## 1. Architecture Overview

**New file:** `src/stores/solveStore.ts` — module-level singleton holding all loaded solves and lifecycle state. Uses React 18's `useSyncExternalStore` for subscriptions. No new dependency.

**New file:** `src/hooks/useSolveStore.ts` — thin hook wrapper so consumers get the same ergonomic shape they're used to.

**Deleted / shrunk:** `src/hooks/useSolveHistory.ts` — logic moves into the store module. Pure helpers (`computeAo`, `computeStats`, `filterSolves`) move to `src/utils/solveStats.ts` since they're data-shape functions, not state management.

**App integration:**

```
App.tsx
├── useCloudSync()  (unchanged)
├── useEffect(() => solveStore.configure(cloudConfig), [cloudConfig])
└── renders TimerScreen OR debug panel — both subscribe via useSolveStore()
```

The store lives outside the React tree. `App.tsx`'s only responsibility is pushing `cloudConfig` into the store via an effect. Every other consumer — `TimerScreen`, `SolveHistorySidebar`, `TrendsModal`, `AcubemyImportModal`, `SolveDetailModal`, and debug-mode handlers in App — calls `useSolveStore()` directly.

**Data flow (writes):**

```
User action → useSolveStore().addSolve(x)
              → optimistic: state.solves = [...state.solves, x]; notify subscribers
              → async: addSolveToFirestore(uid, x)
                 ├─ success → done
                 └─ failure → rollback state.solves; set error; notify
```

**Data flow (bulk maintenance):**

```
User clicks "Renumber solves"
  → solveStore.runBulkOp(() => renumberSolvesInFirestore(uid))
    → status = 'refreshing'; disable buttons via subscribers
    → await renumberSolvesInFirestore(uid)
    → await reload()    (server-then-reload per B1)
    → status = 'idle'
```

**What moves where:**

| Today | After |
|---|---|
| `useSolveHistory` in `TimerScreen.tsx` | Gone — replaced by `useSolveStore()` |
| Direct `loadSolvesFromFirestore` calls in `App.tsx:126,342,410,425,440` | All go through the store (5 sites → 0 direct calls) |
| Direct `addSolveToFirestore`/`updateSolveInFirestore`/`deleteSolveFromFirestore` in App.tsx debug handlers | All go through store CRUD methods |
| `computeAo`, `computeStats`, `filterSolves` (in `useSolveHistory.ts`) | Move to `src/utils/solveStats.ts` (pure) |
| Migration-from-localStorage-to-Firestore logic | Lives in the store's `configure()` transition |
| `dismissedExamples` state + `EXAMPLE_SOLVES` composition | Moves into the store; `allSolves` output unchanged |

---

## 2. Module Public API

### State shape

```ts
type Status = 'idle' | 'loading' | 'refreshing' | 'error'

interface StoreState {
  solves: SolveRecord[]           // user solves only, not including examples
  dismissedExamples: Set<number>  // example IDs the user has dismissed
  status: Status
  error: string | null
  cloudReady: boolean             // true after first successful cloud load; false in local mode
}
```

`solves` excludes examples — examples are composed in by the hook wrapper, so the store only tracks real user data.

### Configuration

```ts
configure(cloudConfig: CloudConfig): void
```

- First call: reads localStorage (synchronous v1→v2 migration), sets initial state. If cloud is enabled with a user, kicks off initial Firestore load (`status = 'loading'`).
- Subsequent calls with the same `(enabled, uid)` tuple: no-op.
- Call with a different `uid` (user sign-in/out while running): re-initializes — runs localStorage→Firestore migration if switching on, resets `cloudReady`, refetches.
- Call with cloud disabled: reverts to localStorage-backed state; `status = 'idle'` immediately.

Idempotent: safe to call from an effect.

### Read surface

```ts
subscribe(listener: () => void): () => void   // useSyncExternalStore contract
getSnapshot(): StoreState                     // useSyncExternalStore contract
```

Plus derived helper (pure, exported):

```ts
getAllSolves(state: StoreState): SolveRecord[]   // examples ∪ user solves, examples filtered by dismissed
```

### Write surface

```ts
addSolve(solve: SolveRecord): Promise<void>
updateSolve(updated: SolveRecord): Promise<void>
deleteSolve(id: number): Promise<void>
addMany(drafts: SolveRecord[]): Promise<AddManyResult>
nextSolveIds(): { id: number; seq: number }
dismissExample(id: number): void
```

### Lifecycle surface

```ts
reload(): Promise<void>     // user-triggered Refresh button
runBulkOp<T>(fn: () => Promise<T>): Promise<T>   // bulk server op + reload per B1
```

### Test support

```ts
__resetForTests(): void   // test-only export
```

---

## 3. CRUD & Bulk Import Semantics

### Single-record writes — optimistic with rollback

Identical pattern for `addSolve` / `updateSolve` / `deleteSolve`:

```
1. Snapshot current state.solves
2. Apply optimistic update, notify subscribers
3. Try the write (Firestore if cloud, localStorage if not)
4. On error:
   - state.solves = snapshot
   - state.error = message
   - notify subscribers
   - re-throw
```

**Concurrency:** writes are not serialized at the store level. Parallel writes behave identically to today's `useSolveHistory` — no new race risk introduced.

**Error UX:** the store sets `error` and re-throws. Callers catch and display inline (matches today's `methodError` in `SolveDetailModal`). The store's `error` field is for consumers that don't have their own error channel; auto-cleared on next successful operation or `reload()`.

### Bulk import — `addMany`

**Mechanism: `Promise.allSettled(addSolveToFirestore)` per chunk of 100, chunks run sequentially.**

This matches the existing chunking pattern in `bulkUpdateSolvesInFirestore` (src/services/firestoreSolves.ts:129-144). The reason per the existing doc comment: each SolveRecord is ~35 KB; Firestore `writeBatch`'s 10 MB payload limit would be uncomfortable at 100 × 35 KB, so we use individual `setDoc` calls chunked for concurrency.

```
Cloud path:
  1. Chunk drafts into groups of 100.
  2. Optimistically append ALL drafts to state.solves, notify subscribers.
  3. For each chunk sequentially:
       - await Promise.allSettled(chunk.map(d => addSolveToFirestore(uid, d)))
       - onProgress(i + 1, chunkCount)
  4. After all chunks: updateCounterInFirestore(uid, finalSeq).
  5. Roll back failed drafts from state.

Local path:
  - Append all, saveLocalSolves once, update nextId. No chunking.
```

**`Promise.allSettled` per chunk** (not `Promise.all`): within a chunk, we need to know exactly which drafts succeeded and which failed, not fail-fast on the first rejection. Matches the partial-failure handling in `migrateSolvesToV2InFirestore`.

**Result shape:**

```ts
interface AddManyResult {
  committed: SolveRecord[]  // drafts that made it to server
  failed: Array<{ draft: SolveRecord; error: Error }>
}
```

Import modal uses this to show e.g. "497 of 500 imported, 3 failed — [Retry]".

**Optimistic UI:** all drafts appear in state immediately on call. Failures are *collected across all chunks* (via `allSettled`) and rolled back in a single state update after the last chunk completes. User sees "everything appeared; progress ticks through chunks; at the end, N failed rows disappeared" — acceptable trade for the perceived-performance win of showing data immediately.

### Bulk maintenance — `runBulkOp`

Today's bulk ops in App.tsx:
- `renumberSolvesInFirestore`
- `recalibrateSolvesInFirestore`
- `migrateSolvesToV2InFirestore`
- `bulkUpdateSolvesInFirestore` (recompute phases)

All follow the same pattern. `runBulkOp` centralizes it:

```ts
async runBulkOp<T>(fn: () => Promise<T>): Promise<T> {
  setStatus('refreshing')
  try {
    const result = await fn()
    await reloadInternal()
    setStatus('idle')
    return result
  } catch (e) {
    setStatus('error', String(e))
    throw e
  }
}
```

**Call site pattern:**

```ts
// Before (App.tsx)
await renumberSolvesInFirestore(uid)
// state is now stale

// After
await solveStore.runBulkOp(() => renumberSolvesInFirestore(uid))
// state is fresh; all subscribers notified
```

**Net effect on bulk recompute phases:** behavior identical (same chunked writes inside `bulkUpdateSolvesInFirestore`), but debug-mode UI reflects recomputed phases immediately without manual refresh.

### Local-mode (no cloud)

Writes go to localStorage synchronously. `reload()` is a no-op. `runBulkOp` just runs the op (no reload needed). All existing callers of `runBulkOp` are cloud-guarded already.

### Refresh button

Added to debug mode's maintenance panel:

```
[Refresh solves]   (disabled when status !== 'idle')
```

Click → `solveStore.reload()` → `status: refreshing → idle`. No confirmation dialog — it's a safe read-only op.

---

## 4. Lifecycle, Migration & Edge Cases

### Configuration transition matrix

| From → To | Action |
|---|---|
| First call, cloud off | Load localStorage (migration). `status = 'idle'`, `cloudReady = false`. |
| First call, cloud enabled + user present | Load localStorage, run one-time `migrateLocalSolvesToFirestore`, fetch from Firestore. `status = 'loading'`. |
| First call, cloud enabled but auth loading | Initialize with localStorage snapshot. `status = 'loading'`. Don't fetch yet. |
| Cloud off → on (sign-in) | Run one-time `migrateLocalSolvesToFirestore`, fetch from Firestore. `status = 'loading'`. |
| Cloud on → off (sign-out / disable sync) | Drop `cloudSolves`, revert to localStorage view. `status = 'idle'`. Does NOT write cloud solves back to localStorage. |
| `uid` changes (user A → user B) | Clear `cloudSolves`, reset `cloudReady = false`, fetch for new uid. Migration guard is per-uid. |
| Same `(enabled, uid)` tuple | No-op. |

### One-time localStorage → Firestore migration

Today handled by `migrateLocalSolvesToFirestore` and guarded by a `migratedRef` bool in `useSolveHistory`. In the store:

- Guard becomes `migratedUids: Set<string>` keyed by uid, so it survives sign-in/out cycles within a session.
- Runs exactly once per uid per session, driven by localStorage having >0 solves at the time cloud becomes available.
- Matches today's semantics — no behavior change.

### Things the store explicitly does NOT do

- No Firestore `onSnapshot` subscription. Adding it later is additive, not breaking.
- No cross-tab coordination.
- No write queue. Writes run immediately.

### React Strict Mode / dev double-invoke

`useSyncExternalStore` handles Strict Mode correctly by default. The only concern is double-invocation of `configure()` from an effect; handled by the idempotency rule (same tuple → no-op).

### HMR / Fast Refresh

Vite's Fast Refresh preserves module state across hot reloads. Mitigation for store-module edits specifically:

```ts
if (import.meta.hot) {
  import.meta.hot.dispose(() => __resetForTests())
}
```

Component-only HMR events don't trigger this, so editing `SolveHistorySidebar.tsx` preserves loaded solves as expected.

### Unmount safety

Since the store is module-level, there's no "component unmounted, cancel the write" problem. After a Firestore write resolves, the store notifies whoever is currently subscribed. Same guarantee as today.

### `SolveDetailModal` shared-solve path

`SolveDetailModal` is rendered in three contexts:
1. Timer mode, editable
2. Debug mode, editable (from mismatch detector)
3. Viewer mode (`#shared-{shareId}`), read-only, loaded via `useSharedSolve`

Shared solves are NOT owned by the store — they come from `users/{otherUid}/public_solves/{shareId}` and live in `useSharedSolve`'s state. The store only tracks the signed-in user's own solves. No change.

### `SolveRecord` with `isExample: true`

Example solves are composed into the hook output but never passed to write methods. Guard: `addSolve` / `updateSolve` with `isExample === true` → warn + no-op (matches today's permissive style). `deleteSolve` with a negative ID routes to `dismissExample` (matches useSolveHistory.ts:214-218).

### Error states and recovery

- `error` field set on any failure (fetch, write, bulk op).
- Cleared on the next successful operation.
- UI treatment: inline in debug maintenance panel ("Last error: ..."); `SolveDetailModal` uses the re-thrown error for its inline `methodError`.
- No auto-retry.

---

## 5. Testing Strategy

### Firestore mocking

Unit tests must not touch real Firestore. The project's existing convention (`useSolveHistory` tests) is to run tests without `cloudConfig` (local path only). The new store has enough cloud-specific logic (chunking, `allSettled`, optimistic rollback, bulk op lifecycle) that local-only testing leaves critical paths uncovered.

**Adopting `vi.mock`** for the first time in this project:

```ts
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
```

### Unit tests — `tests/stores/solveStore.test.ts`

`beforeEach` calls `__resetForTests()` and resets all mocks.

**Configure lifecycle:**
- First `configure()` with cloud off → loads from localStorage, status `idle`.
- First `configure()` with cloud enabled + user → status `loading` → `idle`, `cloudReady = true`.
- Repeat `configure()` same tuple → no-op (assert `loadSolvesFromFirestore` call count = 1).
- `configure()` with different uid → fetches for new uid; migration guard is per-uid.
- Cloud on → off transition → reverts to localStorage.

**CRUD optimistic + rollback:**
- `addSolve` success → state updated.
- `addSolve` failure (mocked rejection) → state rolled back, `error` set, subscribers notified twice.
- Same for `updateSolve`, `deleteSolve`.
- `deleteSolve(-1)` routes to `dismissExample`.
- `addSolve({ isExample: true })` warn + no-ops.

**`addMany`:**
- 50 drafts → 1 chunk, all succeed → `committed.length = 50`, `failed = []`.
- 250 drafts → 3 chunks (100/100/50), all succeed → progress called 4 times.
- 100 drafts, 3 reject → `committed.length = 97`, `failed.length = 3` with per-draft errors.
- 200 drafts, chunk 2 has 3 rejections, chunk 1 all succeed → subsequent chunk still runs; `committed.length = 197`, `failed.length = 3`.
- Local mode → synchronous append, no chunking, no counter call.

**`runBulkOp`:**
- Passing op → status `refreshing` during, `idle` after, `reload()` called once.
- Throwing op → status `error`, `reload()` NOT called, error re-thrown.

**`reload()`:**
- Cloud mode → fetches fresh, replaces `cloudSolves`.
- Local mode → no-op.

### Integration tests — `tests/hooks/useSolveStore.test.tsx`

- Component using `useSolveStore()` receives current state.
- State change → re-renders subscribers.
- Unmount → listener removed.

### Existing tests to migrate

- `tests/hooks/useSolveHistory.test.ts` — split:
  - `computeAo`, `computeStats` pure tests → move to `tests/utils/solveStats.test.ts`.
  - `useSolveHistory` hook tests → port to `useSolveStore` equivalents or delete if redundant.
- `tests/filterSolves.test.ts` — update imports.
- `tests/components/AcubemyImportModal.test.tsx` — update import path for store.

### Manual QA additions

Add to `docs/manual-test-checklist.md`:

- Toggle timer → debug → timer with cloud sync on → watch Network tab → exactly 1 `loadSolvesFromFirestore` call on boot, 0 on toggles.
- Click Detect Method Mismatches in debug → 0 additional Firestore reads.
- Click Import from Acubemy → 0 additional Firestore reads for `existingSolves`.
- Import 250 solves → progress indicator visible; 3 chunks of writes; state updates.
- Run recompute phases → debug shows updated phase labels without manual refresh.
- Click Refresh in debug → one `loadSolvesFromFirestore`; status cycles `refreshing` → `idle`.
- Sign out mid-session → `cloudSolves` cleared, reverts to localStorage view.

---

## 6. Migration Plan (implementation ordering)

1. Extract pure helpers. Move `computeAo`, `computeStats`, `filterSolves` from `useSolveHistory.ts` to `src/utils/solveStats.ts`. No behavior change. Update imports.
2. Create `solveStore.ts` with full API; backed by unit tests with `vi.mock`.
3. Create `useSolveStore()` hook wrapper.
4. Wire App.tsx: add the `configure()` effect. `useSolveHistory` (old) and `solveStore` (new) coexist briefly during migration.
5. Migrate `TimerScreen` to `useSolveStore()`. Delete `useSolveHistory` call site.
6. Migrate debug-mode handlers in App.tsx (`handleDebugUpdate`, `handleDebugDelete`, `handleAcubemyCommit`, bulk maintenance buttons) to go through the store.
7. Add Refresh button to debug maintenance panel.
8. Delete `useSolveHistory.ts`.
9. Update `docs/ui-architecture.md`, `docs/debug-mode.md`.
10. Add manual QA entries to `docs/manual-test-checklist.md`.
11. Devlog entry.

---

## Decisions Log

- **Scope (Q1):** Option B — toggle plus debug-mode consolidation. Clean end state over minimal merge.
- **Container (Q2):** Option C — module-level singleton with `useSyncExternalStore`. Chosen over lifting hook to App (A) for cache durability and elimination of prop drilling to debug-mode CRUD handlers.
- **Library:** Hand-rolled, no new dependency (Zustand rejected).
- **Bulk maintenance (B1 vs B2):** B1 — cache runs server op, then server-reads fresh state. Safer for bulk ops; one extra round-trip acceptable.
- **Refresh button location (Q3a):** Debug mode only. Timer stays clean.
- **Initial load timing (Q3b):** Eager on `configure()`. Debug-on-boot users pay the round-trip earlier, but first click is instant.
- **Loading state:** Store owns `status` field; each surface decides presentation. No global overlay.
- **`addMany` mechanism:** `Promise.allSettled(addSolveToFirestore)` per chunk of 100, chunks sequential. Matches existing `bulkUpdateSolvesInFirestore` pattern. Not `writeBatch` — 35 KB/record × 100 × 10 MB payload limit constraint.
- **`addMany` failure handling:** B — `allSettled` for accurate per-record failure list. Subsequent chunks continue running.
- **Testing:** B — `vi.mock` the Firestore service module. First instance of this pattern in the project.

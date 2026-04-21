# Bulk Recompute Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a debug-mode panel that bulk-recomputes `phases` on every saved solve using the current `isDone` predicates, with dry-run-first UX and a commit step that only writes back changed, successfully-recomputed solves.

**Architecture:**
- Pure scanner `recomputeAllPhases(solves)` returning `{ unchanged, changed, failed, skipped }`.
- Self-contained `<RecomputePhasesPanel>` React component owning its own state (`scanning / results / committing / commitProgress`). Mounted twice in `App.tsx`: once inside the Cloud Sync panel (targets Firestore) and once inside the maintenance toolbar (targets localStorage). Parent injects a `loadSolves` and a `commitChanges` callback so the component doesn't know about cloud vs local.
- Firestore writes go through a new `bulkUpdateSolvesInFirestore(uid, solves, onProgress)` helper that uses chunked `Promise.all(setDoc)` (chunks of 100) — not `writeBatch` — to stay under the 10 MB payload limit at ~35 KB per solve.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Firebase Firestore.

**Spec:** `docs/superpowers/specs/2026-04-20-bulk-recompute-phases-design.md`

---

## File Structure

**Create:**
- `src/utils/recomputeAllPhases.ts` — pure scanner; no IO.
- `tests/utils/recomputeAllPhases.test.ts` — unit tests for the scanner.
- `src/components/RecomputePhasesPanel.tsx` — inline debug panel; dry-run + commit UI.
- `tests/components/RecomputePhasesPanel.test.tsx` — component tests.

**Modify:**
- `src/services/firestoreSolves.ts` — add `bulkUpdateSolvesInFirestore`.
- `src/App.tsx` — mount panel in cloud-sync block and maintenance toolbar.
- `docs/debug-mode.md` — document the two buttons.
- `docs/devlog.md` — entry at the end.

---

## Task 1: Scanner — `recomputeAllPhases` skeleton + result shape

**Files:**
- Create: `src/utils/recomputeAllPhases.ts`
- Test: `tests/utils/recomputeAllPhases.test.ts`

- [ ] **Step 1: Write the failing test for result shape**

Create `tests/utils/recomputeAllPhases.test.ts`:

```typescript
// tests/utils/recomputeAllPhases.test.ts
import { describe, it, expect } from 'vitest'
import { recomputeAllPhases } from '../../src/utils/recomputeAllPhases'

describe('recomputeAllPhases', () => {
  it('returns empty buckets for empty input', () => {
    const result = recomputeAllPhases([])
    expect(result.unchanged).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/utils/recomputeAllPhases.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/utils/recomputeAllPhases"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/recomputeAllPhases.ts`:

```typescript
// src/utils/recomputeAllPhases.ts
import type { SolveRecord, PhaseRecord } from '../types/solve'

export interface RecomputeChange {
  solve: SolveRecord
  oldPhases: PhaseRecord[]
  newPhases: PhaseRecord[]
}

export interface RecomputeResult {
  /** Solves whose recomputed phases exactly match stored phases. */
  unchanged: SolveRecord[]
  /** Solves whose recomputed phases differ from stored phases. Safe to commit. */
  changed: RecomputeChange[]
  /** Solves where `recomputePhases` returned null (empty moves, replay didn't reach solved). */
  failed: SolveRecord[]
  /** Solves that weren't scanned (isExample, or method === 'freeform'). */
  skipped: SolveRecord[]
}

export function recomputeAllPhases(_solves: SolveRecord[]): RecomputeResult {
  return { unchanged: [], changed: [], failed: [], skipped: [] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/utils/recomputeAllPhases.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recomputeAllPhases.ts tests/utils/recomputeAllPhases.test.ts
git commit -m "scaffold recomputeAllPhases scanner"
```

---

## Task 2: Scanner — skip `isExample` and `method === 'freeform'`

**Files:**
- Modify: `src/utils/recomputeAllPhases.ts`
- Test: `tests/utils/recomputeAllPhases.test.ts`

- [ ] **Step 1: Add failing tests for skip rules**

Append to the existing `describe` block in `tests/utils/recomputeAllPhases.test.ts`:

```typescript
  it('skips isExample solves', () => {
    const example: SolveRecord = {
      id: 1, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, isExample: true,
    }
    const result = recomputeAllPhases([example])
    expect(result.skipped).toEqual([example])
    expect(result.unchanged).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('skips freeform solves', () => {
    const freeform: SolveRecord = {
      id: 2, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'freeform',
    }
    const result = recomputeAllPhases([freeform])
    expect(result.skipped).toEqual([freeform])
  })
```

Add the missing import at the top of the file:

```typescript
import type { SolveRecord } from '../../src/types/solve'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/utils/recomputeAllPhases.test.ts`
Expected: FAIL — both new tests fail because `skipped` is empty.

- [ ] **Step 3: Implement skip logic**

Replace the body of `recomputeAllPhases` in `src/utils/recomputeAllPhases.ts`:

```typescript
export function recomputeAllPhases(solves: SolveRecord[]): RecomputeResult {
  const unchanged: SolveRecord[] = []
  const changed: RecomputeChange[] = []
  const failed: SolveRecord[] = []
  const skipped: SolveRecord[] = []

  for (const solve of solves) {
    if (solve.isExample) { skipped.push(solve); continue }
    if ((solve.method ?? 'cfop') === 'freeform') { skipped.push(solve); continue }
    // recompute logic in Task 3
  }

  return { unchanged, changed, failed, skipped }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/utils/recomputeAllPhases.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recomputeAllPhases.ts tests/utils/recomputeAllPhases.test.ts
git commit -m "recomputeAllPhases: skip examples and freeform"
```

---

## Task 3: Scanner — recompute, bucket into unchanged / changed / failed

**Files:**
- Modify: `src/utils/recomputeAllPhases.ts`
- Test: `tests/utils/recomputeAllPhases.test.ts`

- [ ] **Step 1: Add failing tests for recompute buckets**

Append to the existing `describe` block in `tests/utils/recomputeAllPhases.test.ts`:

```typescript
  it('buckets a solve with no moves into failed', () => {
    const noMoves: SolveRecord = {
      id: 3, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop',
    }
    const result = recomputeAllPhases([noMoves])
    expect(result.failed).toEqual([noMoves])
    expect(result.changed).toEqual([])
    expect(result.unchanged).toEqual([])
  })

  it('unchanged when stored phases exactly match a fresh recompute', () => {
    // ROUX_SOLVE_1 has M moves; recompute against ROUX, store that as phases, re-scan → unchanged.
    const solve = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(solve, ROUX)!
    const withFreshPhases: SolveRecord = { ...solve, phases: fresh }
    const result = recomputeAllPhases([withFreshPhases])
    expect(result.unchanged).toHaveLength(1)
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('changed when stored phases differ from a fresh recompute', () => {
    const solve = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(solve, ROUX)!
    // Mutate one turn count so it will not match.
    const stalePhases = fresh.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p)
    const withStale: SolveRecord = { ...solve, phases: stalePhases }
    const result = recomputeAllPhases([withStale])
    expect(result.changed).toHaveLength(1)
    expect(result.changed[0].solve).toBe(withStale)
    expect(result.changed[0].oldPhases).toBe(stalePhases)
    expect(result.changed[0].newPhases).toEqual(fresh)
    expect(result.unchanged).toEqual([])
  })

  it('partitions a mixed list', () => {
    const example: SolveRecord = { id: 10, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, isExample: true }
    const noMoves: SolveRecord = { id: 11, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }
    const freeform: SolveRecord = { id: 12, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'freeform' }

    const roux = { ...ROUX_SOLVE_1, id: 13, method: 'roux' as const, isExample: false }
    const freshRoux = recomputePhases(roux, ROUX)!
    const unchangedSolve: SolveRecord = { ...roux, phases: freshRoux }
    const changedSolve: SolveRecord = { ...roux, id: 14, phases: freshRoux.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p) }

    const result = recomputeAllPhases([example, noMoves, freeform, unchangedSolve, changedSolve])
    expect(result.skipped).toHaveLength(2)
    expect(result.failed).toEqual([noMoves])
    expect(result.unchanged).toEqual([unchangedSolve])
    expect(result.changed).toHaveLength(1)
    expect(result.changed[0].solve).toBe(changedSolve)
  })
```

Add these imports at the top of the file (keep the existing ones):

```typescript
import { recomputePhases } from '../../src/utils/recomputePhases'
import { ROUX } from '../../src/methods/roux'
import { ROUX_SOLVE_1 } from '../fixtures/solveFixtures'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/utils/recomputeAllPhases.test.ts`
Expected: FAIL — all four new tests fail (scanner currently returns empty buckets for non-skipped solves).

- [ ] **Step 3: Implement recompute + bucket logic**

Replace `src/utils/recomputeAllPhases.ts` entirely with:

```typescript
// src/utils/recomputeAllPhases.ts
import { recomputePhases } from './recomputePhases'
import { getMethod } from '../methods'
import type { SolveRecord, PhaseRecord } from '../types/solve'

export interface RecomputeChange {
  solve: SolveRecord
  oldPhases: PhaseRecord[]
  newPhases: PhaseRecord[]
}

export interface RecomputeResult {
  /** Solves whose recomputed phases exactly match stored phases. */
  unchanged: SolveRecord[]
  /** Solves whose recomputed phases differ from stored phases. Safe to commit. */
  changed: RecomputeChange[]
  /** Solves where `recomputePhases` returned null (empty moves, replay didn't reach solved). */
  failed: SolveRecord[]
  /** Solves that weren't scanned (isExample, or method === 'freeform'). */
  skipped: SolveRecord[]
}

function phasesEqual(a: PhaseRecord[], b: PhaseRecord[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label) return false
    if (a[i].group !== b[i].group) return false
    if (a[i].recognitionMs !== b[i].recognitionMs) return false
    if (a[i].executionMs !== b[i].executionMs) return false
    if (a[i].turns !== b[i].turns) return false
  }
  return true
}

export function recomputeAllPhases(solves: SolveRecord[]): RecomputeResult {
  const unchanged: SolveRecord[] = []
  const changed: RecomputeChange[] = []
  const failed: SolveRecord[] = []
  const skipped: SolveRecord[] = []

  for (const solve of solves) {
    if (solve.isExample) { skipped.push(solve); continue }
    const methodId = solve.method ?? 'cfop'
    if (methodId === 'freeform') { skipped.push(solve); continue }

    const method = getMethod(methodId)
    const newPhases = recomputePhases(solve, method)
    if (newPhases === null) { failed.push(solve); continue }

    if (phasesEqual(solve.phases, newPhases)) {
      unchanged.push(solve)
    } else {
      changed.push({ solve, oldPhases: solve.phases, newPhases })
    }
  }

  return { unchanged, changed, failed, skipped }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/utils/recomputeAllPhases.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run full test suite to verify nothing else broke**

Run: `npm run test`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add src/utils/recomputeAllPhases.ts tests/utils/recomputeAllPhases.test.ts
git commit -m "recomputeAllPhases: bucket into unchanged/changed/failed"
```

---

## Task 4: Firestore bulk writer `bulkUpdateSolvesInFirestore`

**Files:**
- Modify: `src/services/firestoreSolves.ts`

- [ ] **Step 1: Add the bulk writer**

Append to `src/services/firestoreSolves.ts`:

```typescript
/**
 * Writes `solves` back to Firestore in chunks of 100 via Promise.all(setDoc).
 * Invokes `onProgress(batchIndex, batchCount)` after each chunk completes (1-indexed).
 *
 * Chunks of 100 — not writeBatch(500) — because each solve is ~35 KB and 500 would
 * exceed Firestore's 10 MB writeBatch payload limit. See spec doc for sizing details.
 */
export async function bulkUpdateSolvesInFirestore(
  uid: string,
  solves: SolveRecord[],
  onProgress: (batchIndex: number, batchCount: number) => void = () => {},
): Promise<void> {
  const CHUNK_SIZE = 100
  const chunks: SolveRecord[][] = []
  for (let i = 0; i < solves.length; i += CHUNK_SIZE) {
    chunks.push(solves.slice(i, i + CHUNK_SIZE))
  }
  for (let i = 0; i < chunks.length; i++) {
    await Promise.all(chunks[i].map((s) => setDoc(solveDocRef(uid, s), sanitize(s))))
    onProgress(i + 1, chunks.length)
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds (tsc + vite).

- [ ] **Step 3: Commit**

```bash
git add src/services/firestoreSolves.ts
git commit -m "firestore: add bulkUpdateSolvesInFirestore (chunked setDoc, 100/chunk)"
```

---

## Task 5: `RecomputePhasesPanel` — initial state renders warning + scan button

**Files:**
- Create: `src/components/RecomputePhasesPanel.tsx`
- Test: `tests/components/RecomputePhasesPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/RecomputePhasesPanel.test.tsx`:

```tsx
// tests/components/RecomputePhasesPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecomputePhasesPanel } from '../../src/components/RecomputePhasesPanel'

describe('RecomputePhasesPanel — initial state', () => {
  it('renders target label, backup warning, and Scan button', () => {
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => []}
        commitChanges={vi.fn()}
      />
    )
    expect(screen.getByText(/Recompute phases/i)).toBeTruthy()
    expect(screen.getByText(/localStorage/)).toBeTruthy()
    expect(screen.getByText(/back up/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Scan/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/RecomputePhasesPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/components/RecomputePhasesPanel"`.

- [ ] **Step 3: Implement the initial render**

Create `src/components/RecomputePhasesPanel.tsx`:

```tsx
// src/components/RecomputePhasesPanel.tsx
import { useState } from 'react'
import { recomputeAllPhases } from '../utils/recomputeAllPhases'
import type { RecomputeResult, RecomputeChange } from '../utils/recomputeAllPhases'
import type { SolveRecord } from '../types/solve'

export interface RecomputePhasesPanelProps {
  /** Human-readable label for where writes go, e.g. 'Firestore' or 'localStorage'. */
  targetLabel: string
  /** Returns the solves to scan. Called fresh each time "Scan" is clicked. */
  loadSolves: () => Promise<SolveRecord[]> | SolveRecord[]
  /**
   * Writes the changed solves back to the target store. `onProgress(batchIndex, batchCount)`
   * is invoked during the write so the panel can render "batch X of Y".
   * For localStorage: one write, call onProgress(1, 1).
   */
  commitChanges: (
    changes: RecomputeChange[],
    onProgress: (batchIndex: number, batchCount: number) => void,
  ) => Promise<void>
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'results'; results: RecomputeResult }
  | { kind: 'committing'; results: RecomputeResult; progress: { batch: number; total: number } }
  | { kind: 'committed'; results: RecomputeResult; committedCount: number }

export function RecomputePhasesPanel({ targetLabel, loadSolves, commitChanges }: RecomputePhasesPanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })

  const runScan = async () => {
    setState({ kind: 'scanning' })
    const solves = await loadSolves()
    setState({ kind: 'results', results: recomputeAllPhases(solves) })
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#aaa' }}>
        Recompute phases ({targetLabel})
      </div>
      <div style={{ color: '#e8a020', marginBottom: 8 }}>
        ⚠️ This rewrites every solve's <code>phases</code> array. Back up your data first
        (see the Backup button in the maintenance toolbar, or <code>docs/data-backup.md</code>).
      </div>
      {state.kind === 'idle' && (
        <button onClick={runScan} style={buttonStyle('#3498db')}>Scan (dry run)</button>
      )}
      {state.kind === 'scanning' && (
        <div style={{ color: '#888' }}>Scanning...</div>
      )}
    </div>
  )
}

const boxStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc',
  padding: '12px 16px', borderRadius: 6, marginTop: 8,
}

function buttonStyle(color: string): React.CSSProperties {
  return {
    alignSelf: 'flex-start', padding: '3px 10px', cursor: 'pointer',
    background: '#222', color, border: `1px solid ${color}`, borderRadius: 3, fontSize: 11,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/RecomputePhasesPanel.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/RecomputePhasesPanel.tsx tests/components/RecomputePhasesPanel.test.tsx
git commit -m "RecomputePhasesPanel: initial render + Scan button"
```

---

## Task 6: `RecomputePhasesPanel` — render dry-run results

**Files:**
- Modify: `src/components/RecomputePhasesPanel.tsx`
- Test: `tests/components/RecomputePhasesPanel.test.tsx`

- [ ] **Step 1: Add failing tests for results rendering**

Append to `tests/components/RecomputePhasesPanel.test.tsx`:

```tsx
import { fireEvent, waitFor } from '@testing-library/react'
import type { SolveRecord } from '../../src/types/solve'
import { ROUX_SOLVE_1 } from '../fixtures/solveFixtures'
import { recomputePhases } from '../../src/utils/recomputePhases'
import { ROUX } from '../../src/methods/roux'

describe('RecomputePhasesPanel — results', () => {
  it('shows counts for each bucket after Scan', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const unchangedSolve: SolveRecord = { ...roux, id: 100, phases: fresh }
    const changedSolve: SolveRecord = { ...roux, id: 101, phases: fresh.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p) }
    const failedSolve: SolveRecord = { id: 102, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }
    const exampleSolve: SolveRecord = { id: 103, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, isExample: true }

    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [unchangedSolve, changedSolve, failedSolve, exampleSolve]}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 1/)).toBeTruthy())
    expect(screen.getByText(/Unchanged: 1/)).toBeTruthy()
    expect(screen.getByText(/Failed: 1/)).toBeTruthy()
    expect(screen.getByText(/Skipped: 1/)).toBeTruthy()
  })

  it('lists up to 5 sample changed rows with solve id and method', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const changedSolves: SolveRecord[] = Array.from({ length: 7 }, (_, i) => ({
      ...roux, id: 200 + i,
      phases: fresh.map((p, j) => j === 0 ? { ...p, turns: p.turns + 1 } : p),
    }))
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => changedSolves}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 7/)).toBeTruthy())
    // Sample rows cap at 5.
    expect(screen.getByText(/#200/)).toBeTruthy()
    expect(screen.getByText(/#204/)).toBeTruthy()
    expect(screen.queryByText(/#205/)).toBeNull()
  })

  it('lists failed solve ids so the user can investigate', async () => {
    const failedSolve: SolveRecord = { id: 300, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [failedSolve]}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Failed: 1/)).toBeTruthy())
    expect(screen.getByText(/#300/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/components/RecomputePhasesPanel.test.tsx`
Expected: FAIL — all three new tests fail, component renders nothing after Scan.

- [ ] **Step 3: Implement results rendering**

In `src/components/RecomputePhasesPanel.tsx`, add `PhaseRecord` to the existing type import from `../types/solve` so the top of the file reads:

```tsx
import type { SolveRecord, PhaseRecord } from '../types/solve'
```

Then add a helper function above the `RecomputePhasesPanel` component definition:

```tsx
/** Cumulative end-of-phase timestamps (ms from first move), formatted for display. */
function phaseBoundariesMs(phases: PhaseRecord[]): string {
  let cum = 0
  return phases.map((p) => {
    cum += p.recognitionMs + p.executionMs
    return `${p.label} ${(cum / 1000).toFixed(1)}s`
  }).join(' | ')
}
```

Replace the `return (...)` of `RecomputePhasesPanel` with:

```tsx
  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#aaa' }}>
        Recompute phases ({targetLabel})
      </div>
      <div style={{ color: '#e8a020', marginBottom: 8 }}>
        ⚠️ This rewrites every solve's <code>phases</code> array. Back up your data first
        (see the Backup button in the maintenance toolbar, or <code>docs/data-backup.md</code>).
      </div>

      {state.kind === 'idle' && (
        <button onClick={runScan} style={buttonStyle('#3498db')}>Scan (dry run)</button>
      )}

      {state.kind === 'scanning' && <div style={{ color: '#888' }}>Scanning...</div>}

      {(state.kind === 'results' || state.kind === 'committing' || state.kind === 'committed') && (
        <div>
          <div style={{ color: '#888', marginBottom: 4 }}>
            Total scanned: {state.results.unchanged.length + state.results.changed.length + state.results.failed.length + state.results.skipped.length}
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#4c4' }}>Unchanged: {state.results.unchanged.length}</span>
            {' · '}
            <span style={{ color: '#e8a020' }}>Changed: {state.results.changed.length}</span>
            {' · '}
            <span style={{ color: '#e74c3c' }}>Failed: {state.results.failed.length}</span>
            {' · '}
            <span style={{ color: '#888' }}>Skipped: {state.results.skipped.length}</span>
          </div>

          {state.results.changed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 4 }}>Sample changed (first 5):</div>
              {state.results.changed.slice(0, 5).map(({ solve, oldPhases, newPhases }) => (
                <div key={solve.id} style={{ borderTop: '1px solid #222', padding: '3px 0' }}>
                  <div>#{solve.id} <span style={{ color: '#888' }}>{solve.method ?? 'cfop'}</span></div>
                  <div style={{ color: '#e74c3c' }}>old: {phaseBoundariesMs(oldPhases)}</div>
                  <div style={{ color: '#4c4' }}>new: {phaseBoundariesMs(newPhases)}</div>
                </div>
              ))}
            </div>
          )}

          {state.results.failed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 4 }}>Failed solve ids (excluded from commit):</div>
              <div>{state.results.failed.map((s) => `#${s.id}`).join(', ')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/components/RecomputePhasesPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/RecomputePhasesPanel.tsx tests/components/RecomputePhasesPanel.test.tsx
git commit -m "RecomputePhasesPanel: render dry-run results with samples"
```

---

## Task 7: `RecomputePhasesPanel` — Commit button + progress

**Files:**
- Modify: `src/components/RecomputePhasesPanel.tsx`
- Test: `tests/components/RecomputePhasesPanel.test.tsx`

- [ ] **Step 1: Add failing tests for commit flow**

Append to `tests/components/RecomputePhasesPanel.test.tsx`:

```tsx
describe('RecomputePhasesPanel — commit', () => {
  it('Commit button is hidden when no changes', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const unchangedSolve: SolveRecord = { ...roux, id: 400, phases: fresh }
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [unchangedSolve]}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Unchanged: 1/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Commit/i })).toBeNull()
  })

  it('Commit button passes only changed solves to commitChanges and shows progress', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const changedSolve: SolveRecord = {
      ...roux, id: 500,
      phases: fresh.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p),
    }
    const failedSolve: SolveRecord = { id: 501, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }

    const commitChanges = vi.fn(async (_changes, onProgress) => { onProgress(1, 1) })

    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [changedSolve, failedSolve]}
        commitChanges={commitChanges}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 1/)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Commit 1 change/i }))
    await waitFor(() => expect(screen.getByText(/Committed 1 solve/i)).toBeTruthy())

    expect(commitChanges).toHaveBeenCalledTimes(1)
    const firstArg = commitChanges.mock.calls[0][0]
    expect(firstArg).toHaveLength(1)
    expect(firstArg[0].solve.id).toBe(500)
  })

  it('shows "batch X of Y" during commit', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const changedSolves: SolveRecord[] = Array.from({ length: 2 }, (_, i) => ({
      ...roux, id: 600 + i,
      phases: fresh.map((p, j) => j === 0 ? { ...p, turns: p.turns + 1 } : p),
    }))
    let resolveFirstBatch!: () => void
    const commitChanges = vi.fn(async (_changes, onProgress) => {
      onProgress(1, 2)
      await new Promise<void>((resolve) => { resolveFirstBatch = resolve })
      onProgress(2, 2)
    })

    render(
      <RecomputePhasesPanel
        targetLabel="Firestore"
        loadSolves={async () => changedSolves}
        commitChanges={commitChanges}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 2/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Commit 2 changes/i }))
    await waitFor(() => expect(screen.getByText(/batch 1 of 2/i)).toBeTruthy())
    resolveFirstBatch()
    await waitFor(() => expect(screen.getByText(/Committed 2 solves/i)).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/components/RecomputePhasesPanel.test.tsx`
Expected: FAIL — commit tests fail, no Commit button or progress rendered.

- [ ] **Step 3: Implement commit flow**

In `src/components/RecomputePhasesPanel.tsx`, replace the component body with:

```tsx
export function RecomputePhasesPanel({ targetLabel, loadSolves, commitChanges }: RecomputePhasesPanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })

  const runScan = async () => {
    setState({ kind: 'scanning' })
    const solves = await loadSolves()
    setState({ kind: 'results', results: recomputeAllPhases(solves) })
  }

  const runCommit = async () => {
    if (state.kind !== 'results') return
    const results = state.results
    setState({ kind: 'committing', results, progress: { batch: 0, total: 0 } })
    await commitChanges(results.changed, (batch, total) => {
      setState({ kind: 'committing', results, progress: { batch, total } })
    })
    setState({ kind: 'committed', results, committedCount: results.changed.length })
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#aaa' }}>
        Recompute phases ({targetLabel})
      </div>
      <div style={{ color: '#e8a020', marginBottom: 8 }}>
        ⚠️ This rewrites every solve's <code>phases</code> array. Back up your data first
        (see the Backup button in the maintenance toolbar, or <code>docs/data-backup.md</code>).
      </div>

      {state.kind === 'idle' && (
        <button onClick={runScan} style={buttonStyle('#3498db')}>Scan (dry run)</button>
      )}
      {state.kind === 'scanning' && <div style={{ color: '#888' }}>Scanning...</div>}

      {(state.kind === 'results' || state.kind === 'committing' || state.kind === 'committed') && (
        <div>
          <div style={{ color: '#888', marginBottom: 4 }}>
            Total scanned: {state.results.unchanged.length + state.results.changed.length + state.results.failed.length + state.results.skipped.length}
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#4c4' }}>Unchanged: {state.results.unchanged.length}</span>
            {' · '}
            <span style={{ color: '#e8a020' }}>Changed: {state.results.changed.length}</span>
            {' · '}
            <span style={{ color: '#e74c3c' }}>Failed: {state.results.failed.length}</span>
            {' · '}
            <span style={{ color: '#888' }}>Skipped: {state.results.skipped.length}</span>
          </div>

          {state.results.changed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 4 }}>Sample changed (first 5):</div>
              {state.results.changed.slice(0, 5).map(({ solve, oldPhases, newPhases }) => (
                <div key={solve.id} style={{ borderTop: '1px solid #222', padding: '3px 0' }}>
                  <div>#{solve.id} <span style={{ color: '#888' }}>{solve.method ?? 'cfop'}</span></div>
                  <div style={{ color: '#e74c3c' }}>old: {phaseBoundariesMs(oldPhases)}</div>
                  <div style={{ color: '#4c4' }}>new: {phaseBoundariesMs(newPhases)}</div>
                </div>
              ))}
            </div>
          )}

          {state.results.failed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 4 }}>Failed solve ids (excluded from commit):</div>
              <div>{state.results.failed.map((s) => `#${s.id}`).join(', ')}</div>
            </div>
          )}

          {state.kind === 'results' && state.results.changed.length > 0 && (
            <button onClick={runCommit} style={buttonStyle('#e8a020')}>
              Commit {state.results.changed.length} change{state.results.changed.length === 1 ? '' : 's'}
            </button>
          )}

          {state.kind === 'committing' && (
            <div style={{ color: '#e8a020' }}>
              Committing batch {state.progress.batch} of {state.progress.total}...
            </div>
          )}

          {state.kind === 'committed' && (
            <div style={{ color: '#4c4' }}>
              Committed {state.committedCount} solve{state.committedCount === 1 ? '' : 's'}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/components/RecomputePhasesPanel.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: PASS (all green).

- [ ] **Step 6: Commit**

```bash
git add src/components/RecomputePhasesPanel.tsx tests/components/RecomputePhasesPanel.test.tsx
git commit -m "RecomputePhasesPanel: commit flow with batch progress"
```

---

## Task 8: Mount panel in `App.tsx` — localStorage variant

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the panel**

Add to the import block at the top of `src/App.tsx` (near the other `components/` imports):

```typescript
import { RecomputePhasesPanel } from './components/RecomputePhasesPanel'
import type { RecomputeChange } from './utils/recomputeAllPhases'
```

- [ ] **Step 2: Mount the local-storage panel under the maintenance toolbar**

In `src/App.tsx`, locate the maintenance-toolbar block that ends with the `Import from acubemy` button and the closing `</div>` at line ~438 (the `<div>` that began at ~line 388: `style={{ padding: '12px 0', textAlign: 'center', display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}`).

Immediately **after** that closing `</div>` (and before the `{methodMismatches !== null && (` block that starts at ~line 439), insert:

```tsx
          <RecomputePhasesPanel
            targetLabel="localStorage"
            loadSolves={() => loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])}
            commitChanges={async (changes: RecomputeChange[], onProgress) => {
              const solves = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
              const byId = new Map(changes.map((c) => [c.solve.id, c.newPhases]))
              const updated = solves.map((s) => byId.has(s.id) ? { ...s, phases: byId.get(s.id)! } : s)
              saveToStorage(STORAGE_KEYS.SOLVES, updated)
              onProgress(1, 1)
            }}
          />
```

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run dev`, open the app, toggle to **[debug]** mode, scroll to the maintenance toolbar — the new panel should appear below the "Import from acubemy" row with:
- Yellow warning about backing up.
- "Scan (dry run)" button.

Click Scan on a non-empty localStorage; verify count summary, sample changed rows (if any), and (if there are changes) a "Commit N changes" button. Click Commit and verify the status changes to "Committed N solve(s)." Reload and re-scan — this time "Changed: 0" because the write is idempotent.

If you can't verify UI, state so explicitly.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "App: mount RecomputePhasesPanel for localStorage"
```

---

## Task 9: Mount panel in `App.tsx` — Firestore variant

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the Firestore writer**

Add `bulkUpdateSolvesInFirestore` to the existing import from `./services/firestoreSolves` (line ~22). The final import should include the new symbol:

```typescript
import {
  renumberSolvesInFirestore, recalibrateSolvesInFirestore, loadSolvesFromFirestore,
  updateSolveInFirestore, deleteSolveFromFirestore, migrateSolvesToV2InFirestore,
  addSolveToFirestore, loadNextSeqFromFirestore, updateCounterInFirestore,
  bulkUpdateSolvesInFirestore,
} from './services/firestoreSolves'
```

- [ ] **Step 2: Mount the Firestore panel inside the Cloud Sync signed-in block**

Locate the "Detect method mismatches" button inside the signed-in cloud block (~line 362-374). That button lives inside a `<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>`. Immediately **after** that cloud "Detect method mismatches" `<button>` and its closing tag, still inside the same column flex `<div>`, insert:

```tsx
                <RecomputePhasesPanel
                  targetLabel="Firestore"
                  loadSolves={async () => {
                    if (!cloudSync.user) return []
                    return await loadSolvesFromFirestore(cloudSync.user.uid)
                  }}
                  commitChanges={async (changes: RecomputeChange[], onProgress) => {
                    if (!cloudSync.user) return
                    const updated = changes.map((c) => ({ ...c.solve, phases: c.newPhases }))
                    await bulkUpdateSolvesInFirestore(cloudSync.user.uid, updated, onProgress)
                  }}
                />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual spot-check (cloud)**

Run: `npm run dev`. Sign in with Google, enable cloud sync, toggle debug mode, scroll to the Cloud Sync panel. Below "Detect method mismatches", the new panel should appear. Click Scan; counts appear. If there are changes, click Commit; "batch 1 of 1" (or higher) displays, then "Committed N solve(s)." Re-scan → "Changed: 0."

If Firestore is empty or you can't sign in, state so explicitly — don't fabricate the outcome.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "App: mount RecomputePhasesPanel for Firestore"
```

---

## Task 10: Update `docs/debug-mode.md`

**Files:**
- Modify: `docs/debug-mode.md`

- [ ] **Step 1: Add the panel to the Cloud Sync section**

In `docs/debug-mode.md`, find the "When **signed in**:" bullet list (starts around line 27). Append a new bullet at the end of that list (after "Detect method mismatches"):

```markdown
- **Recompute phases (Firestore)** — inline `<RecomputePhasesPanel>` that scans all Firestore solves, recomputes `phases` using the current `isDone` predicates, shows a dry-run summary (unchanged / changed / failed / skipped counts + up to 5 sample rows + failed ids), and commits only the changed, successfully-recomputed solves via chunked `Promise.all(setDoc)` (100 per chunk). See `src/utils/recomputeAllPhases.ts` and spec `docs/superpowers/specs/2026-04-20-bulk-recompute-phases-design.md`.
```

- [ ] **Step 2: Add the panel to the Maintenance section**

Find the "Maintenance buttons (bottom toolbar)" bulleted list. Append at the end of that list:

```markdown
- **Recompute phases (localStorage)** — same component as the cloud variant, targeting `localStorage`. Commits via a single `saveToStorage` write.
```

- [ ] **Step 3: Verify the file still reads cleanly**

Run: `head -80 docs/debug-mode.md` and `tail -40 docs/debug-mode.md` — the bullets should appear in the correct sections and nothing else should have moved.

- [ ] **Step 4: Commit**

```bash
git add docs/debug-mode.md
git commit -m "docs: document Recompute phases debug panels"
```

---

## Task 11: Devlog entry

**Files:**
- Modify: `docs/devlog.md`

- [ ] **Step 1: Determine the version**

Check the most recent devlog heading and the latest git tag:

```bash
head -40 docs/devlog.md
git tag --sort=-v:refname | head -5
```

Expected: the most recent release is `v1.24.1`. This session ships a new feature, so use the next minor: `v1.25.0`.

- [ ] **Step 2: Add a TL;DR row**

In `docs/devlog.md`, find the TL;DR table at the top (right after the intro and learning-tags reference). Insert a new row at the top of the table's data rows (newest first):

```markdown
| [v1.25.0](#v1250--bulk-recompute-phases-YYYY-MM-DD-HHMM) | bulk recompute phases debug panel (localStorage + Firestore) |
```

Replace `YYYY-MM-DD-HHMM` with the actual timestamp when you take it from `git log -1 --format=%ci` on the final commit of this session.

- [ ] **Step 3: Add the detailed entry**

Insert the following block directly below the "Entries (newest first)" heading (or whichever heading the existing entries sit under — match the current style exactly):

```markdown
## v1.25.0 — bulk recompute phases (YYYY-MM-DD HH:MM)

**Review:** not yet

**Design docs:**
- Bulk Recompute Phases: [Spec](superpowers/specs/2026-04-20-bulk-recompute-phases-design.md) [Plan](superpowers/plans/2026-04-20-bulk-recompute-phases.md)

**What was built:**
- `src/utils/recomputeAllPhases.ts` — pure scanner returning `{unchanged, changed, failed, skipped}`.
- `src/components/RecomputePhasesPanel.tsx` — inline debug panel: dry-run scan → sample rows → commit only changed + successfully-recomputed solves.
- `src/services/firestoreSolves.ts` — `bulkUpdateSolvesInFirestore(uid, solves, onProgress)`; chunked `Promise.all(setDoc)` at 100 per chunk.
- `src/App.tsx` — mounted the panel twice (once in Cloud Sync signed-in block, once in the maintenance toolbar), mirroring the v1.9 method-mismatch two-button split.
- Docs: `debug-mode.md` updated with both buttons.

**Key technical learnings:**
- `[note]` Firestore `writeBatch(500)` would exceed the 10 MB payload limit at our ~35 KB per solve; chunked `Promise.all(setDoc)` at 100 per chunk is the right pattern and matches existing bulk handlers in `firestoreSolves.ts`.
- `[insight]` Failed recomputes (moves don't replay to solved) are surfaced but excluded from commit — writing anything back on a solve whose own moves don't replay would compound bad data.

**Process learnings:**
- `[note]` Extracting the panel out of `App.tsx` (unlike the v1.9 mismatch scanner which is inlined) kept `App.tsx` from growing further — pattern to prefer for new debug panels.
```

Replace the `YYYY-MM-DD HH:MM` placeholder with the actual timestamp of the final commit of this session, obtained via:

```bash
git log -1 --format='%cd' --date=format:'%Y-%m-%d %H:%M'
```

Update the TL;DR row anchor (from Step 2) to match — the auto-generated anchor for `## v1.25.0 — bulk recompute phases (2026-04-21 09:15)` is `v1250--bulk-recompute-phases-2026-04-21-0915` (lowercase, strip punctuation except hyphens, spaces→hyphens).

- [ ] **Step 4: Cross off done items in `future.md` if any match**

Check `future.md` for any backlog items that this feature satisfies. Cross them out with strikethrough and a version tag matching existing style, e.g.:

```markdown
- ~~Bulk recompute phases across all solves~~ (v1.25.0)
```

If no matching items exist, skip this step.

- [ ] **Step 5: Final build + test pass**

Run: `npm run build && npm run test && npm run lint`
Expected: all three green.

- [ ] **Step 6: Commit**

```bash
git add docs/devlog.md future.md
git commit -m "docs: devlog v1.25.0 bulk recompute phases"
```

- [ ] **Step 7: Tag the release**

```bash
git tag v1.25.0
```

Do NOT push — the user will decide when to push.

---

## Summary

11 tasks, each independently committable. The panel component is unit-testable in isolation thanks to injected `loadSolves` and `commitChanges` callbacks — the same component is mounted twice in `App.tsx` with different callbacks for localStorage vs Firestore. The chunked Firestore writer matches the existing bulk patterns in `firestoreSolves.ts`.

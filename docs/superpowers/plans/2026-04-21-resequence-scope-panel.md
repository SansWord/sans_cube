# Resequence Scope Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blind `confirm()`-based "Renumber solves (fix seq)" button in debug mode with a `<ResequenceScopePanel>` that previews total count, first-mismatch cursor, and renumber count before the user commits — and also extract a shared `<DebugPanel>` shell used by both this and `<RecomputePhasesPanel>`.

**Architecture:** A new pure helper `previewRenumberScope` computes scope from the in-memory solve snapshot (no I/O). `renumberSolvesInFirestore` is updated to tail-only semantics and uses the existing `bulkUpdateSolvesInFirestore` chunked writer. `<DebugPanel>` is a presentational shell that provides box/title/warning/disabled chrome; each panel keeps its own state machine. `<ResequenceScopePanel>` wires the helper and updated Firestore function together via props passed from `App.tsx`.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Firebase Firestore (existing), existing `bulkUpdateSolvesInFirestore` chunked writer.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/previewRenumberScope.ts` | Create | Pure preview helper — sort + scan + count, no I/O |
| `tests/utils/previewRenumberScope.test.ts` | Create | Unit tests for all edge cases |
| `src/components/DebugPanel.tsx` | Create | Shared box/title/warning/disabled shell + exported `buttonStyle` |
| `src/components/ResequenceScopePanel.tsx` | Create | Panel with `idle→ready→committing→committed` state machine |
| `src/services/firestoreSolves.ts` | Modify | Update `renumberSolvesInFirestore` to tail-only, chunked, expanded return |
| `src/components/RecomputePhasesPanel.tsx` | Modify | Refactor onto `<DebugPanel>`; remove local `boxStyle` and `buttonStyle` |
| `src/App.tsx` | Modify | Remove `renumbering` state + old button; import + render `<ResequenceScopePanel>` |
| `docs/debug-mode.md` | Modify | Replace old button bullet with panel description |
| `docs/ui-architecture.md` | Modify | Add `DebugPanel` and `ResequenceScopePanel` to component list |

---

## Task 1: `previewRenumberScope` pure helper

**Files:**
- Create: `src/utils/previewRenumberScope.ts`

- [ ] **Step 1.1: Create `src/utils/previewRenumberScope.ts`**

```ts
import type { SolveRecord } from '../types/solve'

export interface RenumberScope {
  totalCount: number
  firstMismatchIndex: number
  firstMismatchSolve: SolveRecord | null
  renumberedCount: number
}

export function previewRenumberScope(solves: SolveRecord[]): RenumberScope {
  const sorted = [...solves].sort((a, b) => a.date - b.date)
  const totalCount = sorted.length
  const firstMismatchIndex = sorted.findIndex((s, i) => s.seq !== i + 1)
  if (firstMismatchIndex === -1) {
    return { totalCount, firstMismatchIndex: -1, firstMismatchSolve: null, renumberedCount: 0 }
  }
  let renumberedCount = 0
  for (let i = firstMismatchIndex; i < sorted.length; i++) {
    if (sorted[i].seq !== i + 1) renumberedCount++
  }
  return {
    totalCount,
    firstMismatchIndex,
    firstMismatchSolve: sorted[firstMismatchIndex],
    renumberedCount,
  }
}
```

- [ ] **Step 1.2: Commit**

```bash
git add src/utils/previewRenumberScope.ts
git commit -m "feat: add previewRenumberScope pure helper"
```

---

## Task 2: Unit tests for `previewRenumberScope`

**Files:**
- Create: `tests/utils/previewRenumberScope.test.ts`

- [ ] **Step 2.1: Write tests**

Create `tests/utils/previewRenumberScope.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { previewRenumberScope } from '../../src/utils/previewRenumberScope'
import type { SolveRecord } from '../../src/types/solve'

function makeSolve(id: number, seq: number, date: number): SolveRecord {
  return { id, seq, date, scramble: '', timeMs: 0, moves: [], phases: [] }
}

describe('previewRenumberScope', () => {
  it('empty solves → totalCount 0, no mismatch, renumberedCount 0', () => {
    const result = previewRenumberScope([])
    expect(result).toEqual({
      totalCount: 0,
      firstMismatchIndex: -1,
      firstMismatchSolve: null,
      renumberedCount: 0,
    })
  })

  it('all seq already 1..n → no mismatch, renumberedCount 0', () => {
    const solves = [makeSolve(1, 1, 1000), makeSolve(2, 2, 2000), makeSolve(3, 3, 3000)]
    const result = previewRenumberScope(solves)
    expect(result).toEqual({
      totalCount: 3,
      firstMismatchIndex: -1,
      firstMismatchSolve: null,
      renumberedCount: 0,
    })
  })

  it('all seq wrong from index 0 → firstMismatchIndex 0, renumberedCount = full length', () => {
    const solves = [makeSolve(1, 5, 1000), makeSolve(2, 6, 2000), makeSolve(3, 7, 3000)]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(0)
    expect(result.firstMismatchSolve).toEqual(solves[0])
    expect(result.renumberedCount).toBe(3)
    expect(result.totalCount).toBe(3)
  })

  it('tail-mismatch: first two correct, rest wrong → firstMismatchIndex 2', () => {
    const solves = [
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
      makeSolve(3, 9, 3000),
      makeSolve(4, 10, 4000),
    ]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(2)
    expect(result.firstMismatchSolve).toEqual(solves[2])
    expect(result.renumberedCount).toBe(2)
  })

  it('mixed-skip: tail row coincidentally matches target → skipped in renumberedCount', () => {
    // stored: [1, 2, 4, 4, 5] — target: [1, 2, 3, 4, 5]
    // firstMismatch at index 2 (seq=4, target=3)
    // index 3: seq=4, target=4 → already correct → skipped
    // index 4: seq=5, target=5 → already correct → skipped
    const solves = [
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
      makeSolve(3, 4, 3000),
      makeSolve(4, 4, 4000),
      makeSolve(5, 5, 5000),
    ]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(2)
    expect(result.renumberedCount).toBe(1)
  })

  it('unsorted input → sorts by date before scanning, same result as sorted', () => {
    // Same solves in wrong order: dates 3000, 1000, 2000 → should sort to 1000, 2000, 3000
    const unsorted = [
      makeSolve(3, 3, 3000),
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
    ]
    const sorted = [
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
      makeSolve(3, 3, 3000),
    ]
    expect(previewRenumberScope(unsorted)).toEqual(previewRenumberScope(sorted))
  })

  it('unsorted input with mismatch → correct firstMismatchSolve after sort', () => {
    // After sorting by date: [seq=1 date=1000, seq=5 date=2000, seq=3 date=3000]
    // First mismatch at index 1 (seq=5, target=2)
    const solves = [
      makeSolve(3, 3, 3000),
      makeSolve(1, 1, 1000),
      makeSolve(2, 5, 2000),
    ]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(1)
    expect(result.firstMismatchSolve?.id).toBe(2) // the solve with date=2000
  })
})
```

- [ ] **Step 2.2: Run tests to verify all pass**

```bash
npm run test -- tests/utils/previewRenumberScope.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 2.3: Commit**

```bash
git add tests/utils/previewRenumberScope.test.ts
git commit -m "test: add previewRenumberScope unit tests"
```

---

## Task 3: Update `renumberSolvesInFirestore` to tail-only semantics

**Files:**
- Modify: `src/services/firestoreSolves.ts` (lines 59–75)

This is the existing function at lines 64–75. Replace it entirely with the new implementation.

- [ ] **Step 3.1: Replace `renumberSolvesInFirestore` in `src/services/firestoreSolves.ts`**

Find and replace the entire function (lines 59–75 including JSDoc):

```ts
/**
 * Renumbers Firestore solves tail-only: preserves rows before the first seq mismatch,
 * renumbers from the mismatch forward (filtering to only rows whose seq actually differs
 * from the target). Counter is always updated. Chunked via bulkUpdateSolvesInFirestore.
 * Returns expanded result for the scope panel commit callback.
 */
export async function renumberSolvesInFirestore(
  uid: string,
  onProgress?: (batchIndex: number, batchCount: number) => void,
): Promise<{
  nextSeq: number
  renumbered: number
  firstMismatchIndex: number
  firstMismatchSolve: SolveRecord | null
}> {
  const raw = await loadSolvesFromFirestore(uid)
  const solves = [...raw].sort((a, b) => a.date - b.date)
  const nextSeq = solves.length + 1
  const firstMismatchIndex = solves.findIndex((s, i) => s.seq !== i + 1)

  if (firstMismatchIndex === -1) {
    await updateCounterInFirestore(uid, nextSeq)
    return { nextSeq, renumbered: 0, firstMismatchIndex: -1, firstMismatchSolve: null }
  }

  const changed: SolveRecord[] = []
  for (let i = firstMismatchIndex; i < solves.length; i++) {
    const target = i + 1
    if (solves[i].seq !== target) {
      changed.push({ ...solves[i], seq: target })
    }
  }

  await bulkUpdateSolvesInFirestore(uid, changed, onProgress ?? (() => {}))
  await updateCounterInFirestore(uid, nextSeq)

  return {
    nextSeq,
    renumbered: changed.length,
    firstMismatchIndex,
    firstMismatchSolve: solves[firstMismatchIndex],
  }
}
```

- [ ] **Step 3.2: Run tests to verify nothing broke**

```bash
npm run test
```

Expected: all existing tests pass (no `firestoreSolves.ts` unit tests exist, so no test failures expected from this change).

- [ ] **Step 3.3: Commit**

```bash
git add src/services/firestoreSolves.ts
git commit -m "feat: update renumberSolvesInFirestore to tail-only chunked semantics"
```

---

## Task 4: Create `<DebugPanel>` shell component

**Files:**
- Create: `src/components/DebugPanel.tsx`

- [ ] **Step 4.1: Create `src/components/DebugPanel.tsx`**

```tsx
import type { ReactNode, CSSProperties } from 'react'

interface DebugPanelProps {
  title: string
  warning?: ReactNode
  disabled?: boolean
  disabledHint?: ReactNode
  children: ReactNode
}

const boxStyle: CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc',
  padding: '12px 16px', borderRadius: 6, marginTop: 8,
}

export function DebugPanel({ title, warning, disabled, disabledHint, children }: DebugPanelProps) {
  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#aaa' }}>
        {title}
      </div>
      {warning && (
        <div style={{ color: '#e8a020', marginBottom: 8 }}>
          {warning}
        </div>
      )}
      {disabled ? (
        <>
          {disabledHint && (
            <div style={{ color: '#666', marginBottom: 8 }}>
              {disabledHint}
            </div>
          )}
          <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  )
}

export function buttonStyle(color: string, disabled = false): CSSProperties {
  return {
    alignSelf: 'flex-start', padding: '3px 10px', cursor: disabled ? 'default' : 'pointer',
    background: '#222', color, border: `1px solid ${color}`, borderRadius: 3, fontSize: 11,
    opacity: disabled ? 0.6 : 1,
  }
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/components/DebugPanel.tsx
git commit -m "feat: add DebugPanel shared shell component and buttonStyle helper"
```

---

## Task 5: Refactor `<RecomputePhasesPanel>` onto `<DebugPanel>`

**Files:**
- Modify: `src/components/RecomputePhasesPanel.tsx`

No behavior change — move chrome into `<DebugPanel>`, import `buttonStyle` from it.

- [ ] **Step 5.1: Update imports in `src/components/RecomputePhasesPanel.tsx`**

At the top of the file, add the import:

```ts
import { DebugPanel, buttonStyle } from './DebugPanel'
```

- [ ] **Step 5.2: Replace the return statement**

Find this block at the bottom of the component (lines 95–103 in the current file):

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
```

Replace it with:

```tsx
  return (
    <DebugPanel
      title={`Recompute phases (${targetLabel})`}
      warning={<>⚠️ This rewrites every solve's <code>phases</code> array. Back up your data first
        (see the Backup button in the maintenance toolbar, or <code>docs/data-backup.md</code>).</>}
    >
```

And replace the closing `</div>` of the outer wrapper (the last `</div>` of the return) with `</DebugPanel>`.

- [ ] **Step 5.3: Delete local `boxStyle` and `buttonStyle` from `RecomputePhasesPanel.tsx`**

Remove these lines at the bottom of the file (lines 197–208):

```ts
const boxStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc',
  padding: '12px 16px', borderRadius: 6, marginTop: 8,
}

function buttonStyle(color: string, disabled = false): React.CSSProperties {
  return {
    alignSelf: 'flex-start', padding: '3px 10px', cursor: disabled ? 'default' : 'pointer',
    background: '#222', color, border: `1px solid ${color}`, borderRadius: 3, fontSize: 11,
    opacity: disabled ? 0.6 : 1,
  }
}
```

Also remove the `React` type qualifier from the imports at the top if it's no longer needed. The file likely imports from `'react'` — check whether `React.CSSProperties` was the only usage of the `React` namespace. If `useState` is imported as a named import (`import { useState } from 'react'`), then `React.CSSProperties` references can be replaced with `CSSProperties` from `'./DebugPanel'`'s re-export or removed if not used elsewhere.

Actually, `RecomputePhasesPanel.tsx` uses `React.CSSProperties` in two places: the `boxStyle` and `buttonStyle` return types — both of which are being deleted. So no `React.CSSProperties` reference will remain. The existing import `import { useState } from 'react'` is a named import (not namespace import), so there's no `React` namespace to remove.

- [ ] **Step 5.4: Run existing `RecomputePhasesPanel` tests**

```bash
npm run test -- tests/components/RecomputePhasesPanel.test.tsx
```

Expected: all tests pass. The tests query by text content and button roles, which are still present in the refactored render output. If any test fails, inspect the failure — it likely means a text query no longer matches due to DOM restructuring. Fix minimally (update selector, not test logic).

- [ ] **Step 5.5: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5.6: Commit**

```bash
git add src/components/RecomputePhasesPanel.tsx
git commit -m "refactor: migrate RecomputePhasesPanel onto shared DebugPanel shell"
```

---

## Task 6: Create `<ResequenceScopePanel>` component

**Files:**
- Create: `src/components/ResequenceScopePanel.tsx`

- [ ] **Step 6.1: Create `src/components/ResequenceScopePanel.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { SolveRecord } from '../types/solve'
import { DebugPanel, buttonStyle } from './DebugPanel'
import { previewRenumberScope } from '../utils/previewRenumberScope'
import type { RenumberScope } from '../utils/previewRenumberScope'

export interface ResequenceScopePanelProps {
  disabled: boolean
  loadSolves: () => SolveRecord[]
  commit: (onProgress: (batch: number, total: number) => void) => Promise<number>
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'ready'; scope: RenumberScope }
  | { kind: 'committing'; scope: RenumberScope; progress: { batch: number; total: number } }
  | { kind: 'committed'; count: number }

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

export function ResequenceScopePanel({ disabled, loadSolves, commit }: ResequenceScopePanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })

  useEffect(() => {
    if (state.kind !== 'committed') return
    const timer = setTimeout(() => setState({ kind: 'idle' }), 3000)
    return () => clearTimeout(timer)
  }, [state.kind])

  const handlePreview = () => {
    const scope = previewRenumberScope(loadSolves())
    setState({ kind: 'ready', scope })
  }

  const handleCommit = async (scope: RenumberScope) => {
    setState({ kind: 'committing', scope, progress: { batch: 0, total: 0 } })
    const count = await commit((batch, total) => {
      setState({ kind: 'committing', scope, progress: { batch, total } })
    })
    setState({ kind: 'committed', count })
  }

  const warning = (
    <>⚠️ Rewrites <code>seq</code> on Firestore solves starting at the first mismatch.
    Back up your data first (see <code>docs/data-backup.md</code>).</>
  )
  const disabledHint = (
    <>Requires cloud sync. Sign in and enable cloud sync in the Cloud Sync panel above.</>
  )

  return (
    <DebugPanel
      title="Resequence solves (Firestore)"
      warning={warning}
      disabled={disabled}
      disabledHint={disabledHint}
    >
      {state.kind === 'idle' && (
        <button onClick={handlePreview} style={buttonStyle('#3498db')}>
          Preview renumber scope
        </button>
      )}

      {state.kind === 'ready' && (
        <div>
          <div style={{ marginBottom: 6 }}>
            Total solves: {state.scope.totalCount}
          </div>
          {state.scope.firstMismatchIndex === -1 ? (
            <div style={{ color: '#4c4', marginBottom: 8 }}>
              ✓ All solves already sequential. Nothing to renumber.
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <div>
                First mismatch: #{state.scope.firstMismatchSolve!.id} ({formatDate(state.scope.firstMismatchSolve!.date)}) —
                stored seq {state.scope.firstMismatchSolve!.seq}, should be {state.scope.firstMismatchIndex + 1}
              </div>
              {state.scope.renumberedCount > 0 && (
                <div style={{ color: '#e8a020', marginTop: 4 }}>
                  Will renumber {state.scope.renumberedCount} solves.
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => void handleCommit(state.scope)}
              disabled={state.scope.renumberedCount === 0}
              style={buttonStyle('#e8a020', state.scope.renumberedCount === 0)}
            >
              Commit {state.scope.renumberedCount} change{state.scope.renumberedCount === 1 ? '' : 's'}
            </button>
            <button onClick={() => setState({ kind: 'idle' })} style={buttonStyle('#888')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.kind === 'committing' && (
        <div style={{ color: '#e8a020' }}>
          Renumbering... batch {state.progress.batch} of {state.progress.total}
        </div>
      )}

      {state.kind === 'committed' && (
        <div style={{ color: '#4c4' }}>
          ✓ Renumbered {state.count} solves.
        </div>
      )}
    </DebugPanel>
  )
}
```

- [ ] **Step 6.2: Run TypeScript check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/ResequenceScopePanel.tsx
git commit -m "feat: add ResequenceScopePanel with preview/commit state machine"
```

---

## Task 7: Wire `<ResequenceScopePanel>` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 7.1: Add import for `ResequenceScopePanel` in `src/App.tsx`**

After line 29 (`import { RecomputePhasesPanel } ...`), add:

```ts
import { ResequenceScopePanel } from './components/ResequenceScopePanel'
```

- [ ] **Step 7.2: Remove `renumbering` state declaration**

Remove this line (currently at `src/App.tsx:82`):

```ts
const [renumbering, setRenumbering] = useState<'idle' | 'running' | 'done'>('idle')
```

- [ ] **Step 7.3: Remove the old renumber button**

Remove the entire button block (currently `src/App.tsx:292-306`):

```tsx
<button
  disabled={renumbering !== 'idle'}
  onClick={async () => {
    if (!cloudSync.user) return
    if (!confirm('Renumber all cloud solves 1..n by date? This cannot be undone.')) return
    setRenumbering('running')
    const nextSeq = await solveStore.runBulkOp(() => renumberSolvesInFirestore(cloudSync.user!.uid))
    localStorage.setItem(STORAGE_KEYS.NEXT_ID, String(nextSeq))
    setRenumbering('done')
    setTimeout(() => window.location.reload(), 1000)
  }}
  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: renumbering !== 'idle' ? 'default' : 'pointer', background: '#222', color: renumbering === 'done' ? '#4c4' : '#e8a020', border: `1px solid ${renumbering === 'done' ? '#4c4' : '#e8a020'}`, borderRadius: 3, fontSize: 11 }}
>
  {renumbering === 'running' ? 'Renumbering...' : renumbering === 'done' ? 'Done! Reloading...' : 'Renumber solves (fix seq)'}
</button>
```

- [ ] **Step 7.4: Add `<ResequenceScopePanel>` after `<RecomputePhasesPanel>`**

Find the closing `/>` of `<RecomputePhasesPanel>` (currently around `src/App.tsx:435`):

```tsx
          />
          {methodMismatches !== null && (
```

Add the new panel between them:

```tsx
          />
          <ResequenceScopePanel
            disabled={!(cloudSync.enabled && cloudSync.user)}
            loadSolves={() => solveStore.getSnapshot().solves}
            commit={async (onProgress) => {
              const result = await solveStore.runBulkOp(() =>
                renumberSolvesInFirestore(cloudSync.user!.uid, onProgress)
              )
              localStorage.setItem(STORAGE_KEYS.NEXT_ID, String(result.nextSeq))
              await solveStore.reload()
              return result.renumbered
            }}
          />
          {methodMismatches !== null && (
```

- [ ] **Step 7.5: Run TypeScript check and tests**

```bash
npm run build && npm run test
```

Expected: no TypeScript errors, all tests pass.

- [ ] **Step 7.6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire ResequenceScopePanel into App.tsx, remove old renumber button"
```

---

## Task 8: Update docs

**Files:**
- Modify: `docs/debug-mode.md`
- Modify: `docs/ui-architecture.md`

### 8a. `docs/debug-mode.md`

- [ ] **Step 8a.1: Read current debug-mode.md to find the renumber button entry**

Read `docs/debug-mode.md` and locate:
1. The "Renumber solves (fix seq)" bullet under the Cloud Sync panel section — **remove it**.
2. The maintenance toolbar panels section — **add** a bullet for `ResequenceScopePanel` below the `RecomputePhasesPanel` bullet.

The new bullet should read:

```markdown
- **Resequence solves (Firestore)** (`ResequenceScopePanel`): Previews the scope of a `seq` renumber operation — shows total solve count, first-mismatch cursor (`#id`, date, stored seq vs. target seq), and how many rows will be renumbered. Cloud-only panel; shows disabled hint when cloud sync is off. Commit uses `bulkUpdateSolvesInFirestore` (chunks of 100) with batch progress. After commit: updates `NEXT_ID` in `localStorage`, calls `solveStore.reload()` (no page reload).
```

- [ ] **Step 8a.2: Commit debug-mode.md update**

```bash
git add docs/debug-mode.md
git commit -m "docs: update debug-mode.md for ResequenceScopePanel"
```

### 8b. `docs/ui-architecture.md`

- [ ] **Step 8b.1: Add `DebugPanel` and `ResequenceScopePanel` to the component list**

Read `docs/ui-architecture.md` and find the components section. Add entries:

```markdown
- **`DebugPanel`** — presentational shell for debug panels: box/title/warning chrome, disabled dimming with hint. Exports `buttonStyle` helper. No state.
- **`ResequenceScopePanel`** — debug panel for previewing and committing Firestore `seq` renumber. Props: `disabled`, `loadSolves`, `commit`. State machine: `idle → ready → committing → committed`. Uses `DebugPanel`, `previewRenumberScope`, `buttonStyle`.
```

Also update the `App.tsx` debug panel stack to reflect that `<ResequenceScopePanel>` now appears after `<RecomputePhasesPanel>`.

- [ ] **Step 8b.2: Commit ui-architecture.md update**

```bash
git add docs/ui-architecture.md
git commit -m "docs: add DebugPanel and ResequenceScopePanel to ui-architecture.md"
```

---

## Scope Coverage Self-Check

| Spec requirement | Covered by |
|-----------------|------------|
| `previewRenumberScope` pure helper with RenumberScope interface | Task 1 |
| Unit tests: empty, all-correct, full-mismatch, tail-mismatch, mixed-skip, unsorted | Task 2 |
| `renumberSolvesInFirestore` tail-only + chunked + expanded return | Task 3 |
| Counter update after writes (ordering note) | Task 3 — `await bulkUpdate` then `await updateCounter` |
| `<DebugPanel>` shell with title/warning/disabled/disabledHint | Task 4 |
| `buttonStyle` exported from `DebugPanel.tsx` | Task 4 |
| Refactor `<RecomputePhasesPanel>` onto `<DebugPanel>` | Task 5 |
| Existing `RecomputePhasesPanel` tests still pass | Task 5, step 5.4 |
| `<ResequenceScopePanel>` with idle→ready→committing→committed state machine | Task 6 |
| Preview: total count, first-mismatch cursor, renumbered count | Task 6 |
| Commit button disabled when `renumberedCount === 0` (visible, not hidden) | Task 6 |
| Auto-reset to idle 3000ms after committed | Task 6 — `useEffect` timer |
| Disabled rendering: dims children + shows hint | Task 4 — `DebugPanel` |
| `App.tsx`: remove `renumbering` state + old button | Task 7 |
| `App.tsx`: add `<ResequenceScopePanel>` with correct commit callback | Task 7 |
| Commit callback: `runBulkOp`, update `NEXT_ID`, `solveStore.reload()` | Task 7 |
| No page reload (uses `solveStore.reload()`) | Task 7 |
| `docs/debug-mode.md` updated | Task 8a |
| `docs/ui-architecture.md` updated | Task 8b |
| Manual QA for `renumberSolvesInFirestore` (no unit test — deliberate) | Noted in spec; covered by manual QA steps outside this plan |

## Notes for Manual QA (post-implementation)

After shipping, manually verify via Firebase console + app UI:
1. With cloud sync enabled and mismatched seq values: click "Preview renumber scope" → verify counts and first-mismatch cursor are correct.
2. Click "Commit N changes" → verify Firestore docs updated, `NEXT_ID` in `localStorage` updated, solve list reloads without page reload.
3. With cloud sync disabled: verify panel is dimmed and hint is shown; buttons are unclickable.
4. With all seq already correct: verify "Nothing to renumber" message, Commit button disabled.

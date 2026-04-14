# Method Update in SolveDetailModal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users change a solve's method (CFOP ↔ Roux, extensible to future methods) directly in `SolveDetailModal`, recomputing phases from stored moves and persisting the updated record.

**Architecture:** A pure `recomputePhases(solve, method)` utility replays the solve's moves against facelets to detect phase transitions and reconstruct timing from `cubeTimestamp` diffs. `useSolveHistory` gains an `updateSolve` callback that writes to localStorage or Firestore. `SolveDetailModal` renders a `MethodSelector` in the analysis header, calls `recomputePhases` on change, and disables mutating controls while saving.

**Tech Stack:** React 19, TypeScript, Vitest, Firebase Firestore (`setDoc`), `applyMoveToFacelets` from `useCubeState`, `parseScramble` from `utils/scramble`, `isSolvedFacelets` from `useCubeState`.

**Spec:** `docs/superpowers/specs/2026-04-13-method-update-design.md`

---

## File Map

| File | Action |
|------|--------|
| `src/utils/recomputePhases.ts` | **Create** — pure phase recompute utility |
| `tests/utils/recomputePhases.test.ts` | **Create** — unit tests |
| `src/services/firestoreSolves.ts` | **Modify** — add `updateSolveInFirestore` |
| `src/hooks/useSolveHistory.ts` | **Modify** — add `updateSolve`, return it from hook |
| `tests/hooks/useSolveHistory.test.ts` | **Modify** — add `updateSolve` tests |
| `src/components/SolveDetailModal.tsx` | **Modify** — `onUpdate` prop, `localSolve`/`saving`/`methodError` state, `MethodSelector` in analysis header |
| `src/components/TimerScreen.tsx` | **Modify** — pass `onUpdate` to `SolveDetailModal` |
| `docs/ui-architecture.md` | **Modify** — update `TimerScreen` hook table, `SolveDetailModal` section |
| `docs/firebase-cloud-sync.md` | **Modify** — note `updateSolveInFirestore` |

---

## Task 1: `recomputePhases` utility

**Files:**
- Create: `src/utils/recomputePhases.ts`

- [ ] **Step 1: Create the file with types and the scrambled-facelets helper**

```ts
// src/utils/recomputePhases.ts
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets, isSolvedFacelets } from '../hooks/useCubeState'
import { parseScramble } from './scramble'
import type { SolveRecord, PhaseRecord, SolveMethod } from '../types/solve'

function computeScrambledFacelets(scramble: string): string {
  let f = SOLVED_FACELETS
  for (const step of parseScramble(scramble)) {
    const move = { face: step.face, direction: step.direction, cubeTimestamp: 0, serial: 0 }
    f = applyMoveToFacelets(f, move)
    if (step.double) f = applyMoveToFacelets(f, move)
  }
  return f
}

export function recomputePhases(solve: SolveRecord, newMethod: SolveMethod): PhaseRecord[] | null {
  const moves = solve.moves
  if (moves.length === 0) return null

  let facelets = computeScrambledFacelets(solve.scramble)

  const phases: PhaseRecord[] = []
  let phaseIndex = 0
  let phaseStart = moves[0].cubeTimestamp
  let phaseFirstMove: number | null = null
  let phaseMoveCount = 0

  function completePhase(endTimestamp: number) {
    const ph = newMethod.phases[phaseIndex]
    const firstMove = phaseFirstMove ?? endTimestamp
    phases.push({
      label: ph.label,
      group: ph.group,
      recognitionMs: firstMove - phaseStart,
      executionMs: endTimestamp - firstMove,
      turns: phaseMoveCount,
    })
    phaseIndex++
    phaseStart = endTimestamp
    phaseFirstMove = null
    phaseMoveCount = 0
  }

  for (const move of moves) {
    facelets = applyMoveToFacelets(facelets, move)
    phaseMoveCount++
    if (phaseFirstMove === null) phaseFirstMove = move.cubeTimestamp

    while (phaseIndex < newMethod.phases.length) {
      if (newMethod.phases[phaseIndex].isComplete(facelets)) {
        completePhase(move.cubeTimestamp)
      } else {
        break
      }
    }

    if (isSolvedFacelets(facelets)) {
      // Complete any remaining phases not caught by the while loop
      while (phaseIndex < newMethod.phases.length) {
        completePhase(move.cubeTimestamp)
      }
      break
    }
  }

  if (!isSolvedFacelets(facelets)) return null

  // CFOP merge rules — matched by label, no-op for non-CFOP methods
  // Rule 1: if EOLL completed OLL on the same move (COLL has 0 turns), absorb EOLL into COLL
  const eollIdx = phases.findIndex((p) => p.label === 'EOLL')
  if (eollIdx >= 0 && eollIdx + 1 < phases.length &&
      phases[eollIdx + 1].label === 'COLL' && phases[eollIdx + 1].turns === 0) {
    const eoll = phases[eollIdx]
    phases.splice(eollIdx, 2,
      { ...eoll, recognitionMs: 0, executionMs: 0, turns: 0 },
      { ...phases[eollIdx + 1], recognitionMs: eoll.recognitionMs, executionMs: eoll.executionMs, turns: eoll.turns },
    )
  }

  // Rule 2: if CPLL and EPLL finished on the same move (EPLL has 0 turns), absorb CPLL into EPLL
  const n = phases.length
  if (n >= 2 && phases[n - 2].label === 'CPLL' && phases[n - 1].label === 'EPLL' && phases[n - 1].turns === 0) {
    const cpll = phases[n - 2]
    phases.splice(n - 2, 2,
      { ...cpll, recognitionMs: 0, executionMs: 0, turns: 0 },
      { ...phases[n - 1], recognitionMs: cpll.recognitionMs, executionMs: cpll.executionMs, turns: cpll.turns },
    )
  }

  return phases
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```
Expected: no type errors related to `recomputePhases.ts`

- [ ] **Step 3: Commit**

```bash
git add src/utils/recomputePhases.ts
git commit -m "feat: add recomputePhases utility"
```

---

## Task 2: Tests for `recomputePhases`

**Files:**
- Create: `tests/utils/recomputePhases.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// tests/utils/recomputePhases.test.ts
import { describe, it, expect } from 'vitest'
import { recomputePhases } from '../../src/utils/recomputePhases'
import { isSolvedFacelets } from '../../src/hooks/useCubeState'
import { CFOP } from '../../src/methods/cfop'
import { ROUX } from '../../src/methods/roux'
import { EXAMPLE_SOLVES } from '../../src/data/exampleSolves'
import type { SolveRecord, SolveMethod } from '../../src/types/solve'
import type { Move } from '../../src/types/cube'

function makeMove(face: Move['face'], dir: Move['direction'], ts: number): Move {
  return { face, direction: dir, cubeTimestamp: ts, serial: 0 }
}

function makeSolve(scramble: string, moves: Move[]): SolveRecord {
  return { id: 1, seq: 1, scramble, timeMs: 0, moves, phases: [], date: 0 }
}

// Single phase that completes when cube is solved — simplest testable method
const SINGLE_PHASE_METHOD: SolveMethod = {
  id: 'test', label: 'Test',
  phases: [{ label: 'Solve', color: '#fff', isComplete: isSolvedFacelets }],
}

describe('recomputePhases', () => {
  // Scramble "U" = one U CW applied to solved cube.
  // Three more U CW moves = four U CW total = identity = solved.

  it('returns null when moves do not solve the cube', () => {
    // U scramble + one more U CW = two U CW total = U2, not solved
    const solve = makeSolve('U', [makeMove('U', 'CW', 1000)])
    expect(recomputePhases(solve, SINGLE_PHASE_METHOD)).toBeNull()
  })

  it('returns null when moves array is empty', () => {
    const solve = makeSolve('U', [])
    expect(recomputePhases(solve, SINGLE_PHASE_METHOD)).toBeNull()
  })

  it('returns phases with correct label', () => {
    // U scramble + 3× U CW = 4× U CW = solved
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)
    expect(phases).not.toBeNull()
    expect(phases).toHaveLength(1)
    expect(phases![0].label).toBe('Solve')
  })

  it('turns count equals total move count', () => {
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)!
    const totalTurns = phases.reduce((sum, p) => sum + p.turns, 0)
    expect(totalTurns).toBe(3)
  })

  it('first phase has recognitionMs = 0 (phase starts at first move)', () => {
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)!
    expect(phases[0].recognitionMs).toBe(0)
  })

  it('executionMs reflects cubeTimestamp span from first to last move', () => {
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)!
    // first move ts = 1000, last move ts = 3000, so executionMs = 2000
    expect(phases[0].executionMs).toBe(2000)
  })

  it('total turns across phases equals move count for a real CFOP example solve', () => {
    const cfopSolve = EXAMPLE_SOLVES.find((s) => (s.method ?? 'cfop') === 'cfop' && s.moves.length > 0)
    if (!cfopSolve) throw new Error('No CFOP example solve found')
    const phases = recomputePhases(cfopSolve, CFOP)
    expect(phases).not.toBeNull()
    const totalTurns = phases!.reduce((sum, p) => sum + p.turns, 0)
    expect(totalTurns).toBe(cfopSolve.moves.length)
  })

  it('total turns across phases equals move count for a real Roux example solve', () => {
    const rouxSolve = EXAMPLE_SOLVES.find((s) => s.method === 'roux' && s.moves.length > 0)
    if (!rouxSolve) throw new Error('No Roux example solve found')
    const phases = recomputePhases(rouxSolve, ROUX)
    expect(phases).not.toBeNull()
    const totalTurns = phases!.reduce((sum, p) => sum + p.turns, 0)
    expect(totalTurns).toBe(rouxSolve.moves.length)
  })

  it('all phases have non-negative recognitionMs and executionMs', () => {
    const cfopSolve = EXAMPLE_SOLVES.find((s) => (s.method ?? 'cfop') === 'cfop' && s.moves.length > 0)!
    const phases = recomputePhases(cfopSolve, CFOP)!
    for (const p of phases) {
      expect(p.recognitionMs).toBeGreaterThanOrEqual(0)
      expect(p.executionMs).toBeGreaterThanOrEqual(0)
    }
  })
})
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm run test -- recomputePhases
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/utils/recomputePhases.test.ts
git commit -m "test: add recomputePhases unit tests"
```

---

## Task 3: Persistence — `updateSolveInFirestore` + `updateSolve`

**Files:**
- Modify: `src/services/firestoreSolves.ts`
- Modify: `src/hooks/useSolveHistory.ts`
- Modify: `tests/hooks/useSolveHistory.test.ts`

- [ ] **Step 1: Add `updateSolveInFirestore` to `firestoreSolves.ts`**

Add after `deleteSolveFromFirestore` (line 48):

```ts
export async function updateSolveInFirestore(uid: string, solve: SolveRecord): Promise<void> {
  await setDoc(solveDocRef(uid, solve), sanitize(solve))
}
```

- [ ] **Step 2: Add `updateSolve` to `useSolveHistory.ts`**

Add the import at the top alongside existing Firestore imports:

```ts
import {
  loadSolvesFromFirestore,
  addSolveToFirestore,
  deleteSolveFromFirestore,
  updateSolveInFirestore,   // add this
  migrateLocalSolvesToFirestore,
  loadNextSeqFromFirestore,
  updateCounterInFirestore,
} from '../services/firestoreSolves'
```

Add the `updateSolve` callback inside `useSolveHistory`, after `deleteSolve`:

```ts
const updateSolve = useCallback(async (updated: SolveRecord): Promise<void> => {
  if (useCloud && uid) {
    setCloudSolves((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    await updateSolveInFirestore(uid, updated)
  } else {
    setLocalSolves((prev) => {
      const next = prev.map((s) => s.id === updated.id ? updated : s)
      saveLocalSolves(next)
      return next
    })
  }
}, [useCloud, uid])
```

Add `updateSolve` to the return value (line 205, alongside `addSolve`, `deleteSolve`):

```ts
return { solves: allSolves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading: isCloudLoading }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```
Expected: no type errors

- [ ] **Step 4: Write tests for `updateSolve` (localStorage path)**

Add to the bottom of `tests/hooks/useSolveHistory.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { beforeEach } from 'vitest'
import { useSolveHistory } from '../../src/hooks/useSolveHistory'

describe('useSolveHistory — updateSolve (localStorage mode)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  function makeSolveRecord(id: number, method: string): SolveRecord {
    return { id, seq: id, scramble: '', timeMs: 10000, moves: [], phases: [], date: 0, method }
  }

  it('updateSolve replaces the solve with matching id', async () => {
    const { result } = renderHook(() => useSolveHistory())
    act(() => { result.current.addSolve(makeSolveRecord(1, 'cfop')) })
    await act(async () => {
      await result.current.updateSolve(makeSolveRecord(1, 'roux'))
    })
    const updated = result.current.solves.find((s) => s.id === 1)
    expect(updated?.method).toBe('roux')
  })

  it('updateSolve does not affect other solves', async () => {
    const { result } = renderHook(() => useSolveHistory())
    act(() => {
      result.current.addSolve(makeSolveRecord(1, 'cfop'))
      result.current.addSolve(makeSolveRecord(2, 'cfop'))
    })
    await act(async () => {
      await result.current.updateSolve(makeSolveRecord(1, 'roux'))
    })
    expect(result.current.solves.find((s) => s.id === 2)?.method).toBe('cfop')
  })
})
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
npm run test -- useSolveHistory
```
Expected: all tests pass (including the new `updateSolve` tests)

- [ ] **Step 6: Commit**

```bash
git add src/services/firestoreSolves.ts src/hooks/useSolveHistory.ts tests/hooks/useSolveHistory.test.ts
git commit -m "feat: add updateSolve to useSolveHistory and updateSolveInFirestore"
```

---

## Task 4: `SolveDetailModal` — method selector, local state, saving guard

**Files:**
- Modify: `src/components/SolveDetailModal.tsx`

- [ ] **Step 1: Add imports**

At the top of `SolveDetailModal.tsx`, add:

```ts
import { useState } from 'react'   // already imported — ensure it includes useState
import { MethodSelector } from './MethodSelector'
import { recomputePhases } from '../utils/recomputePhases'
import type { SolveMethod } from '../types/solve'
```

(`useState` is already imported; add `MethodSelector` and `recomputePhases` to existing imports.)

- [ ] **Step 2: Add `onUpdate` to the Props interface and replace `solve` references with `localSolve`**

Change the `Props` interface (currently at line 15):

```ts
interface Props {
  solve: SolveRecord
  onClose: () => void
  onDelete: (id: number) => void
  onUseScramble: (scramble: string) => void
  onUpdate: (solve: SolveRecord) => Promise<void>
}
```

At the top of the component function, add local state and update the destructure:

```ts
export function SolveDetailModal({ solve, onClose, onDelete, onUseScramble, onUpdate }: Props) {
  const [localSolve, setLocalSolve] = useState(solve)
  const [saving, setSaving] = useState(false)
  const [methodError, setMethodError] = useState<string | null>(null)
```

Replace every reference to `solve` in the component body with `localSolve`, **except** for the `useState(solve)` initializer itself. The references to change are:
- `solve.scramble` (line 58) → `localSolve.scramble`
- `solve.method` (line 59) → `localSolve.method`
- `solve.isExample` (line 204, 455) → `localSolve.isExample`
- `solve.seq`, `solve.id` (line 202) → `localSolve.seq`, `localSolve.id`
- `solve.timeMs` (line 88) → `localSolve.timeMs`
- `solve.phases` (line 111, 177, etc.) → `localSolve.phases`
- `solve.moves` (line 95, 116, etc.) → `localSolve.moves`
- `solve.driver` (line 228) → `localSolve.driver`
- `solve` in `useReplayController(solve, rendererRef)` (line 75) → `useReplayController(localSolve, rendererRef)`
- `solve` passed to `onDelete(solve.id)` (line 446) → `onDelete(localSolve.id)`
- `solve` in `copyAsExample` (lines 133-134) → `localSolve`
- `solve.scramble` passed to `onUseScramble` (line 253) → `localSolve.scramble`

- [ ] **Step 3: Add `handleMethodChange`**

Add after the `copyAsExample` function (around line 137):

```ts
async function handleMethodChange(newMethod: SolveMethod) {
  const newPhases = recomputePhases(localSolve, newMethod)
  if (newPhases === null) {
    setMethodError('Could not recompute phases — solve record appears incomplete.')
    setTimeout(() => setMethodError(null), 4000)
    return
  }
  const updated = { ...localSolve, method: newMethod.id, phases: newPhases }
  setLocalSolve(updated)
  setSaving(true)
  try {
    await onUpdate(updated)
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 4: Replace the method label span with `MethodSelector` in the analysis header**

Find this in the "Detailed Analysis" header (around line 349):

```tsx
<span style={{ color: '#888', fontSize: 12 }}>{method.label}</span>
```

Replace with:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
  <MethodSelector method={method} onChange={handleMethodChange} disabled={saving} />
  {methodError && <span style={{ color: '#e74c3c', fontSize: 11 }}>{methodError}</span>}
</div>
```

- [ ] **Step 5: Disable the Delete button while saving**

Find the Delete button (around line 465):

```tsx
<button
  onClick={() => setConfirmDelete(true)}
  style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
>
  Delete
</button>
```

Replace with:

```tsx
<button
  onClick={() => setConfirmDelete(true)}
  disabled={saving}
  style={{ padding: '6px 14px', background: saving ? '#555' : '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
>
  Delete
</button>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run build
```
Expected: no type errors

- [ ] **Step 7: Commit**

```bash
git add src/components/SolveDetailModal.tsx
git commit -m "feat: add method selector and onUpdate to SolveDetailModal"
```

---

## Task 5: Wire `onUpdate` in `TimerScreen`

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Destructure `updateSolve` from `useSolveHistory`**

Find the `useSolveHistory` call (line 61):

```ts
const { solves, addSolve, deleteSolve, nextSolveIds, cloudLoading } = useSolveHistory(cloudConfig)
```

Replace with:

```ts
const { solves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading } = useSolveHistory(cloudConfig)
```

- [ ] **Step 2: Pass `onUpdate` to `SolveDetailModal`**

Find the `SolveDetailModal` render (line 377):

```tsx
<SolveDetailModal
  solve={selectedSolve}
  onClose={() => setSelectedSolve(null)}
  onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
  onUseScramble={(s) => { loadScramble(s); setSelectedSolve(null) }}
```

Add the new prop:

```tsx
<SolveDetailModal
  solve={selectedSolve}
  onClose={() => setSelectedSolve(null)}
  onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
  onUseScramble={(s) => { loadScramble(s); setSelectedSolve(null) }}
  onUpdate={async (updated) => { await updateSolve(updated) }}
```

- [ ] **Step 3: Verify TypeScript compiles and tests pass**

```bash
npm run build && npm run test
```
Expected: build succeeds, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: wire onUpdate in TimerScreen for method changes"
```

---

## Task 6: Update docs

**Files:**
- Modify: `docs/ui-architecture.md`
- Modify: `docs/firebase-cloud-sync.md`

- [ ] **Step 1: Update `docs/ui-architecture.md` — TimerScreen hook table**

Find the `useSolveHistory` row in the TimerScreen hook table:

```
| `useSolveHistory` | `solves`, `addSolve`, `deleteSolve`, `nextSolveIds`, `cloudLoading` |
```

Replace with:

```
| `useSolveHistory` | `solves`, `addSolve`, `deleteSolve`, `updateSolve`, `nextSolveIds`, `cloudLoading` |
```

- [ ] **Step 2: Update `docs/ui-architecture.md` — SolveDetailModal section**

Find the SolveDetailModal section. It currently reads:

```
All other state (facelets at a given index, phase label, cancelled-move detection) is computed locally via pure functions (`computeFaceletsAtIndex`, `getPhaseLabelAtIndex`).
```

Replace with:

```
Local state: `localSolve` (mirrors the `solve` prop, updated optimistically on method change), `saving` (disables `MethodSelector` and Delete during async save), `methodError` (inline error shown if phase recompute fails). All other state (facelets at a given index, phase label, cancelled-move detection) is computed locally via pure functions (`computeFaceletsAtIndex`, `getPhaseLabelAtIndex`).

Props: `onUpdate: (solve: SolveRecord) => Promise<void>` — called after method change with the updated record.
```

- [ ] **Step 3: Update `docs/firebase-cloud-sync.md`**

Find the Firestore operations section (or add after the "How it works" section). Add a note about `updateSolveInFirestore`:

Locate where `addSolveToFirestore` / `deleteSolveFromFirestore` are mentioned, or add a new section after the security rules block:

```markdown
## Firestore operations

| Function | Description |
|----------|-------------|
| `loadSolvesFromFirestore(uid)` | Load all solves ordered by date |
| `addSolveToFirestore(uid, solve)` | Write a new solve doc (idempotent `setDoc`) |
| `updateSolveInFirestore(uid, solve)` | Update an existing solve doc in place (same `setDoc`, uses `solve.date` as doc ID) |
| `deleteSolveFromFirestore(uid, solve)` | Delete a solve doc |
```

- [ ] **Step 4: Commit**

```bash
git add docs/ui-architecture.md docs/firebase-cloud-sync.md
git commit -m "docs: update ui-architecture and firebase-cloud-sync for method update feature"
```

---

## Self-review notes

- **Spec coverage:** All five design sections are covered: recomputePhases utility (Task 1-2), persistence layer (Task 3), SolveDetailModal changes (Task 4), call sites (Task 5), docs (Task 6). ✓
- **Null return path:** `recomputePhases` returns `null` for empty moves or unsolved cube; modal handles it with inline error, no `onUpdate` called. ✓
- **Saving guard:** `MethodSelector` disabled via `saving` prop; Delete button disabled with visual change. ✓
- **CFOP merge rules:** Implemented in `recomputePhases`; label-matched so no-op for Roux. ✓
- **Both directions (CFOP↔Roux):** `MethodSelector` shows all methods from its `METHODS` array; `recomputePhases` is method-agnostic. ✓
- **Type consistency:** `onUpdate: (solve: SolveRecord) => Promise<void>` matches across Props, TimerScreen, and `useSolveHistory` return. ✓

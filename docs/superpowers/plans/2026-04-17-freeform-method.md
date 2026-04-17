# Freeform Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Freeform` solving method with a single "Solved" phase that users can select for method filtering and recompute existing solves to/from.

**Architecture:** Self-contained `SolveMethod` object following the same pattern as `CFOP` and `ROUX`. No new runtime paths — existing phase-recompute, filter, and hash-router machinery extend via a new method id. `detectMethod.ts` adds a one-line skip guard so Freeform solves are not flagged as mismatches.

**Tech Stack:** TypeScript, React 19, Vitest. Existing test fixtures in `tests/fixtures/solveFixtures.ts`. Existing devlog / future.md conventions.

**Spec:** [`docs/superpowers/specs/2026-04-17-freeform-method-design.md`](../specs/2026-04-17-freeform-method-design.md)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/methods/freeform.ts` | **new** | `FREEFORM` method definition (single `Solved` phase) |
| `src/methods/index.ts` | modify | export `FREEFORM`; `getMethod('freeform')` returns it |
| `src/types/solve.ts` | modify | widen `MethodFilter`; update `SolveRecord.method` comment |
| `src/components/MethodSelector.tsx` | modify | append `FREEFORM` to `METHODS` array |
| `src/components/SolveHistorySidebar.tsx` | modify | add `<option value="freeform">` to filter dropdown |
| `src/components/TrendsModal.tsx` | modify | add `<option>` to filter dropdown; include `FREEFORM` in `buildColorMap('all')` merge |
| `src/hooks/useHashRouter.ts` | modify | accept `freeform` in method param whitelist |
| `src/utils/detectMethod.ts` | modify | skip freeform solves in mismatch loop |
| `tests/utils/recomputePhases.test.ts` | modify | add test: `FREEFORM` yields single `Solved` phase on a real fixture |
| `tests/filterSolves.test.ts` | modify | add freeform fixture + filter test cases |
| `tests/hooks/useHashRouter.test.ts` | modify | add `method=freeform` parse test |
| `tests/utils/detectMethod.test.ts` | modify or create | verify freeform solves are skipped |
| `future.md` | modify | strikethrough completed item with version tag |
| `docs/devlog.md` | modify | add `v1.22.0` entry + TL;DR line |

---

## Task 1: Create the `FREEFORM` method definition

**Files:**
- Create: `src/methods/freeform.ts`
- Modify: `src/methods/index.ts`

- [ ] **Step 1: Create `src/methods/freeform.ts`**

```ts
import type { SolveMethod } from '../types/solve'
import { isSolvedFacelets } from '../utils/applyMove'

export const FREEFORM: SolveMethod = {
  id: 'freeform',
  label: 'Freeform',
  phases: [
    {
      label: 'Solved',
      color: '#27ae60',
      isComplete: isSolvedFacelets,
    },
  ],
}
```

- [ ] **Step 2: Update `src/methods/index.ts` to export and resolve FREEFORM**

Replace the full contents with:

```ts
import type { SolveMethod } from '../types/solve'
import { CFOP } from './cfop'
import { ROUX } from './roux'
import { FREEFORM } from './freeform'

export { CFOP, ROUX, FREEFORM }

export function getMethod(id?: string): SolveMethod {
  if (id === 'roux') return ROUX
  if (id === 'freeform') return FREEFORM
  return CFOP
}
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `npm run test -- --run`
Expected: all existing tests still pass (we haven't added a Freeform-specific test yet).

- [ ] **Step 4: Commit**

```bash
git add src/methods/freeform.ts src/methods/index.ts
git commit -m "feat: add Freeform method (single 'Solved' phase)"
```

---

## Task 2: Test that `recomputePhases` produces a single `Solved` phase with FREEFORM

**Files:**
- Modify: `tests/utils/recomputePhases.test.ts`

- [ ] **Step 1: Add failing test case at the end of the `describe('recomputePhases', …)` block**

Add this block inside the `describe` (place it after the existing `it.each` blocks, before the closing `})`):

```ts
  // ── Freeform method ────────────────────────────────────────────────────────
  it.each(CFOP_SOLVES.map((s, i) => ({ label: `CFOP solve ${i + 1}`, solve: s })))(
    'FREEFORM yields a single Solved phase with turns = moves.length ($label)',
    ({ solve }) => {
      const { FREEFORM } = require('../../src/methods/freeform') as typeof import('../../src/methods/freeform')
      const phases = recomputePhases(solve, FREEFORM)
      expect(phases).not.toBeNull()
      expect(phases).toHaveLength(1)
      expect(phases![0].label).toBe('Solved')
      expect(phases![0].turns).toBe(solve.moves.length)
      expect(phases![0].recognitionMs).toBe(0)
      const firstTs = solve.moves[0].cubeTimestamp as number
      const lastTs = solve.moves[solve.moves.length - 1].cubeTimestamp as number
      expect(phases![0].executionMs).toBe(lastTs - firstTs)
    }
  )
```

- [ ] **Step 2: Replace the `require` import with a top-of-file import**

TypeScript + Vitest in this repo uses ES imports throughout. Edit the top of `tests/utils/recomputePhases.test.ts` to add:

```ts
import { FREEFORM } from '../../src/methods/freeform'
```

Then remove the `const { FREEFORM } = require(...)` line from the test body so the test uses the top-level import.

Final test body after cleanup:

```ts
  it.each(CFOP_SOLVES.map((s, i) => ({ label: `CFOP solve ${i + 1}`, solve: s })))(
    'FREEFORM yields a single Solved phase with turns = moves.length ($label)',
    ({ solve }) => {
      const phases = recomputePhases(solve, FREEFORM)
      expect(phases).not.toBeNull()
      expect(phases).toHaveLength(1)
      expect(phases![0].label).toBe('Solved')
      expect(phases![0].turns).toBe(solve.moves.length)
      expect(phases![0].recognitionMs).toBe(0)
      const firstTs = solve.moves[0].cubeTimestamp as number
      const lastTs = solve.moves[solve.moves.length - 1].cubeTimestamp as number
      expect(phases![0].executionMs).toBe(lastTs - firstTs)
    }
  )
```

- [ ] **Step 3: Run the test and verify it passes**

Run: `npm run test -- --run tests/utils/recomputePhases.test.ts`
Expected: all existing tests pass + new `FREEFORM yields a single Solved phase…` test passes.

If the test fails with `executionMs` mismatch, check `src/utils/recomputePhases.ts`:
- Line 40-41: `phaseStart = timestamps[0]`, `phaseFirstMove = null`
- On first move: `phaseFirstMove = timestamps[0]` (same value as `phaseStart`), so `recognitionMs = 0`
- When cube becomes solved, `completePhase(ts)` uses the last move's timestamp as `endTimestamp`, so `executionMs = lastTs - firstTs`

- [ ] **Step 4: Commit**

```bash
git add tests/utils/recomputePhases.test.ts
git commit -m "test: FREEFORM method produces single Solved phase"
```

---

## Task 3: Widen `MethodFilter` type and update `SolveRecord.method` comment

**Files:**
- Modify: `src/types/solve.ts`

- [ ] **Step 1: Update the `MethodFilter` type**

Find (line 54):

```ts
export type MethodFilter = 'all' | 'cfop' | 'roux'
```

Replace with:

```ts
export type MethodFilter = 'all' | 'cfop' | 'roux' | 'freeform'
```

- [ ] **Step 2: Update the `SolveRecord.method` comment**

Find (line 37):

```ts
  method?: string       // 'cfop' | 'roux'; absent on old solves, treated as 'cfop'
```

Replace with:

```ts
  method?: string       // 'cfop' | 'roux' | 'freeform'; absent on old solves, treated as 'cfop'
```

- [ ] **Step 3: Type-check and run tests**

Run: `npm run build`
Expected: build succeeds. TypeScript may surface nothing because widening a union is backward-compatible with all existing consumers.

Run: `npm run test -- --run`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/types/solve.ts
git commit -m "feat: widen MethodFilter to include 'freeform'"
```

---

## Task 4: Add Freeform to the `MethodSelector` dropdown (Detail modal)

**Files:**
- Modify: `src/components/MethodSelector.tsx`

- [ ] **Step 1: Import `FREEFORM` and append to `METHODS` array**

Find (lines 1-4):

```tsx
import type { SolveMethod } from '../types/solve'
import { CFOP, ROUX } from '../methods/index'

const METHODS: SolveMethod[] = [CFOP, ROUX]
```

Replace with:

```tsx
import type { SolveMethod } from '../types/solve'
import { CFOP, ROUX, FREEFORM } from '../methods/index'

const METHODS: SolveMethod[] = [CFOP, ROUX, FREEFORM]
```

- [ ] **Step 2: Run tests and build**

Run: `npm run build && npm run test -- --run`
Expected: build succeeds; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/MethodSelector.tsx
git commit -m "feat: add Freeform to method selector dropdown"
```

---

## Task 5: Add Freeform to the `SolveHistorySidebar` filter + test `filterSolves`

**Files:**
- Modify: `src/components/SolveHistorySidebar.tsx`
- Modify: `tests/filterSolves.test.ts`

- [ ] **Step 1: Add failing test cases in `tests/filterSolves.test.ts`**

Find (line 15):

```ts
const legacy    = makeSolve({ id: 5 }) // no method, no driver
```

Immediately after it, add:

```ts
const freeform  = makeSolve({ id: 6, method: 'freeform', driver: 'cube' })
```

Then find (line 18):

```ts
const ALL: SolveRecord[] = [cfopCube, cfopMouse, rouxCube, example, legacy]
```

Replace with:

```ts
const ALL: SolveRecord[] = [cfopCube, cfopMouse, rouxCube, example, legacy, freeform]
```

Then update the existing `cfop+all` and `roux+all` expectations — `freeform` (id 6) does NOT match either, so the expected arrays are unchanged. But `all+*` cases need to include id 6. Update:

Find:

```ts
  it('all+all returns every solve', () => {
    const f: SolveFilter = { method: 'all', driver: 'all' }
    expect(filterSolves(ALL, f)).toEqual(ALL)
  })
```

(no change needed — `filterSolves(ALL, all+all) === ALL` still holds).

Find:

```ts
  it('all+cube returns cube solves and examples', () => {
    const f: SolveFilter = { method: 'all', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 3, 4, 5]) // legacy defaults to cube, example bypasses
  })
```

Replace with:

```ts
  it('all+cube returns cube solves and examples', () => {
    const f: SolveFilter = { method: 'all', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 3, 4, 5, 6]) // legacy defaults to cube, example bypasses, freeform is cube
  })
```

Then add new freeform-specific tests at the bottom of the `describe` block, just before the closing `})`:

```ts
  it('freeform+all returns freeform solves and examples', () => {
    const f: SolveFilter = { method: 'freeform', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([4, 6]) // example bypasses
  })

  it('freeform+cube returns freeform+cube solves and examples', () => {
    const f: SolveFilter = { method: 'freeform', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([4, 6])
  })

  it('cfop+all excludes freeform solves', () => {
    const f: SolveFilter = { method: 'cfop', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).not.toContain(6)
  })
```

- [ ] **Step 2: Run the new tests and verify they pass**

Run: `npm run test -- --run tests/filterSolves.test.ts`
Expected: all tests (existing + new) pass. `filterSolves` already handles any `method` string via the `(s.method ?? 'cfop') === filter.method` comparison, so no code change to `useSolveHistory.ts` is needed.

- [ ] **Step 3: Add the `Freeform` dropdown option in `SolveHistorySidebar.tsx`**

Find (lines 106-109):

```tsx
              <option value="all">All</option>
              <option value="cfop">CFOP</option>
              <option value="roux">Roux</option>
            </select>
```

Replace with:

```tsx
              <option value="all">All</option>
              <option value="cfop">CFOP</option>
              <option value="roux">Roux</option>
              <option value="freeform">Freeform</option>
            </select>
```

- [ ] **Step 4: Build and run tests**

Run: `npm run build && npm run test -- --run`
Expected: build passes; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SolveHistorySidebar.tsx tests/filterSolves.test.ts
git commit -m "feat: add Freeform option to sidebar filter"
```

---

## Task 6: Add Freeform to the `TrendsModal` filter + `buildColorMap` merge

**Files:**
- Modify: `src/components/TrendsModal.tsx`

- [ ] **Step 1: Include `FREEFORM` in the `buildColorMap('all')` merge**

Find (lines 16, 133-145 — the import line and the `buildColorMap` function):

```tsx
import { getMethod, CFOP, ROUX } from '../methods/index'
```

Replace with:

```tsx
import { getMethod, CFOP, ROUX, FREEFORM } from '../methods/index'
```

Find:

```tsx
function buildColorMap(
  method: SolveFilter['method'],
  grouped: boolean,
): Record<string, string> {
  if (method === 'all') {
    // Merge colors from all methods so Roux phase names don't fall back to gray
    return {
      ...buildColorMapForMethod(ROUX, grouped),
      ...buildColorMapForMethod(CFOP, grouped),
    }
  }
  return buildColorMapForMethod(getMethod(method), grouped)
}
```

Replace with:

```tsx
function buildColorMap(
  method: SolveFilter['method'],
  grouped: boolean,
): Record<string, string> {
  if (method === 'all') {
    // Merge colors from all methods so Roux/Freeform phase names don't fall back to gray
    return {
      ...buildColorMapForMethod(ROUX, grouped),
      ...buildColorMapForMethod(FREEFORM, grouped),
      ...buildColorMapForMethod(CFOP, grouped),
    }
  }
  return buildColorMapForMethod(getMethod(method), grouped)
}
```

- [ ] **Step 2: Add the `Freeform` dropdown option in the Trends header**

Find (lines 536-539):

```tsx
              <option value="all">All</option>
              <option value="cfop">CFOP</option>
              <option value="roux">Roux</option>
            </select>
```

Replace with:

```tsx
              <option value="all">All</option>
              <option value="cfop">CFOP</option>
              <option value="roux">Roux</option>
              <option value="freeform">Freeform</option>
            </select>
```

- [ ] **Step 3: Handle `method === 'all'` fallback for single-phase chart shape**

Find (line 333):

```tsx
  const method = getMethod(solveFilter.method === 'all' ? 'cfop' : solveFilter.method)
```

No change needed — this line falls back to CFOP for the chart x-axis when "All" is selected, which is the existing behavior. Freeform solves in the "All" view contribute their `Solved` phase to the merged color map (from Step 1) and fall back gracefully if their labels don't appear in the CFOP-shaped chart.

- [ ] **Step 4: Build and run tests**

Run: `npm run build && npm run test -- --run`
Expected: build passes; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: add Freeform to Trends filter and color map"
```

---

## Task 7: Whitelist `freeform` in `useHashRouter` + test

**Files:**
- Modify: `src/hooks/useHashRouter.ts`
- Modify: `tests/hooks/useHashRouter.test.ts`

- [ ] **Step 1: Add failing test case in `tests/hooks/useHashRouter.test.ts`**

Find (near line 60):

```ts
  it('returns none for invalid method', () => {
    const route = parseHash('#trends?method=invalid')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.method).toBeNull()
  })
```

Immediately before it, add:

```ts
  it('parses #trends with method=freeform', () => {
    const route = parseHash('#trends?method=freeform')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.method).toBe('freeform')
  })
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- --run tests/hooks/useHashRouter.test.ts`
Expected: the new test fails with `expected null to be 'freeform'` because `'freeform'` is not in the whitelist yet.

- [ ] **Step 3: Widen the method whitelist in `src/hooks/useHashRouter.ts`**

Find (line 9):

```ts
  method: 'all' | 'cfop' | 'roux' | null
```

Replace with:

```ts
  method: 'all' | 'cfop' | 'roux' | 'freeform' | null
```

Find (lines 40-43):

```ts
  const methodRaw = params.get('method')
  const method = (['all', 'cfop', 'roux'] as const).includes(methodRaw as 'all')
    ? (methodRaw as 'all' | 'cfop' | 'roux')
    : null
```

Replace with:

```ts
  const methodRaw = params.get('method')
  const method = (['all', 'cfop', 'roux', 'freeform'] as const).includes(methodRaw as 'all')
    ? (methodRaw as 'all' | 'cfop' | 'roux' | 'freeform')
    : null
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- --run tests/hooks/useHashRouter.test.ts`
Expected: the new test passes. All existing hash-router tests also pass.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useHashRouter.ts tests/hooks/useHashRouter.test.ts
git commit -m "feat: accept method=freeform in #trends URL param"
```

---

## Task 8: Skip Freeform solves in `detectMethodMismatches` + test

**Files:**
- Modify: `src/utils/detectMethod.ts`
- Create: `tests/utils/detectMethod.test.ts`

- [ ] **Step 1: Create `tests/utils/detectMethod.test.ts`**

(The file does not exist in the repo yet. `CFOP_SOLVE_1` is exported from `tests/fixtures/solveFixtures.ts`.)

```ts
import { describe, it, expect } from 'vitest'
import { detectMethodMismatches } from '../../src/utils/detectMethod'
import { CFOP_SOLVE_1 } from '../fixtures/solveFixtures'
import type { SolveRecord } from '../../src/types/solve'

describe('detectMethodMismatches', () => {
  it('does not flag solves with method=freeform even if moves look like CFOP', () => {
    const freeformSolve: SolveRecord = { ...CFOP_SOLVE_1, id: 999, method: 'freeform' }
    const mismatches = detectMethodMismatches([freeformSolve])
    expect(mismatches).toEqual([])
  })

  it('does not suggest freeform as a replacement method', () => {
    // Any solve the detector produces a suggestion for should never have suggestedMethod === 'freeform'.
    const solves: SolveRecord[] = [{ ...CFOP_SOLVE_1, id: 1000, method: 'roux' }]
    const mismatches = detectMethodMismatches(solves)
    for (const m of mismatches) {
      expect(m.suggestedMethod).not.toBe('freeform')
    }
  })
})
```

- [ ] **Step 2: Run the test and verify it fails on the first assertion**

Run: `npm run test -- --run tests/utils/detectMethod.test.ts`
Expected: the "does not flag solves with method=freeform" test fails — the detector currently evaluates CFOP/Roux heuristics and would flag a Freeform solve whose moves look like CFOP as a mismatch (suggested='cfop', stored='freeform', mismatch).

- [ ] **Step 3: Add the skip guard in `src/utils/detectMethod.ts`**

Find (lines 49-51):

```ts
  for (const solve of solves) {
    if (solve.isExample) continue
    if (solve.moves.length === 0) continue
```

Replace with:

```ts
  for (const solve of solves) {
    if (solve.isExample) continue
    if (solve.moves.length === 0) continue
    if ((solve.method ?? 'cfop') === 'freeform') continue
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- --run tests/utils/detectMethod.test.ts`
Expected: both new tests pass.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npm run build && npm run test -- --run`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/utils/detectMethod.ts tests/utils/detectMethod.test.ts
git commit -m "feat: skip Freeform solves in method mismatch detection"
```

---

## Task 9: Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the printed URL in Chrome/Edge (Web Bluetooth requirement).

- [ ] **Step 2: QA Scenario A — sidebar filter**

1. Record at least one solve (mouse driver is fine) stored as CFOP.
2. Open the sidebar. Change the `Method` dropdown to `Freeform`.
3. Expected: the CFOP solve disappears from the list; stats recompute to "No solves".
4. Change back to `CFOP`. Expected: solve reappears.

- [ ] **Step 3: QA Scenario B — recompute to and from Freeform**

1. Open a CFOP solve in the detail modal.
2. In the `Method` selector (right side of the Detailed Analysis header), change to `Freeform`.
3. Expected: phase table collapses to one row labeled `Solved`; the PhaseBar renders as a single green bar; `Turns` equals the solve's total moves; `Recog.` column shows `0:00`.
4. Change the method back to `CFOP`. Expected: the original multi-phase breakdown is restored.

- [ ] **Step 4: QA Scenario C — hash router**

1. Navigate to `http://<dev-url>/#trends?method=freeform`.
2. Expected: Trends modal opens with the `Method` filter set to `Freeform`.

- [ ] **Step 5: QA Scenario D — maintenance panel skip**

1. Record or manually mark a solve as `method: 'freeform'` (easy path: record a solve, open detail, switch method to Freeform, save).
2. Navigate to `#debug`.
3. Click the button that runs `detectMethodMismatches` (labeled near the maintenance section — look for "method mismatches" or similar; see `src/App.tsx` lines 325 and 376).
4. Expected: the Freeform solve does NOT appear in the mismatches list.

- [ ] **Step 6: QA Scenario E — Trends "All" view with a Freeform solve**

1. With at least one Freeform solve saved, open Trends.
2. Set `Method` filter to `All`, `Tab` to `Phases`.
3. Expected: the chart renders without crashing. Freeform solves contribute to chart lines where labels match; the `Solved` phase has a green color (not gray).

- [ ] **Step 7: If any scenario fails**

Do not continue to Task 10. Open an issue, debug, and amend the relevant code + tests. Only proceed once all five scenarios pass.

(No commit from this task — it's pure verification.)

---

## Task 10: Update `future.md` and `docs/devlog.md`

**Files:**
- Modify: `future.md`
- Modify: `docs/devlog.md`

- [ ] **Step 1: Strikethrough the Freeform item in `future.md`**

Find (in `future.md`, in the `## Solving Methods` section):

```markdown
- add a "freeform" method that only has one cube-is-solved phase. we can use this for future preparation. method filter should support this for record list and stats
```

Replace with:

```markdown
- ~~add a "freeform" method that only has one cube-is-solved phase. we can use this for future preparation. method filter should support this for record list and stats~~ — done in v1.22.0
```

- [ ] **Step 2: Determine the commit timestamp for the devlog heading**

Run: `git log -1 --format='%cd' --date=format:'%Y-%m-%d %H:%M'`
Use the output as the timestamp for the devlog heading.

- [ ] **Step 3: Add a new entry at the top of `docs/devlog.md` (under the TL;DR table)**

Find the first `## v` heading (currently `## v1.21.1 — Commutative ahead execution …`). Immediately before it, insert:

```markdown
## v1.22.0 — Freeform method (YYYY-MM-DD HH:MM)

**Review:** not yet

**Design docs:**
- Freeform Method: [Spec](superpowers/specs/2026-04-17-freeform-method-design.md) [Plan](superpowers/plans/2026-04-17-freeform-method.md)

**What was built:**
- New `FREEFORM` solving method (`src/methods/freeform.ts`) with a single `Solved` phase that completes when the cube reaches the solved state.
- Wired into `MethodSelector` (Detail modal), `SolveHistorySidebar` filter, `TrendsModal` filter + color map, and `useHashRouter` URL whitelist (`#trends?method=freeform`).
- `recomputePhases` handles Freeform via the existing generic algorithm — no changes to the recompute core needed.
- `detectMethodMismatches` skips Freeform solves so they are not flagged in the maintenance panel.

**Key technical learnings:**
- `[note]` A method with a single phase whose `isComplete` is `isSolvedFacelets` round-trips cleanly through `recomputePhases`: `turns === moves.length`, `recognitionMs === 0`, `executionMs === lastTs - firstTs`.
- `[insight]` Adding a new method is a union-widening + registry operation across ~6 files, not a schema change. The `method` field on `SolveRecord` is already a free-form `string`; widening `MethodFilter` is the type-level work, and each consumer (`MethodSelector`, filter dropdowns, hash router) is a local edit.
- `[gotcha]` `TrendsModal.buildColorMap('all')` spreads method color maps in order — if two methods share a label, last-wins. Freeform's `Solved` label does not collide with CFOP or Roux, so order is safe. Future methods adding a label like `EPLL` would collide with CFOP.
```

Replace `YYYY-MM-DD HH:MM` with the timestamp from Step 2.

- [ ] **Step 4: Add a TL;DR line**

Find the TL;DR table at the top of `docs/devlog.md`. Add a new row at the top (newest-first order) for v1.22.0. Follow the existing row format, e.g.:

```markdown
| [v1.22.0](#v1220--freeform-method-YYYY-MM-DD-hhmm) | Freeform method — single "Solved" phase |
```

(Use the actual column format of the existing table; update the anchor to match the heading format. Anchor rules: lowercase, strip punctuation except hyphens, spaces → hyphens.)

Verify the anchor format by checking the previous entry's anchor:

Run: `grep -n "\[v1.21.1\]" docs/devlog.md`

- [ ] **Step 5: Verify CLAUDE.md doesn't need updating**

Run: `grep -n "'cfop' | 'roux'" CLAUDE.md`

If any match references the method union, update it to include `'freeform'`. Otherwise no change needed.

- [ ] **Step 6: Commit**

```bash
git add future.md docs/devlog.md
git commit -m "docs: v1.22.0 devlog entry + future.md update for Freeform method"
```

- [ ] **Step 7: Tag the release (only if the user confirms they want to tag now)**

Ask the user: "Ready to tag v1.22.0?" If yes:

```bash
git tag v1.22.0
```

Do not push without user confirmation.

---

## Self-Review Checklist (for the implementer after completion)

- [ ] All tests pass: `npm run test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Manual QA scenarios A–E all pass
- [ ] `docs/devlog.md` updated with v1.22.0 entry + TL;DR line
- [ ] `future.md` Freeform item struck through
- [ ] Git log shows clean, focused commits per task

---

## Spec Coverage Check

| Spec Section | Covered By Task |
|---|---|
| New `FREEFORM` method definition | Task 1 |
| `getMethod('freeform')` resolution | Task 1 |
| `MethodFilter` type widening | Task 3 |
| `SolveRecord.method` comment update | Task 3 |
| `MethodSelector` dropdown | Task 4 |
| `SolveHistorySidebar` filter dropdown | Task 5 |
| `filterSolves` verification | Task 5 |
| `TrendsModal` filter dropdown | Task 6 |
| `buildColorMap('all')` merge | Task 6 |
| `useHashRouter` whitelist | Task 7 |
| `detectMethod` skip guard | Task 8 |
| Phase-bar single-phase rendering | Task 9 (manual QA) |
| Recompute flow to/from Freeform | Task 4 (code) + Task 9 (manual) |
| `future.md` strikethrough | Task 10 |
| `docs/devlog.md` entry | Task 10 |

# Freeform Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Freeform solving method with a single "Solved" phase, selectable everywhere CFOP/Roux are, filterable in record list and stats, and compatible with per-solve recompute.

**Architecture:** A new `src/methods/freeform.ts` defines FREEFORM with one phase (`isComplete: isSolvedFacelets`). It is registered in `methods/index.ts` and added to every hardcoded method list across 4 UI files. `MethodFilter` type gains `'freeform'`. `detectMethodMismatches` skips freeform solves.

**Tech Stack:** React 19 + TypeScript, Vitest for tests. Run `npm run test` and `npm run build` to verify.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/methods/freeform.ts` | Create | FREEFORM method definition |
| `src/methods/index.ts` | Modify | Export FREEFORM, add to `getMethod()` |
| `src/types/solve.ts` | Modify | Add `'freeform'` to `MethodFilter` |
| `src/components/MethodSelector.tsx` | Modify | Add FREEFORM to METHODS array |
| `src/components/SolveHistorySidebar.tsx` | Modify | Add freeform option to filter dropdown |
| `src/components/TrendsModal.tsx` | Modify | Add freeform option to dropdown + `buildColorMap` |
| `src/utils/detectMethod.ts` | Modify | Skip freeform solves in mismatch detection |
| `tests/filterSolves.test.ts` | Modify | Add freeform filter tests |
| `tests/utils/recomputePhases.test.ts` | Modify | Add FREEFORM recompute test |
| `tests/utils/detectMethod.test.ts` | Create | Test freeform skipped in mismatch detection |

---

### Task 1: Create freeform method + register it + update types

**Files:**
- Create: `src/methods/freeform.ts`
- Modify: `src/methods/index.ts`
- Modify: `src/types/solve.ts`

- [ ] **Step 1: Create `src/methods/freeform.ts`**

```typescript
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

- [ ] **Step 2: Update `src/methods/index.ts`**

Replace the entire file with:

```typescript
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

- [ ] **Step 3: Update `MethodFilter` type in `src/types/solve.ts` (line 54)**

Change:
```typescript
export type MethodFilter = 'all' | 'cfop' | 'roux'
```
To:
```typescript
export type MethodFilter = 'all' | 'cfop' | 'roux' | 'freeform'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds with no type errors. (Downstream consumers of `MethodFilter` may now show exhaustive-switch warnings in editors, but won't block the build.)

- [ ] **Step 5: Commit**

```bash
git add src/methods/freeform.ts src/methods/index.ts src/types/solve.ts
git commit -m "feat: add FREEFORM method definition and register in index"
```

---

### Task 2: Tests — recompute with FREEFORM

**Files:**
- Modify: `tests/utils/recomputePhases.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this block at the end of `tests/utils/recomputePhases.test.ts`, after the last `describe` block:

```typescript
import { FREEFORM } from '../../src/methods/freeform'
import { CFOP_SOLVE_1 } from '../fixtures/solveFixtures'

describe('FREEFORM method', () => {
  it('produces exactly one phase labeled "Solved"', () => {
    const phases = recomputePhases(CFOP_SOLVE_1, FREEFORM)
    expect(phases).not.toBeNull()
    expect(phases).toHaveLength(1)
    expect(phases![0].label).toBe('Solved')
  })

  it('phase turns equals total move count', () => {
    const phases = recomputePhases(CFOP_SOLVE_1, FREEFORM)!
    expect(phases[0].turns).toBe(CFOP_SOLVE_1.moves.length)
  })

  it('returns null when cube is not solved', () => {
    // One U move on a U-scramble leaves cube unsolved
    const incompleteSolve = {
      ...CFOP_SOLVE_1,
      moves: [{ face: 'U' as const, direction: 'CW' as const, cubeTimestamp: 1000, serial: 0 }],
      scramble: 'U',
    }
    expect(recomputePhases(incompleteSolve, FREEFORM)).toBeNull()
  })
})
```

Note: `CFOP_SOLVE_1` is already imported at the top of this file via `CFOP_SOLVES`. If it isn't a named export, add it: the fixture file exports `CFOP_SOLVE_1` directly.

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm run test -- tests/utils/recomputePhases.test.ts
```

Expected: all tests in the file pass (the FREEFORM tests pass immediately because `FREEFORM` uses the same single-phase mechanism already tested with `SINGLE_PHASE_METHOD`).

- [ ] **Step 3: Commit**

```bash
git add tests/utils/recomputePhases.test.ts
git commit -m "test: FREEFORM recompute produces one Solved phase"
```

---

### Task 3: Tests — filterSolves with freeform

**Files:**
- Modify: `tests/filterSolves.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/filterSolves.test.ts`, add a `freeformSolve` fixture alongside the existing ones:

```typescript
const freeformSolve = makeSolve({ id: 6, method: 'freeform', driver: 'cube' })
```

Add it to the `ALL` array:
```typescript
const ALL: SolveRecord[] = [cfopCube, cfopMouse, rouxCube, example, legacy, freeformSolve]
```

Then add a new describe block at the end of the file:

```typescript
describe('filterSolves — freeform', () => {
  it('freeform filter returns only freeform solves and examples', () => {
    const f: SolveFilter = { method: 'freeform', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([4, 6]) // example always passes through
  })

  it('cfop filter excludes freeform solves', () => {
    const f: SolveFilter = { method: 'cfop', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).not.toContain(6)
  })

  it('all filter includes freeform solves', () => {
    const f: SolveFilter = { method: 'all', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toContain(6)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- tests/filterSolves.test.ts
```

Expected: all pass. The `filterSolves` logic already works for any method string — no code changes needed.

Note: the existing `cfop+all` test expects ids `[1, 2, 4, 5]`. Adding `freeformSolve` (id 6) to `ALL` doesn't change that — id 6 is freeform, not cfop. Verify the test still passes.

- [ ] **Step 3: Commit**

```bash
git add tests/filterSolves.test.ts
git commit -m "test: filterSolves handles freeform method correctly"
```

---

### Task 4: Tests + fix — detectMethodMismatches skips freeform

**Files:**
- Create: `tests/utils/detectMethod.test.ts`
- Modify: `src/utils/detectMethod.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/utils/detectMethod.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectMethodMismatches } from '../../src/utils/detectMethod'
import { CFOP_SOLVE_1 } from '../fixtures/solveFixtures'
import type { SolveRecord } from '../../src/types/solve'

describe('detectMethodMismatches', () => {
  it('skips freeform solves — they are never flagged as mismatches', () => {
    const freeformSolve: SolveRecord = { ...CFOP_SOLVE_1, id: 999, method: 'freeform' }
    const mismatches = detectMethodMismatches([freeformSolve])
    expect(mismatches).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- tests/utils/detectMethod.test.ts
```

Expected: FAIL — the freeform solve is currently processed and may produce a mismatch because `freeform` doesn't match `'cfop'` or `'roux'`.

- [ ] **Step 3: Add freeform guard in `src/utils/detectMethod.ts`**

In `detectMethodMismatches`, add the freeform guard after the existing `isExample` guard (around line 49):

```typescript
for (const solve of solves) {
  if (solve.isExample) continue
  if (solve.method === 'freeform') continue   // ← add this line
  if (solve.moves.length === 0) continue
  // ... rest unchanged
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -- tests/utils/detectMethod.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/utils/detectMethod.test.ts src/utils/detectMethod.ts
git commit -m "feat: skip freeform solves in detectMethodMismatches"
```

---

### Task 5: Add freeform to MethodSelector

**Files:**
- Modify: `src/components/MethodSelector.tsx`

- [ ] **Step 1: Add FREEFORM to the METHODS array**

In `src/components/MethodSelector.tsx`, update the import and the array:

```typescript
import type { SolveMethod } from '../types/solve'
import { CFOP, ROUX, FREEFORM } from '../methods/index'

const METHODS: SolveMethod[] = [CFOP, ROUX, FREEFORM]
```

The rest of the component is unchanged — it already maps over `METHODS` dynamically.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MethodSelector.tsx
git commit -m "feat: add Freeform to MethodSelector"
```

---

### Task 6: Add freeform to SolveHistorySidebar filter dropdown

**Files:**
- Modify: `src/components/SolveHistorySidebar.tsx`

- [ ] **Step 1: Add the freeform option**

In `src/components/SolveHistorySidebar.tsx`, find the method filter `<select>` (around line 106). Add the freeform option after `<option value="roux">Roux</option>`:

```tsx
<option value="all">All</option>
<option value="cfop">CFOP</option>
<option value="roux">Roux</option>
<option value="freeform">Freeform</option>
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SolveHistorySidebar.tsx
git commit -m "feat: add Freeform option to method filter in SolveHistorySidebar"
```

---

### Task 7: Add freeform to TrendsModal — dropdown + color map

**Files:**
- Modify: `src/components/TrendsModal.tsx`

- [ ] **Step 1: Add FREEFORM import**

At the top of `src/components/TrendsModal.tsx`, find the import from `../methods/index` and add `FREEFORM`:

```typescript
import { CFOP, ROUX, FREEFORM, getMethod } from '../methods/index'
```

- [ ] **Step 2: Update `buildColorMap` to include FREEFORM**

Find the `buildColorMap` function (around line 133). Replace it with:

```typescript
function buildColorMap(
  method: SolveFilter['method'],
  grouped: boolean,
): Record<string, string> {
  if (method === 'all') {
    // Merge colors from all methods so phase names don't fall back to gray
    return {
      ...buildColorMapForMethod(FREEFORM, grouped),
      ...buildColorMapForMethod(ROUX, grouped),
      ...buildColorMapForMethod(CFOP, grouped),
    }
  }
  return buildColorMapForMethod(getMethod(method), grouped)
}
```

Note: `getMethod('freeform')` now returns `FREEFORM` (Task 1), so the `'freeform'` branch is handled automatically by the `else` path `buildColorMapForMethod(getMethod(method), grouped)`.

- [ ] **Step 3: Add freeform option to the Trends method dropdown**

Find the method `<select>` in TrendsModal (around line 536). Add the freeform option after `<option value="roux">Roux</option>`:

```tsx
<option value="all">All</option>
<option value="cfop">CFOP</option>
<option value="roux">Roux</option>
<option value="freeform">Freeform</option>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: add Freeform to TrendsModal method filter and color map"
```

---

## Manual Smoke Test

After all tasks, verify in the browser (`npm run dev`, open Chrome):

1. **Global method selector** — Timer bar method dropdown shows "Freeform" as an option.
2. **Record a solve as Freeform** — Select Freeform, complete a solve. Solve appears in history with one "Solved" phase in the PhaseBar.
3. **Method filter in sidebar** — Set filter to "Freeform" — only freeform solves appear. Set to "All" — all solves appear including freeform.
4. **Per-solve method change** — Open a CFOP solve detail, change method to Freeform → phases update to one "Solved" phase. Change back to CFOP → CFOP phases restored.
5. **Trends modal** — Open Trends with Freeform filter → phase chart shows one green "Solved" bar per solve.

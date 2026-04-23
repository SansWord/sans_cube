# Trends Zoom Cross-Filter Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chart zoom persist across method/driver filter changes in TrendsModal by computing xIndex against the full sorted solve set before filtering.

**Architecture:** Replace the three-step pipeline (`filterSolves → sortAndSliceWindow → buildTotalData/buildPhaseData`) with a four-step pipeline (`buildStatsData → filterStats → windowStats → buildTotalData/buildPhaseData`). `buildStatsData` assigns stable xIndex values to each solve before any filter is applied, so changing the filter only affects which dots are visible inside the zoom window — it does not renumber the x-axis. The x-axis domain locks to the zoom range when zoomed, regardless of how many solves are currently visible.

**Tech Stack:** React 19 + TypeScript, Recharts (ComposedChart/LineChart), Vitest + Testing Library

---

## File Structure

| File | Role |
|---|---|
| `src/utils/trends.ts` | Add `StatsSolvePoint` interface, `buildStatsData`, `windowStats`. Update `buildTotalData` and `buildPhaseData` signatures to accept `StatsSolvePoint[]`. Delete `sortAndSliceWindow`. |
| `src/utils/solveStats.ts` | Add `filterStats`. Keep existing `filterSolves` (sidebar still uses it). |
| `src/components/TrendsModal.tsx` | Rewire data pipeline; update `buildMergedPhaseData` helper signature; add zoomed x-axis domain branch; update tooltip header from seq to xIndex. |
| `tests/utils/trends.test.ts` | Add tests for `buildStatsData` and `windowStats`; update all `buildTotalData`/`buildPhaseData` test calls to use new API; add tests 9–10 (xIndex passthrough); remove `describe('sortAndSliceWindow')` block. |
| `tests/utils/solveStats.test.ts` | Add tests for `filterStats`; add `filterSolves` regression guard for example bypass. |

---

## Task 1: Add `StatsSolvePoint` + `buildStatsData` to `src/utils/trends.ts`

**Files:**
- Modify: `src/utils/trends.ts`
- Modify: `tests/utils/trends.test.ts`

- [ ] **Step 1: Add failing tests for `buildStatsData`**

Add this `describe` block in `tests/utils/trends.test.ts`, right after the existing imports (before the first `describe`):

```ts
// ─── buildStatsData ──────────────────────────────────────────────────────────

describe('buildStatsData', () => {
  it('seq mode: assigns xIndex in seq order', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)]),
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 750, 0)]),
    ]
    const result = buildStatsData(solves, 'seq')
    expect(result).toHaveLength(3)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].id).toBe(1)   // seq=1 → first
    expect(result[1].xIndex).toBe(2)
    expect(result[1].id).toBe(2)
    expect(result[2].xIndex).toBe(3)
    expect(result[2].id).toBe(3)
  })

  it('date mode: assigns xIndex in date order', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),
    ]
    const result = buildStatsData(solves, 'date')
    expect(result[0].xIndex).toBe(1)
    expect(result[0].id).toBe(3)   // date=1000 → oldest → xIndex 1
    expect(result[2].xIndex).toBe(3)
    expect(result[2].id).toBe(1)   // date=3000 → newest → xIndex 3
  })

  it('strips example solves from output', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    const result = buildStatsData(solves, 'seq')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(2)
    expect(result[0].xIndex).toBe(1)
  })

  it('output points do not contain moves, scramble, or seq', () => {
    const solves = [makeSolve(1, [makePhase('A', 1000, 0)])]
    const result = buildStatsData(solves, 'seq')
    expect('moves' in result[0]).toBe(false)
    expect('scramble' in result[0]).toBe(false)
    expect('seq' in result[0]).toBe(false)
  })

  it('applies cfop/cube defaults for missing method/driver', () => {
    const solve: SolveRecord = {
      id: 1, scramble: '', timeMs: 5000, moves: [], phases: [], date: 0,
      // method and driver intentionally absent
    }
    const result = buildStatsData([solve], 'seq')
    expect(result[0].method).toBe('cfop')
    expect(result[0].driver).toBe('cube')
  })
})
```

Also update the import line at the top of `tests/utils/trends.test.ts` to include `buildStatsData`:

```ts
import { buildTotalData, buildPhaseData, sortAndSliceWindow, buildStatsData } from '../../src/utils/trends'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: 5 new failures — `buildStatsData is not a function` (or similar).

- [ ] **Step 3: Add `StatsSolvePoint` interface and `buildStatsData` to `src/utils/trends.ts`**

Add after the existing `import` and before `export type SortMode`:

```ts
export interface StatsSolvePoint {
  id: number
  date: number
  timeMs: number
  phases: PhaseRecord[]
  method: string
  driver: string
  xIndex: number
}
```

Add `buildStatsData` after `sortAndSliceWindow` (do not delete `sortAndSliceWindow` yet):

```ts
export function buildStatsData(solves: SolveRecord[], sortMode: SortMode): StatsSolvePoint[] {
  const real = solves.filter(s => !s.isExample)
  const sorted = sortMode === 'date'
    ? [...real].sort((a, b) => a.date - b.date)
    : [...real].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  return sorted.map((s, i) => ({
    id: s.id,
    date: s.date,
    timeMs: s.timeMs,
    phases: s.phases,
    method: s.method ?? 'cfop',
    driver: s.driver ?? 'cube',
    xIndex: i + 1,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: all 5 new `buildStatsData` tests pass; all pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/trends.ts tests/utils/trends.test.ts
git commit -m "feat: add StatsSolvePoint interface and buildStatsData to trends.ts"
```

---

## Task 2: Add `filterStats` to `src/utils/solveStats.ts`

**Files:**
- Modify: `src/utils/solveStats.ts`
- Modify: `tests/utils/solveStats.test.ts`

- [ ] **Step 1: Add failing tests for `filterStats` and regression guard for `filterSolves`**

In `tests/utils/solveStats.test.ts`, add this import at the top (add `filterStats` to the existing import):

```ts
import { computeAo, computeStats, filterSolves, filterStats } from '../../src/utils/solveStats'
```

Also add this import for the `StatsSolvePoint` type:

```ts
import type { StatsSolvePoint } from '../../src/utils/trends'
```

Then add at the end of the file:

```ts
// ─── filterStats ─────────────────────────────────────────────────────────────

function makeStatsPoint(
  id: number,
  opts: { method?: string; driver?: string; xIndex?: number } = {},
): StatsSolvePoint {
  return {
    id,
    date: 0,
    timeMs: 5000,
    phases: [],
    method: opts.method ?? 'cfop',
    driver: opts.driver ?? 'cube',
    xIndex: opts.xIndex ?? id,
  }
}

describe('filterStats', () => {
  it('preserves xIndex values across filter — does not renumber', () => {
    const points = [
      makeStatsPoint(1, { method: 'cfop',  xIndex: 1 }),
      makeStatsPoint(2, { method: 'roux',  xIndex: 2 }),
      makeStatsPoint(3, { method: 'cfop',  xIndex: 3 }),
    ]
    const result = filterStats(points, { method: 'cfop', driver: 'all' })
    expect(result).toHaveLength(2)
    expect(result[0].xIndex).toBe(1)
    expect(result[1].xIndex).toBe(3)   // not renumbered to 2
  })

  it('matches defaulted method values exactly', () => {
    const points = [
      makeStatsPoint(1, { method: 'cfop', xIndex: 1 }),
      makeStatsPoint(2, { method: 'roux', xIndex: 2 }),
    ]
    const cfopResult = filterStats(points, { method: 'cfop', driver: 'all' })
    expect(cfopResult).toHaveLength(1)
    expect(cfopResult[0].id).toBe(1)

    const rouxResult = filterStats(points, { method: 'roux', driver: 'all' })
    expect(rouxResult).toHaveLength(1)
    expect(rouxResult[0].id).toBe(2)
  })
})

// ─── filterSolves regression guard ───────────────────────────────────────────

describe('filterSolves (regression: example bypass)', () => {
  it('keeps example solves even when method filter excludes their method', () => {
    const example: SolveRecord = {
      id: 1, scramble: '', timeMs: 5000, moves: [], phases: [], date: 0,
      isExample: true, method: 'roux',
    }
    const regular: SolveRecord = {
      id: 2, scramble: '', timeMs: 5000, moves: [], phases: [], date: 0,
      method: 'cfop',
    }
    const result = filterSolves([example, regular], { method: 'cfop', driver: 'all' })
    expect(result).toContainEqual(example)   // example kept despite method mismatch
    expect(result).toContainEqual(regular)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- solveStats.test.ts
```

Expected: `filterStats is not a function` failures.

- [ ] **Step 3: Add `filterStats` to `src/utils/solveStats.ts`**

Add at the top of `src/utils/solveStats.ts`, after existing imports:

```ts
import type { StatsSolvePoint } from './trends'
```

Add after `filterSolves`:

```ts
export function filterStats(
  indexed: StatsSolvePoint[],
  filter: SolveFilter,
): StatsSolvePoint[] {
  let result = indexed
  if (filter.method !== 'all') result = result.filter(p => p.method === filter.method)
  if (filter.driver !== 'all') result = result.filter(p => p.driver === filter.driver)
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- solveStats.test.ts
```

Expected: all new `filterStats` and regression guard tests pass; all pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/solveStats.ts tests/utils/solveStats.test.ts
git commit -m "feat: add filterStats to solveStats.ts (xIndex-preserving filter for stats pipeline)"
```

---

## Task 3: Add `windowStats` to `src/utils/trends.ts`

**Files:**
- Modify: `src/utils/trends.ts`
- Modify: `tests/utils/trends.test.ts`

- [ ] **Step 1: Add failing test for `windowStats`**

Update the import line in `tests/utils/trends.test.ts` to include `windowStats`:

```ts
import { buildTotalData, buildPhaseData, sortAndSliceWindow, buildStatsData, windowStats } from '../../src/utils/trends'
```

Add this `describe` block after the `describe('buildStatsData')` block:

```ts
// ─── windowStats ─────────────────────────────────────────────────────────────

describe('windowStats', () => {
  it('last-N: returns the last N entries with original xIndex values preserved', () => {
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 10 },
      { id: 2, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 20 },
      { id: 3, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 30 },
    ]
    const result = windowStats(points, 2)
    expect(result).toHaveLength(2)
    expect(result[0].xIndex).toBe(20)   // not renumbered
    expect(result[1].xIndex).toBe(30)
  })

  it('returns all entries unchanged when windowSize is all', () => {
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 5 },
      { id: 2, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 10 },
    ]
    const result = windowStats(points, 'all')
    expect(result).toHaveLength(2)
    expect(result[0].xIndex).toBe(5)
    expect(result[1].xIndex).toBe(10)
  })
})
```

Also add the `StatsSolvePoint` type import at the top:

```ts
import type { SolveRecord, PhaseRecord } from '../../src/types/solve'
import type { StatsSolvePoint } from '../../src/utils/trends'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: `windowStats is not a function` failures.

- [ ] **Step 3: Add `windowStats` to `src/utils/trends.ts`**

Add after `buildStatsData`:

```ts
export function windowStats(
  indexed: StatsSolvePoint[],
  windowSize: number | 'all',
): StatsSolvePoint[] {
  if (windowSize === 'all') return indexed
  return indexed.slice(-windowSize)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: all `windowStats` tests pass; all prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/trends.ts tests/utils/trends.test.ts
git commit -m "feat: add windowStats to trends.ts (xIndex-preserving window slice)"
```

---

## Task 4: Update `buildTotalData` to accept `StatsSolvePoint[]`

**Files:**
- Modify: `src/utils/trends.ts`
- Modify: `tests/utils/trends.test.ts`

This task migrates all existing `buildTotalData` test calls to the new pipeline API and adds spec test #9 (xIndex passthrough). The function signature changes from `SolveRecord[]` to `StatsSolvePoint[]`.

- [ ] **Step 1: Add helper + update all `buildTotalData` test calls + add spec test #9**

In `tests/utils/trends.test.ts`, add a helper after `makeSolve`:

```ts
/** Shortcut: build a StatsSolvePoint[] from SolveRecord[] via the new pipeline. */
function statsOf(solves: SolveRecord[], sortMode: SortMode = 'seq', window: number | 'all' = 'all'): StatsSolvePoint[] {
  return windowStats(buildStatsData(solves, sortMode), window)
}
```

Then update every `buildTotalData(sortAndSliceWindow(solves, ...))` call in the `describe('buildTotalData')` block to use `buildTotalData(statsOf(solves, ...))`.

Full replacement for the `describe('buildTotalData')` block (replace the entire block):

```ts
describe('buildTotalData', () => {
  it('returns one entry per solve with exec = sum(executionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
      makeSolve(2, [makePhase('Cross', 1200, 600), makePhase('F2L', 2800, 300)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(4000)  // 1000 + 3000
    expect(result[1].exec).toBe(4000)  // 1200 + 2800
  })

  it('returns recog = sum(recognitionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result[0].recog).toBe(900)  // 500 + 400
  })

  it('returns total = exec + recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result[0].total).toBe(4900)  // 4000 + 900
  })

  it('xIndex comes from input StatsSolvePoint, not position', () => {
    // Directly construct StatsSolvePoint[] with non-sequential xIndex values.
    // buildTotalData must pass them through unchanged.
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [makePhase('A', 1000, 0)], method: 'cfop', driver: 'cube', xIndex: 100 },
      { id: 2, date: 0, timeMs: 0, phases: [makePhase('A', 2000, 0)], method: 'cfop', driver: 'cube', xIndex: 200 },
      { id: 3, date: 0, timeMs: 0, phases: [makePhase('A', 3000, 0)], method: 'cfop', driver: 'cube', xIndex: 350 },
    ]
    const result = buildTotalData(points)
    expect(result[0].xIndex).toBe(100)
    expect(result[1].xIndex).toBe(200)
    expect(result[2].xIndex).toBe(350)
  })

  it('stores the solve id in solveId', () => {
    const solves = [makeSolve(42, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(statsOf(solves))
    expect(result[0].solveId).toBe(42)
  })

  it('slices to last N solves when window is a number', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(statsOf(solves, 'seq', 2))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(2000)
    expect(result[1].exec).toBe(3000)
  })

  it('excludes example solves from data and from window count', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(2000)
  })

  it('excludes example solves when applying window slice', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)], { isExample: true }),
      makeSolve(3, [makePhase('A', 3000, 0)]),
      makeSolve(4, [makePhase('A', 4000, 0)]),
    ]
    // 3 real solves (1, 3, 4), window=2 → last 2 real = solves 3 and 4
    const result = buildTotalData(statsOf(solves, 'seq', 2))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(3000)
    expect(result[1].exec).toBe(4000)
  })

  it('execAo5 is null when fewer than 5 solves are in the window', () => {
    const solves = Array.from({ length: 4 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(statsOf(solves))
    expect(result.every(p => p.execAo5 === null)).toBe(true)
  })

  it('execAo5 is computed (trimmed mean) once 5+ solves available', () => {
    // exec values: 1000, 2000, 3000, 4000, 5000 → trim 1000 and 5000 → mean(2000,3000,4000) = 3000
    const values = [1000, 2000, 3000, 4000, 5000]
    const solves = values.map((v, i) => makeSolve(i + 1, [makePhase('A', v, 0)]))
    const result = buildTotalData(statsOf(solves))
    expect(result[4].execAo5).toBeCloseTo(3000)
  })

  it('execAo12 is null when fewer than 12 solves', () => {
    const solves = Array.from({ length: 11 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(statsOf(solves))
    expect(result.every(p => p.execAo12 === null)).toBe(true)
  })

  it('execAo12 is non-null once 12+ solves available', () => {
    const solves = Array.from({ length: 12 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000 * (i + 1), 0)])
    )
    const result = buildTotalData(statsOf(solves))
    expect(result[11].execAo12).not.toBeNull()
  })

  it('ao5/ao12 are computed independently per type', () => {
    // exec=2000, recog=9999 for all 5 solves
    const solves = Array.from({ length: 5 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 2000, 9999)])
    )
    const result = buildTotalData(statsOf(solves))
    // execAo5 of five 2000s → 2000
    expect(result[4].execAo5).toBeCloseTo(2000)
    // recogAo5 of five 9999s → 9999
    expect(result[4].recogAo5).toBeCloseTo(9999)
    // totalAo5 of five 11999s → 11999
    expect(result[4].totalAo5).toBeCloseTo(11999)
  })

  it('date-sorted input: xIndex reflects position in date order, not seq order', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),  // oldest by date
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),  // newest by date
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
    ]
    const result = buildTotalData(statsOf(solves, 'date'))
    // Should be ordered: seq3(date1000), seq2(date2000), seq1(date3000)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(3)
    expect(result[1].xIndex).toBe(2)
    expect(result[1].solveId).toBe(2)
    expect(result[2].xIndex).toBe(3)
    expect(result[2].solveId).toBe(1)
  })

  it('date-sorted input: Ao5 reflects date-ordered rolling window', () => {
    // 5 solves with known exec times in date order: 1000, 2000, 3000, 4000, 5000
    const solves = [
      makeSolve(5, [makePhase('A', 1000, 0)], { date: 100 }),
      makeSolve(4, [makePhase('A', 2000, 0)], { date: 200 }),
      makeSolve(3, [makePhase('A', 3000, 0)], { date: 300 }),
      makeSolve(2, [makePhase('A', 4000, 0)], { date: 400 }),
      makeSolve(1, [makePhase('A', 5000, 0)], { date: 500 }),
    ]
    const result = buildTotalData(statsOf(solves, 'date'))
    // Date-ordered execs: [1000, 2000, 3000, 4000, 5000]
    // Ao5 at index 4 = trimmed mean([1000,2000,3000,4000,5000]) = mean(2000,3000,4000) = 3000
    expect(result[4].execAo5).toBeCloseTo(3000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: TypeScript errors or runtime failures because `buildTotalData` still takes `SolveRecord[]`.

- [ ] **Step 3: Update `buildTotalData` in `src/utils/trends.ts`**

Replace the existing `buildTotalData` function:

```ts
export function buildTotalData(windowed: StatsSolvePoint[]): TotalDataPoint[] {
  const execs = windowed.map(p => p.phases.reduce((sum, ph) => sum + ph.executionMs, 0))
  const recogs = windowed.map(p => p.phases.reduce((sum, ph) => sum + ph.recognitionMs, 0))
  const totals = execs.map((e, i) => e + recogs[i])
  return windowed.map((p, i) => ({
    xIndex: p.xIndex,
    exec: execs[i],
    recog: recogs[i],
    total: totals[i],
    execAo5: rollingAo(execs, i, 5),
    execAo12: rollingAo(execs, i, 12),
    recogAo5: rollingAo(recogs, i, 5),
    recogAo12: rollingAo(recogs, i, 12),
    totalAo5: rollingAo(totals, i, 5),
    totalAo12: rollingAo(totals, i, 12),
    solveId: p.id,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: all `buildTotalData` tests pass (including the new xIndex passthrough test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/trends.ts tests/utils/trends.test.ts
git commit -m "refactor: buildTotalData accepts StatsSolvePoint[] — xIndex read from input"
```

---

## Task 5: Update `buildPhaseData` to accept `StatsSolvePoint[]`

**Files:**
- Modify: `src/utils/trends.ts`
- Modify: `tests/utils/trends.test.ts`

- [ ] **Step 1: Update all `buildPhaseData` test calls + add spec test #10**

Replace the entire `describe('buildPhaseData')` block in `tests/utils/trends.test.ts`:

```ts
describe('buildPhaseData', () => {
  it('ungrouped: uses phase labels as keys', () => {
    const solves = [
      makeSolve(1, [
        makePhase('Cross', 1000, 0),
        makePhase('F2L Slot 1', 2000, 0, 'F2L'),
      ]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', false)
    expect(result[0]['Cross']).toBe(1000)
    expect(result[0]['F2L Slot 1']).toBe(2000)
    expect('F2L' in result[0]).toBe(false)
  })

  it('grouped: sums phases with the same group into one key', () => {
    const solves = [
      makeSolve(1, [
        makePhase('Cross', 1000, 0),
        makePhase('F2L Slot 1', 2000, 0, 'F2L'),
        makePhase('F2L Slot 2', 1500, 0, 'F2L'),
      ]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', true)
    expect(result[0]['Cross']).toBe(1000)    // no group → use label
    expect(result[0]['F2L']).toBe(3500)       // 2000 + 1500
    expect('F2L Slot 1' in result[0]).toBe(false)
  })

  it('grouped: ungrouped phases still use their label', () => {
    const solves = [
      makeSolve(1, [
        makePhase('Cross', 800, 0),           // no group
        makePhase('EOLL', 1200, 0, 'OLL'),
      ]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', true)
    expect(result[0]['Cross']).toBe(800)
    expect(result[0]['OLL']).toBe(1200)
  })

  it('uses recognitionMs when timeType is recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500)]),
    ]
    const result = buildPhaseData(statsOf(solves), 'recog', false)
    expect(result[0]['Cross']).toBe(500)
  })

  it('uses exec+recog when timeType is total', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 2000, 300)]),
    ]
    const result = buildPhaseData(statsOf(solves), 'total', false)
    expect(result[0]['Cross']).toBe(1500)  // 1000 + 500
    expect(result[0]['F2L']).toBe(2300)    // 2000 + 300
  })

  it('slices to last N non-example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildPhaseData(statsOf(solves, 'seq', 2), 'exec', false)
    expect(result).toHaveLength(2)
    expect(result[0]['A']).toBe(2000)
  })

  it('excludes example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', false)
    expect(result).toHaveLength(1)
    expect(result[0]['A']).toBe(2000)
  })

  it('xIndex comes from input StatsSolvePoint, not position', () => {
    // Directly construct StatsSolvePoint[] with non-sequential xIndex values.
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [makePhase('A', 1000, 0)], method: 'cfop', driver: 'cube', xIndex: 100 },
      { id: 2, date: 0, timeMs: 0, phases: [makePhase('A', 2000, 0)], method: 'cfop', driver: 'cube', xIndex: 200 },
      { id: 3, date: 0, timeMs: 0, phases: [makePhase('A', 3000, 0)], method: 'cfop', driver: 'cube', xIndex: 350 },
    ]
    const result = buildPhaseData(points, 'exec', false)
    expect(result[0].xIndex).toBe(100)
    expect(result[1].xIndex).toBe(200)
    expect(result[2].xIndex).toBe(350)
  })

  it('includes solveId', () => {
    const solves = [makeSolve(99, [makePhase('A', 1000, 0)])]
    const result = buildPhaseData(statsOf(solves), 'exec', false)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(99)
  })

  it('date-sorted input: xIndex reflects date order position', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
    ]
    const result = buildPhaseData(statsOf(solves, 'date'), 'exec', false)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(3)  // seq=3 but date=1000 (oldest) → xIndex=1
    expect(result[2].xIndex).toBe(3)
    expect(result[2].solveId).toBe(1)  // seq=1 but date=3000 (newest) → xIndex=3
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: TypeScript errors because `buildPhaseData` still takes `SolveRecord[]`.

- [ ] **Step 3: Update `buildPhaseData` in `src/utils/trends.ts`**

Replace the existing `buildPhaseData` function:

```ts
export function buildPhaseData(
  windowed: StatsSolvePoint[],
  timeType: 'exec' | 'recog' | 'total',
  grouped: boolean,
): PhaseDataPoint[] {
  return windowed.map(p => {
    const point: PhaseDataPoint = { xIndex: p.xIndex, solveId: p.id }
    for (const phase of p.phases) {
      const key = grouped && phase.group ? phase.group : phase.label
      const ms = timeType === 'exec' ? phase.executionMs
               : timeType === 'recog' ? phase.recognitionMs
               : phase.executionMs + phase.recognitionMs
      point[key] = ((point[key] as number | null | undefined) ?? 0) + ms
    }
    return point
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test -- trends.test.ts
```

Expected: all `buildPhaseData` tests pass (including the new xIndex passthrough test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/trends.ts tests/utils/trends.test.ts
git commit -m "refactor: buildPhaseData accepts StatsSolvePoint[] — xIndex read from input"
```

---

## Task 6: Delete `sortAndSliceWindow` and clean up test file

**Files:**
- Modify: `src/utils/trends.ts`
- Modify: `tests/utils/trends.test.ts`

`sortAndSliceWindow` is no longer called by anything (both `buildTotalData` and `buildPhaseData` now use `StatsSolvePoint[]`, and TrendsModal will use the new pipeline in Task 7). Delete it from source and remove its test block.

- [ ] **Step 1: Delete `sortAndSliceWindow` from `src/utils/trends.ts`**

Remove the entire `sortAndSliceWindow` function (lines 34–46 in the original file):

```ts
// DELETE this entire function:
export function sortAndSliceWindow(
  solves: SolveRecord[],
  window: number | 'all',
  sortMode: SortMode,
): SolveRecord[] {
  const real = solves.filter(s => !s.isExample)
  const cmp = sortMode === 'date'
    ? (a: SolveRecord, b: SolveRecord) => a.date - b.date
    : (a: SolveRecord, b: SolveRecord) => (a.seq ?? 0) - (b.seq ?? 0)
  const sorted = [...real].sort(cmp)
  if (window === 'all') return sorted
  return sorted.slice(-window)
}
```

- [ ] **Step 2: Remove `sortAndSliceWindow` import and its describe block from `tests/utils/trends.test.ts`**

Update the import line — remove `sortAndSliceWindow`:

```ts
import { buildTotalData, buildPhaseData, buildStatsData, windowStats } from '../../src/utils/trends'
```

Delete the entire `describe('sortAndSliceWindow', () => { ... })` block (the last describe block in the file).

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test
```

Expected: all tests pass. TypeScript build also clean: `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src/utils/trends.ts tests/utils/trends.test.ts
git commit -m "refactor: delete sortAndSliceWindow — superseded by buildStatsData + windowStats"
```

---

## Task 7: Rewire TrendsModal data pipeline

**Files:**
- Modify: `src/components/TrendsModal.tsx`

Replace the three-step pipeline with the new four-step pipeline. Also update `buildMergedPhaseData` to accept `StatsSolvePoint[]`.

- [ ] **Step 1: Update imports in `TrendsModal.tsx`**

Replace the existing import lines that reference trends utils and solveStats:

```ts
// REMOVE these lines:
import { buildTotalData, buildPhaseData, sortAndSliceWindow } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint, SortMode } from '../utils/trends'
import { filterSolves } from '../utils/solveStats'

// ADD these lines:
import { buildTotalData, buildPhaseData, buildStatsData, windowStats } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint, SortMode, StatsSolvePoint } from '../utils/trends'
import { filterStats } from '../utils/solveStats'
```

- [ ] **Step 2: Update `buildMergedPhaseData` helper signature**

Find the `buildMergedPhaseData` function (around line 148). Change its first parameter type from `SolveRecord[]` to `StatsSolvePoint[]`:

```ts
function buildMergedPhaseData(
  windowed: StatsSolvePoint[],
  phaseToggle: TimeToggle,
  grouped: boolean,
): PhaseDataPoint[] {
```

(The function body is unchanged.)

- [ ] **Step 3: Replace the data pipeline inside the component**

Find this block inside `TrendsModal` (around lines 331–339):

```ts
const filtered = filterSolves(solves, solveFilter)
const method = getMethod(solveFilter.method === 'all' ? 'cfop' : solveFilter.method)
const hasGroups = method.phases.some(p => p.group)

const currentDomain: [number, number] | null = zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : null

const windowed = sortAndSliceWindow(filtered, windowSize, sortMode)
const totalData = buildTotalData(windowed)
const phaseData = buildMergedPhaseData(windowed, phaseToggle, grouped)
```

Replace with:

```ts
const method = getMethod(solveFilter.method === 'all' ? 'cfop' : solveFilter.method)
const hasGroups = method.phases.some(p => p.group)

const currentDomain: [number, number] | null = zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : null

const indexed = buildStatsData(solves, sortMode)
const filteredStats = filterStats(indexed, solveFilter)
const windowed = windowStats(filteredStats, windowSize)
const totalData = buildTotalData(windowed)
const phaseData = buildMergedPhaseData(windowed, phaseToggle, grouped)
```

- [ ] **Step 4: Run the build to confirm no TypeScript errors**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run build
```

Expected: clean build. Also run tests:

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "refactor: TrendsModal uses buildStatsData→filterStats→windowStats pipeline"
```

---

## Task 8: Add zoomed x-axis domain branch to TrendsModal

**Files:**
- Modify: `src/components/TrendsModal.tsx`

When zoomed, lock the x-axis domain to the zoom range instead of auto-fitting to visible data.

- [ ] **Step 1: Update `xAxisProps` domain computation**

Find the `xAxisProps` object (around line 498):

```ts
const xAxisProps = {
  dataKey: 'xIndex' as const,
  type: 'number' as const,
  domain: [firstVisIndex - 0.5, lastVisIndex + 0.5] as [number, number],
  allowDecimals: false,
  stroke: '#555',
  tick: { fill: '#555', fontSize: 11 },
}
```

Replace it with:

```ts
const xAxisDomain: [number, number] = currentDomain
  ? [currentDomain[0] - 0.5, currentDomain[1] + 0.5]
  : [firstVisIndex - 0.5, lastVisIndex + 0.5]

const xAxisProps = {
  dataKey: 'xIndex' as const,
  type: 'number' as const,
  domain: xAxisDomain,
  allowDecimals: false,
  stroke: '#555',
  tick: { fill: '#555', fontSize: 11 },
}
```

- [ ] **Step 2: Run the build to confirm no TypeScript errors**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: lock x-axis domain to zoom range when zoomed (cross-filter persistence)"
```

---

## Task 9: Update tooltip to show `#N` using xIndex instead of `seq`

**Files:**
- Modify: `src/components/TrendsModal.tsx`

Both `TotalTooltip` and `PhaseTooltip` currently show `Solve #{solve?.seq ?? '?'}`. Replace with `#{d.xIndex}` / `#{pt.xIndex}` — the solve's stable position in the sorted dataset.

- [ ] **Step 1: Update `TotalTooltip` header**

Find in `TotalTooltip` (around line 265):

```tsx
const d = payload[0].payload
const solve = solveMap.get(d.solveId)
// ...
<div>Solve #{solve?.seq ?? '?'}</div>
{solve && <div style={{ color: '#666', fontSize: 11 }}>{formatDateTime(solve.date)}</div>}
```

Replace with:

```tsx
const d = payload[0].payload
const solve = solveMap.get(d.solveId)
// ...
<div>#{d.xIndex}</div>
{solve && <div style={{ color: '#666', fontSize: 11 }}>{formatDateTime(solve.date)}</div>}
```

(`solve` is still needed for the date line — do not remove `const solve = ...`.)

- [ ] **Step 2: Update `PhaseTooltip` header**

Find in `PhaseTooltip` (around line 295):

```tsx
const pt = payload[0].payload
const solve = solveMap.get(pt.solveId as number)
return (
  <div ...>
    <div>Solve #{solve?.seq ?? '?'}</div>
```

Replace with:

```tsx
const pt = payload[0].payload
const solve = solveMap.get(pt.solveId as number)
return (
  <div ...>
    <div>#{pt.xIndex}</div>
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Run the build**

```bash
cd /Users/sansword/Source/github/sans_cube && npm run build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: tooltip shows #N (xIndex) instead of seq number"
```

---

## Manual QA Checklist

After completing all tasks, verify in the browser (Chrome/Edge — Web Bluetooth required):

- [ ] Zoom into a range with filter = All, then switch to Roux → Roux solves appear inside the zoom window (not empty chart)
- [ ] Switch back to All → all solves visible inside zoom window
- [ ] Zoom → drill-down (drag-zoom within zoomed range) → change filter → drill back out; each stack level renders with current filter
- [ ] Sort-mode change resets zoom (unchanged from v1.29.1)
- [ ] Window-size change resets zoom (unchanged from v1.29.1)
- [ ] Tooltip shows `#N` format (the solve's xIndex position); seq number is gone
- [ ] Day-line reference lines still appear in both sort modes
- [ ] Filter = All with no zoom → chart looks identical to before this feature

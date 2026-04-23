# Sort-by-Timestamp Toggle in Trends — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sort dropdown to the Trends modal header that reorders chart data by solve sequence (default) or by completion date, fixing the backward-jumping day-boundary labels after an acubemy import.

**Architecture:** Extract sorting+windowing into a new exported `sortAndSliceWindow` function; refactor `buildTotalData`/`buildPhaseData` to accept a pre-windowed array (eliminating redundant sort+slice work); rename the x-axis position field from `seq` to `xIndex` on both data-point types; wire `sortMode` through URL params, TrendsModal state, and a new Sort dropdown.

**Tech Stack:** TypeScript, React 19, Vitest + Testing Library

---

## File Map

| File | Change |
|------|--------|
| `src/utils/trends.ts` | Add `SortMode` type + `sortAndSliceWindow`; refactor `buildTotalData`/`buildPhaseData` signatures; rename `seq`→`xIndex` on interfaces |
| `tests/utils/trends.test.ts` | Add tests for `sortAndSliceWindow`; update all existing tests to new API; rename `seq`→`xIndex` assertions |
| `src/hooks/useHashRouter.ts` | Add `sortMode: SortMode` to `TrendsHashParams`; update `parseTrendsParams` |
| `tests/hooks/useHashRouter.test.ts` | Add three `sortMode` parsing tests; update "all params" test |
| `src/components/TrendsModal.tsx` | Import `sortAndSliceWindow`/`SortMode`; add `sortMode` state; call `sortAndSliceWindow` once per render; update `buildMergedPhaseData`, `buildDayLines`, domain filters, `xIndex` references throughout; add Sort dropdown; add `sortMode` to zoom-reset and URL-sync effects |
| `docs/url-routes.md` | Add `sort=seq\|date` row to Trends params table |
| `docs/ui-architecture.md` | Add `sortMode` to TrendsModal state column |
| `docs/manual-test-checklist.md` | Add sort-toggle QA line |

---

## Task 1: Add `SortMode` type and `sortAndSliceWindow` to `trends.ts` (TDD)

**Files:**
- Modify: `src/utils/trends.ts`
- Modify: `tests/utils/trends.test.ts`

- [ ] **Step 1: Update `makeSolve` helper to support an optional `date` field**

In `tests/utils/trends.test.ts`, update `makeSolve`:

```ts
function makeSolve(
  id: number,
  phases: PhaseRecord[],
  opts: { method?: string; isExample?: boolean; date?: number } = {},
): SolveRecord {
  return {
    id,
    seq: id,
    scramble: '',
    timeMs: phases.reduce((s, p) => s + p.executionMs + p.recognitionMs, 0),
    moves: [],
    phases,
    date: opts.date ?? 0,
    method: opts.method ?? 'cfop',
    isExample: opts.isExample,
  }
}
```

- [ ] **Step 2: Write failing tests for `sortAndSliceWindow`**

Add this import at the top of `tests/utils/trends.test.ts`:

```ts
import { buildTotalData, buildPhaseData, sortAndSliceWindow } from '../../src/utils/trends'
```

Add a new `describe('sortAndSliceWindow', ...)` block after the `buildPhaseData` block:

```ts
describe('sortAndSliceWindow', () => {
  it('seq mode: returns solves ordered by solve seq', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 'all', 'seq')
    expect(result.map(s => s.seq)).toEqual([1, 2, 3])
  })

  it('date mode: returns solves ordered by date even when seq disagrees', () => {
    // Simulate post-import: imported solves have high seq but old date
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),  // imported: high seq, old date
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 'all', 'date')
    expect(result.map(s => s.date)).toEqual([1000, 2000, 3000])
  })

  it('excludes example solves in both modes', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    expect(sortAndSliceWindow(solves, 'all', 'seq')).toHaveLength(1)
    expect(sortAndSliceWindow(solves, 'all', 'date')).toHaveLength(1)
  })

  it('seq mode: window slices the last N after sorting by seq', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = sortAndSliceWindow(solves, 2, 'seq')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.seq)).toEqual([2, 3])
  })

  it('date mode: window slices the last N after sorting by date', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    // Sorted by date: [date=1000(seq3), date=2000(seq2), date=3000(seq1)]. Last 2: seq=2,seq=1
    const result = sortAndSliceWindow(solves, 2, 'date')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.date)).toEqual([2000, 3000])
  })
})
```

- [ ] **Step 3: Run tests to confirm new tests fail**

```bash
npm run test -- tests/utils/trends.test.ts
```

Expected: failures on all 5 new tests ("`sortAndSliceWindow` is not a function" or TypeScript error).

- [ ] **Step 4: Add `SortMode` type and `sortAndSliceWindow` to `src/utils/trends.ts`**

At the top of `src/utils/trends.ts`, after the import:

```ts
export type SortMode = 'seq' | 'date'
```

After the existing `rollingAo` function (before `sliceWindow`), add:

```ts
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

Leave the existing `sliceWindow`, `buildTotalData`, and `buildPhaseData` unchanged for now.

- [ ] **Step 5: Run tests to confirm new tests pass**

```bash
npm run test -- tests/utils/trends.test.ts
```

Expected: all 5 new tests pass; all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/trends.ts tests/utils/trends.test.ts
git commit -m "feat: add SortMode type and sortAndSliceWindow to trends.ts"
```

---

## Task 2: Refactor `buildTotalData` + `buildPhaseData` — new signatures and `xIndex` rename (TDD)

**Files:**
- Modify: `src/utils/trends.ts`
- Modify: `tests/utils/trends.test.ts`

- [ ] **Step 1: Write a failing test for the new `buildTotalData` signature with `xIndex`**

Add this test inside the `describe('buildTotalData', ...)` block in `tests/utils/trends.test.ts`:

```ts
it('new API: accepts pre-windowed array and returns xIndex field', () => {
  const windowed = [makeSolve(42, [makePhase('A', 1000, 0)])]
  // New signature: buildTotalData(windowed) — no window arg
  const result = buildTotalData(windowed)
  expect(result[0].xIndex).toBe(1)
  expect(result[0].solveId).toBe(42)
})
```

- [ ] **Step 2: Run tests to confirm it fails**

```bash
npm run test -- tests/utils/trends.test.ts
```

Expected: the new test fails (`buildTotalData` still requires 2 args; `xIndex` doesn't exist yet).

- [ ] **Step 3: Update `src/utils/trends.ts` — interfaces, `buildTotalData`, `buildPhaseData`, remove `sliceWindow`**

Replace the entire content of `src/utils/trends.ts` with:

```ts
import type { SolveRecord } from '../types/solve'

export type SortMode = 'seq' | 'date'

export interface TotalDataPoint {
  xIndex: number
  exec: number
  recog: number
  total: number
  execAo5: number | null
  execAo12: number | null
  recogAo5: number | null
  recogAo12: number | null
  totalAo5: number | null
  totalAo12: number | null
  solveId: number
}

export interface PhaseDataPoint {
  xIndex: number
  [phaseLabel: string]: number | null
  solveId: number
}

/** Trimmed rolling average of the last `n` values ending at `index`. Returns null if fewer than n values available. */
function rollingAo(values: number[], index: number, n: number): number | null {
  if (index + 1 < n) return null
  const slice = values.slice(index + 1 - n, index + 1)
  const sorted = [...slice].sort((a, b) => a - b)
  const trimmed = sorted.slice(1, -1)
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
}

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

export function buildTotalData(windowed: SolveRecord[]): TotalDataPoint[] {
  const execs = windowed.map(s => s.phases.reduce((sum, p) => sum + p.executionMs, 0))
  const recogs = windowed.map(s => s.phases.reduce((sum, p) => sum + p.recognitionMs, 0))
  const totals = execs.map((e, i) => e + recogs[i])
  return windowed.map((s, i) => ({
    xIndex: i + 1,
    exec: execs[i],
    recog: recogs[i],
    total: totals[i],
    execAo5: rollingAo(execs, i, 5),
    execAo12: rollingAo(execs, i, 12),
    recogAo5: rollingAo(recogs, i, 5),
    recogAo12: rollingAo(recogs, i, 12),
    totalAo5: rollingAo(totals, i, 5),
    totalAo12: rollingAo(totals, i, 12),
    solveId: s.id,
  }))
}

export function buildPhaseData(
  windowed: SolveRecord[],
  timeType: 'exec' | 'recog' | 'total',
  grouped: boolean,
): PhaseDataPoint[] {
  return windowed.map((s, i) => {
    const point: PhaseDataPoint = { xIndex: i + 1, solveId: s.id }
    for (const phase of s.phases) {
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

- [ ] **Step 4: Update all existing tests in `tests/utils/trends.test.ts` to use the new API**

Replace the entire test file content with the updated version below. Every `buildTotalData(solves, window)` call becomes `buildTotalData(sortAndSliceWindow(solves, window, 'seq'))`. Every `buildPhaseData(solves, window, type, grouped)` becomes `buildPhaseData(sortAndSliceWindow(solves, window, 'seq'), type, grouped)`. Every `.seq` assertion on a data point becomes `.xIndex`.

```ts
import { describe, it, expect } from 'vitest'
import { buildTotalData, buildPhaseData, sortAndSliceWindow } from '../../src/utils/trends'
import type { SolveRecord, PhaseRecord } from '../../src/types/solve'

// ─── helpers ────────────────────────────────────────────────────────────────

function makePhase(
  label: string,
  execMs: number,
  recogMs: number,
  group?: string,
): PhaseRecord {
  return { label, group, executionMs: execMs, recognitionMs: recogMs, turns: 0 }
}

function makeSolve(
  id: number,
  phases: PhaseRecord[],
  opts: { method?: string; isExample?: boolean; date?: number } = {},
): SolveRecord {
  return {
    id,
    seq: id,
    scramble: '',
    timeMs: phases.reduce((s, p) => s + p.executionMs + p.recognitionMs, 0),
    moves: [],
    phases,
    date: opts.date ?? 0,
    method: opts.method ?? 'cfop',
    isExample: opts.isExample,
  }
}

// ─── buildTotalData ──────────────────────────────────────────────────────────

describe('buildTotalData', () => {
  it('returns one entry per solve with exec = sum(executionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
      makeSolve(2, [makePhase('Cross', 1200, 600), makePhase('F2L', 2800, 300)]),
    ]
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(4000)  // 1000 + 3000
    expect(result[1].exec).toBe(4000)  // 1200 + 2800
  })

  it('returns recog = sum(recognitionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result[0].recog).toBe(900)  // 500 + 400
  })

  it('returns total = exec + recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result[0].total).toBe(4900)  // 4000 + 900
  })

  it('assigns sequential xIndex numbers starting from 1', () => {
    const solves = [makeSolve(10, [makePhase('A', 1000, 0)]), makeSolve(11, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result[0].xIndex).toBe(1)
    expect(result[1].xIndex).toBe(2)
  })

  it('stores the solve id in solveId', () => {
    const solves = [makeSolve(42, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result[0].solveId).toBe(42)
  })

  it('slices to last N solves when window is a number', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(sortAndSliceWindow(solves, 2, 'seq'))
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
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
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
    const result = buildTotalData(sortAndSliceWindow(solves, 2, 'seq'))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(3000)
    expect(result[1].exec).toBe(4000)
  })

  it('execAo5 is null when fewer than 5 solves are in the window', () => {
    const solves = Array.from({ length: 4 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result.every(p => p.execAo5 === null)).toBe(true)
  })

  it('execAo5 is computed (trimmed mean) once 5+ solves available', () => {
    // exec values: 1000, 2000, 3000, 4000, 5000 → trim 1000 and 5000 → mean(2000,3000,4000) = 3000
    const values = [1000, 2000, 3000, 4000, 5000]
    const solves = values.map((v, i) => makeSolve(i + 1, [makePhase('A', v, 0)]))
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result[4].execAo5).toBeCloseTo(3000)
  })

  it('execAo12 is null when fewer than 12 solves', () => {
    const solves = Array.from({ length: 11 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result.every(p => p.execAo12 === null)).toBe(true)
  })

  it('execAo12 is non-null once 12+ solves available', () => {
    const solves = Array.from({ length: 12 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000 * (i + 1), 0)])
    )
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    expect(result[11].execAo12).not.toBeNull()
  })

  it('ao5/ao12 are computed independently per type', () => {
    // exec=2000, recog=9999 for all 5 solves
    const solves = Array.from({ length: 5 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 2000, 9999)])
    )
    const result = buildTotalData(sortAndSliceWindow(solves, 'all', 'seq'))
    // execAo5 of five 2000s → 2000
    expect(result[4].execAo5).toBeCloseTo(2000)
    // recogAo5 of five 9999s → 9999
    expect(result[4].recogAo5).toBeCloseTo(9999)
    // totalAo5 of five 11999s → 11999
    expect(result[4].totalAo5).toBeCloseTo(11999)
  })

  it('date-sorted input: xIndex reflects position in date order, not seq order', () => {
    // Imported solve: high seq (3), old date (1000ms). Native solves: seq 1 and 2, newer dates.
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),  // oldest by date
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),  // newest by date
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
    ]
    const windowed = sortAndSliceWindow(solves, 'all', 'date')
    const result = buildTotalData(windowed)
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
    // Assign reverse seq order so seq-sort would give a different result
    const solves = [
      makeSolve(5, [makePhase('A', 1000, 0)], { date: 100 }),
      makeSolve(4, [makePhase('A', 2000, 0)], { date: 200 }),
      makeSolve(3, [makePhase('A', 3000, 0)], { date: 300 }),
      makeSolve(2, [makePhase('A', 4000, 0)], { date: 400 }),
      makeSolve(1, [makePhase('A', 5000, 0)], { date: 500 }),
    ]
    const windowed = sortAndSliceWindow(solves, 'all', 'date')
    const result = buildTotalData(windowed)
    // Date-ordered execs: [1000, 2000, 3000, 4000, 5000]
    // Ao5 at index 4 = trimmed mean([1000,2000,3000,4000,5000]) = mean(2000,3000,4000) = 3000
    expect(result[4].execAo5).toBeCloseTo(3000)
  })
})

// ─── buildPhaseData ──────────────────────────────────────────────────────────

describe('buildPhaseData', () => {
  it('ungrouped: uses phase labels as keys', () => {
    const solves = [
      makeSolve(1, [
        makePhase('Cross', 1000, 0),
        makePhase('F2L Slot 1', 2000, 0, 'F2L'),
      ]),
    ]
    const result = buildPhaseData(sortAndSliceWindow(solves, 'all', 'seq'), 'exec', false)
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
    const result = buildPhaseData(sortAndSliceWindow(solves, 'all', 'seq'), 'exec', true)
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
    const result = buildPhaseData(sortAndSliceWindow(solves, 'all', 'seq'), 'exec', true)
    expect(result[0]['Cross']).toBe(800)
    expect(result[0]['OLL']).toBe(1200)
  })

  it('uses recognitionMs when timeType is recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500)]),
    ]
    const result = buildPhaseData(sortAndSliceWindow(solves, 'all', 'seq'), 'recog', false)
    expect(result[0]['Cross']).toBe(500)
  })

  it('uses exec+recog when timeType is total', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 2000, 300)]),
    ]
    const result = buildPhaseData(sortAndSliceWindow(solves, 'all', 'seq'), 'total', false)
    expect(result[0]['Cross']).toBe(1500)  // 1000 + 500
    expect(result[0]['F2L']).toBe(2300)    // 2000 + 300
  })

  it('slices to last N non-example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildPhaseData(sortAndSliceWindow(solves, 2, 'seq'), 'exec', false)
    expect(result).toHaveLength(2)
    expect(result[0]['A']).toBe(2000)
  })

  it('excludes example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    const result = buildPhaseData(sortAndSliceWindow(solves, 'all', 'seq'), 'exec', false)
    expect(result).toHaveLength(1)
    expect(result[0]['A']).toBe(2000)
  })

  it('includes xIndex (1-indexed) and solveId', () => {
    const solves = [makeSolve(99, [makePhase('A', 1000, 0)])]
    const result = buildPhaseData(sortAndSliceWindow(solves, 'all', 'seq'), 'exec', false)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(99)
  })

  it('date-sorted input: xIndex reflects date order position', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
    ]
    const windowed = sortAndSliceWindow(solves, 'all', 'date')
    const result = buildPhaseData(windowed, 'exec', false)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(3)  // seq=3 but date=1000 (oldest) → xIndex=1
    expect(result[2].xIndex).toBe(3)
    expect(result[2].solveId).toBe(1)  // seq=1 but date=3000 (newest) → xIndex=3
  })
})

// ─── sortAndSliceWindow ──────────────────────────────────────────────────────

describe('sortAndSliceWindow', () => {
  it('seq mode: returns solves ordered by solve seq', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 'all', 'seq')
    expect(result.map(s => s.seq)).toEqual([1, 2, 3])
  })

  it('date mode: returns solves ordered by date even when seq disagrees', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 'all', 'date')
    expect(result.map(s => s.date)).toEqual([1000, 2000, 3000])
  })

  it('excludes example solves in both modes', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    expect(sortAndSliceWindow(solves, 'all', 'seq')).toHaveLength(1)
    expect(sortAndSliceWindow(solves, 'all', 'date')).toHaveLength(1)
  })

  it('seq mode: window slices the last N after sorting by seq', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = sortAndSliceWindow(solves, 2, 'seq')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.seq)).toEqual([2, 3])
  })

  it('date mode: window slices the last N after sorting by date', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 2, 'date')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.date)).toEqual([2000, 3000])
  })
})
```

- [ ] **Step 5: Run tests to confirm all pass**

```bash
npm run test -- tests/utils/trends.test.ts
```

Expected: all tests pass. If TypeScript errors appear in TrendsModal or elsewhere referencing `seq` on the data-point types, they're expected and will be fixed in Task 4.

- [ ] **Step 6: Verify the build still compiles**

```bash
npm run build 2>&1 | grep -E "error|warning" | head -30
```

Note: TypeScript errors in `TrendsModal.tsx` (referencing `pt.seq`, `d.seq`, etc.) are expected and will be resolved in Task 4.

- [ ] **Step 7: Commit**

```bash
git add src/utils/trends.ts tests/utils/trends.test.ts
git commit -m "refactor: buildTotalData/buildPhaseData accept pre-windowed array; rename seq→xIndex on data points"
```

---

## Task 3: Add `sortMode` to `useHashRouter` (TDD)

**Files:**
- Modify: `src/hooks/useHashRouter.ts`
- Modify: `tests/hooks/useHashRouter.test.ts`

- [ ] **Step 1: Write failing tests for `sortMode` parsing**

Add these three tests inside the `describe('parseHash', ...)` block in `tests/hooks/useHashRouter.test.ts`, after the `'parses #trends with no params'` test:

```ts
it('parses sort=date as sortMode date', () => {
  const route = parseHash('#trends?sort=date')
  expect(route.type).toBe('trends')
  if (route.type !== 'trends') return
  expect(route.params.sortMode).toBe('date')
})

it('defaults sortMode to seq when sort param is missing', () => {
  const route = parseHash('#trends')
  expect(route.type).toBe('trends')
  if (route.type !== 'trends') return
  expect(route.params.sortMode).toBe('seq')
})

it('defaults sortMode to seq for unrecognized sort values', () => {
  const route = parseHash('#trends?sort=random')
  expect(route.type).toBe('trends')
  if (route.type !== 'trends') return
  expect(route.params.sortMode).toBe('seq')
})
```

Also update the `'parses #trends with all params'` test to include `sort=date` in the URL and assert `sortMode`:

```ts
it('parses #trends with all params', () => {
  const route = parseHash('#trends?tab=phases&window=50&group=split&ttotal=exec,recog&tphase=total&method=cfop&driver=cube&sort=date')
  expect(route.type).toBe('trends')
  if (route.type !== 'trends') return
  expect(route.params.tab).toBe('phases')
  expect(route.params.windowSize).toBe(50)
  expect(route.params.grouped).toBe(false)
  expect(route.params.totalToggle).toEqual({ exec: true, recog: true, total: false })
  expect(route.params.phaseToggle).toEqual({ exec: false, recog: false, total: true })
  expect(route.params.method).toBe('cfop')
  expect(route.params.driver).toBe('cube')
  expect(route.params.sortMode).toBe('date')
})
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npm run test -- tests/hooks/useHashRouter.test.ts
```

Expected: the three new `sortMode` tests fail (`undefined !== 'date'` / `undefined !== 'seq'`).

- [ ] **Step 3: Update `src/hooks/useHashRouter.ts`**

Add the import for `SortMode` at the top of the file:

```ts
import type { SortMode } from '../utils/trends'
```

Update the `TrendsHashParams` interface to add `sortMode`:

```ts
export interface TrendsHashParams {
  tab: 'total' | 'phases'
  windowSize: 25 | 50 | 100 | 'all' | null
  grouped: boolean
  totalToggle: { exec: boolean; recog: boolean; total: boolean }
  phaseToggle: { exec: boolean; recog: boolean; total: boolean }
  method: 'all' | 'cfop' | 'roux' | 'freeform' | null
  driver: 'all' | 'cube' | 'mouse' | null
  sortMode: SortMode
}
```

Update `parseTrendsParams` — add the `sortMode` line before the `return` statement:

```ts
function parseTrendsParams(hash: string): TrendsHashParams {
  const search = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(search)
  const tab: 'total' | 'phases' = params.get('tab') === 'phases' ? 'phases' : 'total'
  const w = params.get('window')
  const windowSize: 25 | 50 | 100 | 'all' | null =
    w === 'all' ? 'all' : w === '50' ? 50 : w === '100' ? 100 : w === '25' ? 25 : null
  const grouped = params.get('group') !== 'split'
  const totalToggle = parseTimeToggle(params.get('ttotal'))
  const ptRaw = params.get('tphase') ?? 'total'
  const ptSet = new Set(ptRaw.split(','))
  const phaseToggle = { exec: ptSet.has('exec'), recog: ptSet.has('recog'), total: ptSet.has('total') }
  if (!phaseToggle.exec && !phaseToggle.recog && !phaseToggle.total) phaseToggle.total = true
  const methodRaw = params.get('method')
  const method = (['all', 'cfop', 'roux', 'freeform'] as const).includes(methodRaw as 'all')
    ? (methodRaw as 'all' | 'cfop' | 'roux' | 'freeform')
    : null
  const driverRaw = params.get('driver')
  const driver = (['all', 'cube', 'mouse'] as const).includes(driverRaw as 'all')
    ? (driverRaw as 'all' | 'cube' | 'mouse')
    : null
  const sortMode: SortMode = params.get('sort') === 'date' ? 'date' : 'seq'
  return { tab, windowSize, grouped, totalToggle, phaseToggle, method, driver, sortMode }
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm run test -- tests/hooks/useHashRouter.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHashRouter.ts tests/hooks/useHashRouter.test.ts
git commit -m "feat: add sortMode to TrendsHashParams and parseTrendsParams"
```

---

## Task 4: Update `TrendsModal.tsx` to consume new API and add Sort UI

**Files:**
- Modify: `src/components/TrendsModal.tsx`

This task has no automated tests (consistent with the existing pattern for Method/Driver dropdowns). Verification is via `npm run build`.

- [ ] **Step 1: Update imports**

Replace line 17–18:

```ts
import { buildTotalData, buildPhaseData } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint } from '../utils/trends'
```

with:

```ts
import { buildTotalData, buildPhaseData, sortAndSliceWindow } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint, SortMode } from '../utils/trends'
```

- [ ] **Step 2: Update `buildMergedPhaseData` — new signature and `xIndex`**

Replace the entire `buildMergedPhaseData` function (lines 148–168):

```ts
function buildMergedPhaseData(
  windowed: SolveRecord[],
  phaseToggle: TimeToggle,
  grouped: boolean,
): PhaseDataPoint[] {
  const activeTypes = (Object.keys(phaseToggle) as TimeKey[]).filter(k => phaseToggle[k])
  if (activeTypes.length === 0) return []
  const datasets = activeTypes.map(type => buildPhaseData(windowed, type, grouped))
  return datasets[0].map((pt, i) => {
    const merged: PhaseDataPoint = { xIndex: pt.xIndex, solveId: pt.solveId }
    activeTypes.forEach((type, j) => {
      const typePt = datasets[j][i]
      Object.entries(typePt).forEach(([key, val]) => {
        if (key === 'xIndex' || key === 'solveId') return
        merged[`${key}_${type}`] = val as number
      })
    })
    return merged
  })
}
```

- [ ] **Step 3: Update `buildDayLines` — parameter type and internal references**

Replace the `buildDayLines` function (lines 184–215):

```ts
function buildDayLines(
  visibleData: Array<{ xIndex: number; solveId: number }>,
  solveMap: Map<number, SolveRecord>,
): Array<{ x: number; label: string }> {
  if (visibleData.length === 0) return []

  const startOfDay = (ts: number) => {
    const d = new Date(ts)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }

  const lines: Array<{ x: number; label: string }> = []
  const firstSolve = solveMap.get(visibleData[0].solveId)
  if (!firstSolve) return []

  lines.push({ x: visibleData[0].xIndex - 0.5, label: formatMonthDay(firstSolve.date) })

  let prevDay = startOfDay(firstSolve.date)
  for (let i = 1; i < visibleData.length; i++) {
    const solve = solveMap.get(visibleData[i].solveId)
    if (!solve) continue
    const day = startOfDay(solve.date)
    if (day !== prevDay) {
      lines.push({ x: visibleData[i].xIndex - 0.5, label: formatMonthDay(solve.date) })
      prevDay = day
    }
  }

  return lines
}
```

- [ ] **Step 4: Update tooltip fallbacks — `solve?.seq ?? d.seq` and `solve?.seq ?? pt.seq`**

In `TotalTooltip` (around line 268), change:

```tsx
<div>Solve #{solve?.seq ?? d.seq}</div>
```

to:

```tsx
<div>Solve #{solve?.seq ?? '?'}</div>
```

In `PhaseTooltip` (around line 299), change:

```tsx
<div>Solve #{solve?.seq ?? pt.seq}</div>
```

to:

```tsx
<div>Solve #{solve?.seq ?? '?'}</div>
```

- [ ] **Step 5: Add `sortMode` state and compute `windowed` once per render**

In the state declarations section (around line 322), add after `const [zoomStack, ...]`:

```ts
const [sortMode, setSortMode] = useState<SortMode>(initialParams.sortMode)
```

Replace the two `buildTotalData`/`buildMergedPhaseData` calls (lines 339–340):

```ts
const totalData = buildTotalData(filtered, windowSize)
const phaseData = buildMergedPhaseData(filtered, windowSize, phaseToggle, grouped)
```

with:

```ts
const windowed = sortAndSliceWindow(filtered, windowSize, sortMode)
const totalData = buildTotalData(windowed)
const phaseData = buildMergedPhaseData(windowed, phaseToggle, grouped)
```

- [ ] **Step 6: Update `visibleTotalData` / `visiblePhaseData` domain filters**

Replace the four filter lines (lines 342–347):

```ts
const visibleTotalData = currentDomain
  ? totalData.filter(pt => pt.seq >= currentDomain[0] && pt.seq <= currentDomain[1])
  : totalData
const visiblePhaseData = currentDomain
  ? phaseData.filter(pt => (pt.seq as number) >= currentDomain[0] && (pt.seq as number) <= currentDomain[1])
  : phaseData
```

with:

```ts
const visibleTotalData = currentDomain
  ? totalData.filter(pt => pt.xIndex >= currentDomain[0] && pt.xIndex <= currentDomain[1])
  : totalData
const visiblePhaseData = currentDomain
  ? phaseData.filter(pt => (pt.xIndex as number) >= currentDomain[0] && (pt.xIndex as number) <= currentDomain[1])
  : phaseData
```

- [ ] **Step 7: Update `visibleSeqData`, `firstVisIndex`/`lastVisIndex`**

Replace lines 351–357:

```ts
const visibleSeqData = tab === 'total'
  ? visibleTotalData
  : visiblePhaseData.map(pt => ({ seq: pt.seq as number, solveId: pt.solveId as number }))
const dayLines = buildDayLines(visibleSeqData, solveMap)

const firstVisSeq = visibleSeqData[0]?.seq ?? 1
const lastVisSeq = visibleSeqData[visibleSeqData.length - 1]?.seq ?? firstVisSeq
```

with:

```ts
const visibleSeqData = tab === 'total'
  ? visibleTotalData
  : visiblePhaseData.map(pt => ({ xIndex: pt.xIndex as number, solveId: pt.solveId as number }))
const dayLines = buildDayLines(visibleSeqData, solveMap)

const firstVisIndex = visibleSeqData[0]?.xIndex ?? 1
const lastVisIndex = visibleSeqData[visibleSeqData.length - 1]?.xIndex ?? firstVisIndex
```

- [ ] **Step 8: Update `phaseKeys` filter**

In the `phaseKeys` computation (around lines 360–365), change:

```ts
Object.keys(pt).forEach(k => { if (k !== 'seq' && k !== 'solveId') set.add(k) })
```

to:

```ts
Object.keys(pt).forEach(k => { if (k !== 'xIndex' && k !== 'solveId') set.add(k) })
```

- [ ] **Step 9: Update `xAxisProps`**

Replace the `xAxisProps` object (lines 479–486):

```ts
const xAxisProps = {
  dataKey: 'seq' as const,
  type: 'number' as const,
  domain: [firstVisSeq - 0.5, lastVisSeq + 0.5] as [number, number],
  allowDecimals: false,
  stroke: '#555',
  tick: { fill: '#555', fontSize: 11 },
}
```

with:

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

- [ ] **Step 10: Add `sortMode` to the zoom-reset effect dependency array**

Replace lines 368–372:

```ts
useEffect(() => {
  setZoomStack([])
  setRefAreaLeft(null)
  setRefAreaRight(null)
}, [windowSize])
```

with:

```ts
useEffect(() => {
  setZoomStack([])
  setRefAreaLeft(null)
  setRefAreaRight(null)
}, [windowSize, sortMode])
```

- [ ] **Step 11: Add `sort: sortMode` to URL sync effect**

In the URL sync effect (around lines 375–395), add `sort: sortMode` to the `URLSearchParams` constructor call:

```ts
const params = new URLSearchParams({
  method: solveFilter.method,
  driver: solveFilter.driver,
  tab,
  window: String(windowSize),
  group: grouped ? 'grouped' : 'split',
  sort: sortMode,
  ttotal: activeTotalTypes,
  tphase: activePhaseTypes,
})
```

Also add `sortMode` to the effect's dependency array (the last line of the effect):

```ts
}, [solveFilter.method, solveFilter.driver, tab, windowSize, sortMode, grouped, totalToggle, phaseToggle, detailOpen])
```

- [ ] **Step 12: Add Sort dropdown to the header**

After the closing `</div>` of the Driver dropdown cluster (after line 562), add:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
  <span style={{ color: '#555', fontSize: 11 }}>Sort</span>
  <select
    value={sortMode}
    onChange={e => setSortMode(e.target.value as SortMode)}
    style={{
      background: 'transparent',
      border: '1px solid #333',
      color: '#888',
      fontSize: 12,
      padding: '1px 4px',
      borderRadius: 3,
      cursor: 'pointer',
    }}
  >
    <option value="seq">Seq</option>
    <option value="date">Date</option>
  </select>
</div>
```

The Driver dropdown ends around line 562 with `</div>`. The Sort dropdown goes immediately after that, still inside the outer `<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>`.

- [ ] **Step 13: Run build to verify no TypeScript errors**

```bash
npm run build 2>&1
```

Expected: build succeeds with no errors.

- [ ] **Step 14: Run tests to confirm nothing regressed**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 15: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: Trends sort-by-timestamp toggle — Sort dropdown, sortMode state, URL param"
```

---

## Task 5: Update docs

**Files:**
- Modify: `docs/url-routes.md`
- Modify: `docs/ui-architecture.md`
- Modify: `docs/manual-test-checklist.md`

- [ ] **Step 1: Add `sort` param to Trends table in `docs/url-routes.md`**

In the `### #trends?{params}` section, add a row after the `driver` row in the params table:

```markdown
| `sort` | `seq` \| `date` | Sort order: by solve sequence (default) or by completion date |
```

Also update the Example line to include `sort=seq`:

```markdown
**Example:** `#trends?method=cfop&driver=cube&tab=total&window=50&group=grouped&sort=seq&ttotal=total&tphase=total`
```

- [ ] **Step 2: Add `sortMode` to TrendsModal state in `docs/ui-architecture.md`**

Find the `TrendsModal` row in the leaf component prop table (around line 138). Below or alongside it, add to the state column:

In the text around TrendsModal's description, locate where TrendsModal is described. Add a note that TrendsModal owns `sortMode: SortMode` state (initialized from `initialParams.sortMode`).

Specifically, find the line:
```
| `TrendsModal` | `solves`, `solveFilter`, `updateSolveFilter`, `onSelectSolve`, `onClose` | — |
```

Update it to:
```
| `TrendsModal` | `solves`, `solveFilter`, `updateSolveFilter`, `onSelectSolve`, `onClose`, `initialParams` | — |
```

And in the Shared Hooks or nearby section, add a note that TrendsModal owns local state including `sortMode: SortMode` (URL-synced, not persisted across sessions).

- [ ] **Step 3: Add sort-toggle QA line to `docs/manual-test-checklist.md`**

Find the Trends section in `docs/manual-test-checklist.md` and add:

```markdown
- [ ] **Trends sort toggle:** After an acubemy import, open Trends and toggle Sort between Seq and Date. In Date mode, day-boundary labels should be monotonically increasing. Changing Sort should clear any active zoom.
```

- [ ] **Step 4: Commit docs**

```bash
git add docs/url-routes.md docs/ui-architecture.md docs/manual-test-checklist.md
git commit -m "docs: add sort=seq|date param, sortMode state, and sort-toggle QA entry"
```

---

## Self-Review Checklist

### Spec coverage

| Spec section | Covered by |
|---|---|
| §2 `SortMode` type + `sortAndSliceWindow` | Task 1 |
| §2 `buildTotalData`/`buildPhaseData` accept pre-windowed array | Task 2 |
| §2 `seq`→`xIndex` rename on data points | Task 2 |
| §2 Downstream `xAxisProps`, domain filters, day lines, tooltips | Task 4 |
| §3 `sortMode` in `TrendsHashParams`, `parseTrendsParams` | Task 3 |
| §3 URL sync effect: write `sort` param, add `sortMode` dep | Task 4 |
| §3 `TrendsModal` initializes `sortMode` from `initialParams` | Task 4 |
| §4 Sort dropdown (after Driver) | Task 4 |
| §5 Zoom clears on `sortMode` change | Task 4 |
| §6 Day-boundary and tooltips — no code change needed | n/a (spec §6 explicitly says no change needed) |
| §7 Unit tests for `sortAndSliceWindow` | Task 1 |
| §7 Unit tests for `buildTotalData`/`buildPhaseData` date-sort | Task 2 |
| §7 Router tests for `parseTrendsParams` `sortMode` | Task 3 |
| §7 Manual QA entry | Task 5 |
| §8 `docs/url-routes.md` | Task 5 |
| §8 `docs/ui-architecture.md` | Task 5 |
| §8 `docs/manual-test-checklist.md` | Task 5 |

### Placeholder scan

No TBDs, no "implement later", no "similar to Task N" references. Every code block is complete and runnable.

### Type consistency

- `sortAndSliceWindow` used in Tasks 1, 2, 3 (router doesn't call it), 4 — consistent signature `(solves, window, sortMode)` throughout.
- `buildTotalData(windowed)` — 1-arg form used consistently in Tasks 2 and 4.
- `buildPhaseData(windowed, timeType, grouped)` — 3-arg form consistent in Tasks 2 and 4.
- `buildMergedPhaseData(windowed, phaseToggle, grouped)` — 3-arg form in Task 4 matches the updated definition.
- `xIndex` used everywhere data point fields are accessed in Task 4; `firstVisIndex`/`lastVisIndex` are new names replacing `firstVisSeq`/`lastVisSeq` — used consistently in Step 7 (visibleSeqData) and Step 9 (xAxisProps domain).
- `SortMode` imported from `trends.ts` in both `useHashRouter.ts` (Task 3) and `TrendsModal.tsx` (Task 4).

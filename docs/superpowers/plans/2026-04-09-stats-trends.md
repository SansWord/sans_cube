# Stats Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen Trends modal with line/scatter charts of solve times and phase breakdowns, accessible from the sidebar, with bidirectional method filter sync and a fix for the URL-restore cloud timing bug.

**Architecture:** `methodFilter` is lifted from `SolveHistorySidebar` to `TimerScreen` so both the sidebar and `TrendsModal` share it. A new `src/utils/trends.ts` provides pure data-transform functions (fully unit-tested). `TrendsModal` is a fixed overlay that sits below `SolveDetailModal` and manages its own URL hash while open.

**Tech Stack:** React 19 + TypeScript, Recharts (`npm install recharts`), Vitest for unit tests.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/utils/trends.ts` | Pure functions: `buildTotalData`, `buildPhaseData`, rolling Ao helper |
| Create | `src/components/TrendsModal.tsx` | Full-screen modal: tabs, controls, Recharts charts |
| Create | `tests/utils/trends.test.ts` | Unit tests for trends utility functions |
| Modify | `src/types/solve.ts` | Add `export type MethodFilter = 'all' \| 'cfop' \| 'roux'` |
| Modify | `src/components/SolveHistorySidebar.tsx` | Accept `methodFilter`/`setMethodFilter`/`onOpenTrends` as props; remove local state; add Trends button |
| Modify | `src/components/TimerScreen.tsx` | Lift `methodFilter`; add `showTrends`; fix URL cloud timing; render `TrendsModal` |

---

## Task 1: Install recharts and add MethodFilter type

**Files:**
- Modify: `src/types/solve.ts`
- Modify: `src/components/SolveHistorySidebar.tsx:7`

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

Expected: recharts appears in package.json dependencies, no errors.

- [ ] **Step 2: Add MethodFilter to solve.ts**

Open `src/types/solve.ts`. Add this line at the end of the file (after the `SolveMethod` interface):

```ts
export type MethodFilter = 'all' | 'cfop' | 'roux'
```

- [ ] **Step 3: Update SolveHistorySidebar to import MethodFilter from types**

In `src/components/SolveHistorySidebar.tsx`, replace the local type definition:

Old (line 7):
```ts
type MethodFilter = 'all' | 'cfop' | 'roux'
```

New:
```ts
import type { MethodFilter } from '../types/solve'
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/solve.ts src/components/SolveHistorySidebar.tsx package.json package-lock.json
git commit -m "feat: install recharts, add MethodFilter to shared types"
```

---

## Task 2: Write failing tests for trends.ts

**Files:**
- Create: `tests/utils/trends.test.ts`

- [ ] **Step 1: Create the test file**

Create `tests/utils/trends.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildTotalData, buildPhaseData } from '../../src/utils/trends'
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
  opts: { method?: string; isExample?: boolean } = {},
): SolveRecord {
  return {
    id,
    seq: id,
    scramble: '',
    timeMs: phases.reduce((s, p) => s + p.executionMs + p.recognitionMs, 0),
    moves: [],
    phases,
    date: 0,
    method: opts.method ?? 'cfop',
    isExample: opts.isExample,
  }
}

// ─── buildTotalData ──────────────────────────────────────────────────────────

describe('buildTotalData', () => {
  it('returns one entry per solve with exec value = sum(executionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
      makeSolve(2, [makePhase('Cross', 1200, 600), makePhase('F2L', 2800, 300)]),
    ]
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe(4000)  // 1000 + 3000
    expect(result[1].value).toBe(4000)  // 1200 + 2800
  })

  it('returns recog value = sum(recognitionMs) when timeType is recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(solves, 'all', 'recog')
    expect(result[0].value).toBe(900)  // 500 + 400
  })

  it('assigns sequential seq numbers starting from 1', () => {
    const solves = [makeSolve(10, [makePhase('A', 1000, 0)]), makeSolve(11, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result[0].seq).toBe(1)
    expect(result[1].seq).toBe(2)
  })

  it('stores the solve id in solveId', () => {
    const solves = [makeSolve(42, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result[0].solveId).toBe(42)
  })

  it('slices to last N solves when window is a number', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(solves, 2, 'exec')
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe(2000)
    expect(result[1].value).toBe(3000)
  })

  it('excludes example solves from data and from window count', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe(2000)
  })

  it('excludes example solves when applying window slice', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)], { isExample: true }),
      makeSolve(3, [makePhase('A', 3000, 0)]),
      makeSolve(4, [makePhase('A', 4000, 0)]),
    ]
    // 3 real solves (1, 3, 4), window=2 → last 2 real = solves 3 and 4
    const result = buildTotalData(solves, 2, 'exec')
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe(3000)
    expect(result[1].value).toBe(4000)
  })

  it('ao5 is null when fewer than 5 solves are in the window', () => {
    const solves = Array.from({ length: 4 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result.every(p => p.ao5 === null)).toBe(true)
  })

  it('ao5 is computed from value (trimmed mean) once 5+ solves available', () => {
    // values: 1000, 2000, 3000, 4000, 5000 → trim 1000 and 5000 → mean(2000,3000,4000) = 3000
    const values = [1000, 2000, 3000, 4000, 5000]
    const solves = values.map((v, i) => makeSolve(i + 1, [makePhase('A', v, 0)]))
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result[4].ao5).toBeCloseTo(3000)
  })

  it('ao12 is null when fewer than 12 solves', () => {
    const solves = Array.from({ length: 11 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result.every(p => p.ao12 === null)).toBe(true)
  })

  it('ao12 is non-null once 12+ solves available', () => {
    const solves = Array.from({ length: 12 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000 * (i + 1), 0)])
    )
    const result = buildTotalData(solves, 'all', 'exec')
    expect(result[11].ao12).not.toBeNull()
  })

  it('ao5/ao12 computed from value not from timeMs', () => {
    // exec values all 2000, but timeMs would include recogMs too
    const solves = Array.from({ length: 5 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 2000, 9999)])
    )
    const result = buildTotalData(solves, 'all', 'exec')
    // ao5 of five 2000s: trim best (2000) and worst (2000), mean([2000,2000,2000]) = 2000
    expect(result[4].ao5).toBeCloseTo(2000)
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
    const result = buildPhaseData(solves, 'all', 'exec', false)
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
    const result = buildPhaseData(solves, 'all', 'exec', true)
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
    const result = buildPhaseData(solves, 'all', 'exec', true)
    expect(result[0]['Cross']).toBe(800)
    expect(result[0]['OLL']).toBe(1200)
  })

  it('uses recognitionMs when timeType is recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500)]),
    ]
    const result = buildPhaseData(solves, 'all', 'recog', false)
    expect(result[0]['Cross']).toBe(500)
  })

  it('slices to last N non-example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildPhaseData(solves, 2, 'exec', false)
    expect(result).toHaveLength(2)
    expect(result[0]['A']).toBe(2000)
  })

  it('excludes example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    const result = buildPhaseData(solves, 'all', 'exec', false)
    expect(result).toHaveLength(1)
    expect(result[0]['A']).toBe(2000)
  })

  it('includes seq (1-indexed) and solveId', () => {
    const solves = [makeSolve(99, [makePhase('A', 1000, 0)])]
    const result = buildPhaseData(solves, 'all', 'exec', false)
    expect(result[0].seq).toBe(1)
    expect(result[0].solveId).toBe(99)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test -- tests/utils/trends.test.ts
```

Expected: FAIL — "Cannot find module '../../src/utils/trends'"

- [ ] **Step 3: Commit the test file**

```bash
git add tests/utils/trends.test.ts
git commit -m "test: add failing tests for trends utility functions"
```

---

## Task 3: Implement trends.ts

**Files:**
- Create: `src/utils/trends.ts`

- [ ] **Step 1: Create the utility file**

Create `src/utils/trends.ts`:

```ts
import type { SolveRecord } from '../types/solve'

export interface TotalDataPoint {
  seq: number
  value: number
  ao5: number | null
  ao12: number | null
  solveId: number
}

export interface PhaseDataPoint {
  seq: number
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

function sliceWindow(solves: SolveRecord[], window: number | 'all'): SolveRecord[] {
  const real = solves.filter(s => !s.isExample)
  if (window === 'all') return real
  return real.slice(-window)
}

export function buildTotalData(
  solves: SolveRecord[],
  window: number | 'all',
  timeType: 'exec' | 'recog',
): TotalDataPoint[] {
  const windowed = sliceWindow(solves, window)
  const values = windowed.map(s =>
    s.phases.reduce((sum, p) => sum + (timeType === 'exec' ? p.executionMs : p.recognitionMs), 0)
  )
  return windowed.map((s, i) => ({
    seq: i + 1,
    value: values[i],
    ao5: rollingAo(values, i, 5),
    ao12: rollingAo(values, i, 12),
    solveId: s.id,
  }))
}

export function buildPhaseData(
  solves: SolveRecord[],
  window: number | 'all',
  timeType: 'exec' | 'recog',
  grouped: boolean,
): PhaseDataPoint[] {
  const windowed = sliceWindow(solves, window)
  return windowed.map((s, i) => {
    const point: PhaseDataPoint = { seq: i + 1, solveId: s.id }
    for (const phase of s.phases) {
      const key = grouped && phase.group ? phase.group : phase.label
      const ms = timeType === 'exec' ? phase.executionMs : phase.recognitionMs
      point[key] = ((point[key] as number | null | undefined) ?? 0) + ms
    }
    return point
  })
}
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm run test -- tests/utils/trends.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/trends.ts
git commit -m "feat: implement buildTotalData and buildPhaseData in trends.ts"
```

---

## Task 4: Update SolveHistorySidebar — accept props, add Trends button

**Files:**
- Modify: `src/components/SolveHistorySidebar.tsx`

- [ ] **Step 1: Update the Props interface**

In `src/components/SolveHistorySidebar.tsx`, find the `Props` interface (line 21) and add three new fields:

```ts
interface Props {
  solves: SolveRecord[]
  onSelectSolve: (solve: SolveRecord) => void
  width: number
  onWidthChange: (w: number) => void
  onClose?: () => void
  cloudLoading?: boolean
  methodFilter: MethodFilter
  setMethodFilter: (f: MethodFilter) => void
  onOpenTrends?: () => void
}
```

- [ ] **Step 2: Remove local methodFilter state**

In `SolveHistorySidebar` (line 117), remove:

```ts
const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
```

(It's now a prop.)

- [ ] **Step 3: Update StatsSection to accept and render the Trends button**

Replace the `StatsSection` function signature and its header `<div>`:

Old signature:
```ts
function StatsSection({ solves, methodFilter, onFilterChange, fontSize }: {
  solves: SolveRecord[]
  methodFilter: MethodFilter
  onFilterChange: (f: MethodFilter) => void
  fontSize?: number
}) {
```

New:
```ts
function StatsSection({ solves, methodFilter, onFilterChange, onOpenTrends, fontSize }: {
  solves: SolveRecord[]
  methodFilter: MethodFilter
  onFilterChange: (f: MethodFilter) => void
  onOpenTrends?: () => void
  fontSize?: number
}) {
```

Replace the header `<div>` inside `StatsSection` (the one with "Statistics" label and select):

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
  <span style={{ fontWeight: 'bold', color: '#888' }}>Statistics</span>
  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
    {onOpenTrends && (
      <button
        onClick={onOpenTrends}
        style={{
          background: 'transparent',
          border: '1px solid #333',
          color: '#888',
          fontSize: 11,
          padding: '1px 6px',
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        Trends
      </button>
    )}
    <select
      value={methodFilter}
      onChange={e => onFilterChange(e.target.value as MethodFilter)}
      style={filterSelectStyle}
    >
      <option value="all">All</option>
      <option value="cfop">CFOP</option>
      <option value="roux">Roux</option>
    </select>
  </div>
</div>
```

- [ ] **Step 4: Pass onOpenTrends to StatsSection in overlay mode**

In the overlay mode render path (the `if (onClose)` block), find the `<StatsSection>` call and add `onOpenTrends`:

```tsx
<StatsSection
  solves={solves}
  methodFilter={methodFilter}
  onFilterChange={setMethodFilter}
  onOpenTrends={onOpenTrends}
/>
```

- [ ] **Step 5: Pass onOpenTrends to StatsSection in sidebar mode**

In the sidebar mode render path, find the `<StatsSection>` call and add `onOpenTrends` and `fontSize`:

```tsx
<StatsSection
  solves={solves}
  methodFilter={methodFilter}
  onFilterChange={setMethodFilter}
  onOpenTrends={onOpenTrends}
  fontSize={fontSize}
/>
```

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: TypeScript errors on `TimerScreen.tsx` because it no longer passes the required new props — this is expected. We'll fix that in Task 5.

Actually: since `methodFilter` is now required in `Props`, the build will fail at `TimerScreen`. Pass `--noEmit` is not what `npm run build` does here — it does the full TS check. So instead:

```bash
npm run test
```

Expected: existing tests still pass (trends.test.ts passes, SolveHistorySidebar.test.tsx may fail due to props change).

- [ ] **Step 7: Fix SolveHistorySidebar tests**

Open `tests/components/SolveHistorySidebar.test.tsx`.

The tests that call `userEvent.selectOptions` to change the method filter (e.g. "hides roux solves when CFOP filter is selected") will break because `methodFilter` is now a controlled prop — calling `setMethodFilter` (a mock) won't re-render the component with the new value.

Fix by adding a stateful wrapper and updating `baseProps`:

```tsx
import { useState } from 'react'
import type { MethodFilter } from '../../src/types/solve'

// Add above the describe block:
function SidebarWrapper(props: Omit<React.ComponentProps<typeof SolveHistorySidebar>, 'methodFilter' | 'setMethodFilter'>) {
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
  return <SolveHistorySidebar {...props} methodFilter={methodFilter} setMethodFilter={setMethodFilter} />
}

const baseProps = {
  solves: [],
  onSelectSolve: vi.fn(),
  width: 160,
  onWidthChange: vi.fn(),
}
```

Replace every `render(<SolveHistorySidebar {...baseProps}` call with `render(<SidebarWrapper {...baseProps}`, keeping all other props unchanged. The `SolveHistorySidebar` type needs no changes — the wrapper holds the state, so filter interactions still work end-to-end.

- [ ] **Step 8: Commit**

```bash
git add src/components/SolveHistorySidebar.tsx tests/components/SolveHistorySidebar.test.tsx
git commit -m "feat: SolveHistorySidebar accepts methodFilter as prop, adds Trends button"
```

---

## Task 5: Lift methodFilter to TimerScreen, fix URL cloud timing, add showTrends

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Add new imports**

At the top of `src/components/TimerScreen.tsx`, add to existing imports:

```ts
import type { MethodFilter } from '../types/solve'
```

- [ ] **Step 2: Add new state variables**

After the existing `const [showHistory, setShowHistory] = useState(false)` line (around line 85), add:

```ts
const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
const [showTrends, setShowTrends] = useState(false)
const urlResolvedRef = useRef(false)
```

- [ ] **Step 3: Replace the selectedSolve lazy initializer**

Replace (lines 72–79):

```ts
const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(() => {
  const m = window.location.hash.match(/^#solve-(-?\d+)$/)
  if (m) {
    const id = parseInt(m[1], 10)
    return solves.find((s) => s.id === id) ?? null
  }
  return null
})
```

With:

```ts
const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(null)
```

- [ ] **Step 4: Add URL-resolve useEffect (cloud timing fix)**

Replace the existing `selectedSolve` hash-writing effect (lines 91–97):

```ts
useEffect(() => {
  if (selectedSolve) {
    window.location.hash = `solve-${selectedSolve.id}`
  } else {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}, [selectedSolve])
```

With two separate effects:

```ts
// Resolve URL hash once cloud data is ready (fixes cloud timing bug)
useEffect(() => {
  if (cloudLoading || urlResolvedRef.current) return
  urlResolvedRef.current = true
  const hash = window.location.hash
  if (hash.startsWith('#trends')) {
    setShowTrends(true)
  } else if (hash.startsWith('#solve-')) {
    const id = parseInt(hash.replace('#solve-', ''), 10)
    const solve = solves.find(s => s.id === id)
    if (solve) setSelectedSolve(solve)
  }
}, [cloudLoading, solves])

// Write URL hash for selectedSolve (only when TrendsModal is not open)
useEffect(() => {
  if (showTrends) return  // TrendsModal manages the hash while open
  if (selectedSolve) {
    window.location.hash = `solve-${selectedSolve.id}`
  } else {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}, [selectedSolve, showTrends])
```

- [ ] **Step 5: Pass new props to both SolveHistorySidebar instances**

In the JSX, find the first `<SolveHistorySidebar>` (desktop sidebar, around line 237) and add props:

```tsx
<SolveHistorySidebar
  solves={solves}
  onSelectSolve={setSelectedSolve}
  width={sidebarWidth}
  onWidthChange={setSidebarWidth}
  cloudLoading={cloudLoading}
  methodFilter={methodFilter}
  setMethodFilter={setMethodFilter}
  onOpenTrends={() => setShowTrends(true)}
/>
```

Find the second `<SolveHistorySidebar>` (mobile overlay, inside `{showHistory && ...}`) and add the same new props:

```tsx
<SolveHistorySidebar
  solves={solves}
  onSelectSolve={(s) => setSelectedSolve(s)}
  width={sidebarWidth}
  onWidthChange={setSidebarWidth}
  onClose={() => setShowHistory(false)}
  cloudLoading={cloudLoading}
  methodFilter={methodFilter}
  setMethodFilter={setMethodFilter}
  onOpenTrends={() => { setShowTrends(true); setShowHistory(false) }}
/>
```

- [ ] **Step 6: Verify the build compiles**

```bash
npm run build
```

Expected: TypeScript error that `TrendsModal` doesn't exist yet — that's OK. If the only errors are about the missing import in the next step, proceed. Actually at this point TrendsModal hasn't been added to the JSX yet, so the build should pass.

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: lift methodFilter to TimerScreen, add showTrends state, fix URL cloud timing bug"
```

---

## Task 6: Build TrendsModal

**Files:**
- Create: `src/components/TrendsModal.tsx`

- [ ] **Step 1: Create the component skeleton**

Create `src/components/TrendsModal.tsx` with the full implementation below. Read carefully — it is the complete file:

```tsx
import { useState, useEffect } from 'react'
import {
  ComposedChart,
  LineChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { SolveRecord } from '../types/solve'
import type { MethodFilter } from '../types/solve'
import { getMethod } from '../methods/index'
import { buildTotalData, buildPhaseData } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint } from '../utils/trends'
import { formatSeconds } from '../utils/formatting'

type Tab = 'total' | 'phases'
type WindowSize = 25 | 50 | 100 | 'all'
type TimeType = 'exec' | 'recog'

interface Props {
  solves: SolveRecord[]
  methodFilter: MethodFilter
  setMethodFilter: (f: MethodFilter) => void
  onSelectSolve: (solve: SolveRecord) => void
  onClose: () => void
}

function parseHashParams(): {
  tab: Tab
  windowSize: WindowSize
  grouped: boolean
  timeType: TimeType
} {
  const hash = window.location.hash
  if (!hash.startsWith('#trends')) {
    return { tab: 'total', windowSize: 25, grouped: true, timeType: 'exec' }
  }
  const search = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(search)
  const tab: Tab = params.get('tab') === 'phases' ? 'phases' : 'total'
  const w = params.get('window')
  const windowSize: WindowSize =
    w === 'all' ? 'all' : w === '50' ? 50 : w === '100' ? 100 : 25
  const grouped: boolean = params.get('group') !== 'split'
  const timeType: TimeType = params.get('timetype') === 'recog' ? 'recog' : 'exec'
  return { tab, windowSize, grouped, timeType }
}

function buildColorMap(
  methodFilter: MethodFilter,
  grouped: boolean,
): Record<string, string> {
  const method = getMethod(methodFilter === 'all' ? 'cfop' : methodFilter)
  const map: Record<string, string> = {}
  for (const phase of method.phases) {
    const key = grouped && phase.group ? phase.group : phase.label
    if (!(key in map)) map[key] = phase.color
  }
  return map
}

function filterSolves(solves: SolveRecord[], methodFilter: MethodFilter): SolveRecord[] {
  if (methodFilter === 'all') return solves
  return solves.filter(s => s.isExample || (s.method ?? 'cfop') === methodFilter)
}

const btnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#333' : 'transparent',
  border: '1px solid #333',
  color: active ? '#ccc' : '#555',
  fontSize: 12,
  padding: '2px 8px',
  borderRadius: 3,
  cursor: 'pointer',
})

function TotalTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TotalDataPoint }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '6px 10px', fontSize: 12, color: '#ccc' }}>
      <div>Solve #{d.seq}</div>
      <div>Value: {formatSeconds(d.value)}s</div>
      {d.ao5 !== null && <div style={{ color: '#e94560' }}>Ao5: {formatSeconds(d.ao5)}s</div>}
      {d.ao12 !== null && <div style={{ color: '#3498db' }}>Ao12: {formatSeconds(d.ao12)}s</div>}
      <div style={{ color: '#555', marginTop: 4 }}>▶ tap to replay</div>
    </div>
  )
}

function PhaseTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload: PhaseDataPoint }> }) {
  if (!active || !payload?.length) return null
  const seq = payload[0].payload.seq
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '6px 10px', fontSize: 12, color: '#ccc' }}>
      <div>Solve #{seq}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {formatSeconds(p.value)}s
        </div>
      ))}
      <div style={{ color: '#555', marginTop: 4 }}>▶ tap to replay</div>
    </div>
  )
}

export function TrendsModal({ solves, methodFilter, setMethodFilter, onSelectSolve, onClose }: Props) {
  const isMobile = window.innerWidth < 640
  const parsed = parseHashParams()
  const [tab, setTab] = useState<Tab>(parsed.tab)
  const [windowSize, setWindowSize] = useState<WindowSize>(isMobile ? 25 : parsed.windowSize)
  const [grouped, setGrouped] = useState(parsed.grouped)
  const [timeType, setTimeType] = useState<TimeType>(parsed.timeType)

  const filtered = filterSolves(solves, methodFilter)
  const method = getMethod(methodFilter === 'all' ? 'cfop' : methodFilter)
  const hasGroups = method.phases.some(p => p.group)

  const totalData = buildTotalData(filtered, windowSize, timeType)
  const phaseData = buildPhaseData(filtered, windowSize, timeType, grouped)
  const colorMap = buildColorMap(methodFilter, grouped)

  // Phase keys = all keys in phaseData excluding seq and solveId
  const phaseKeys = phaseData.length > 0
    ? Object.keys(phaseData[0]).filter(k => k !== 'seq' && k !== 'solveId')
    : []

  // Update URL hash whenever filter state changes
  useEffect(() => {
    const params = new URLSearchParams({
      method: methodFilter,
      tab,
      window: String(windowSize),
      group: grouped ? 'grouped' : 'split',
      timetype: timeType,
    })
    window.location.hash = `trends?${params.toString()}`
  }, [methodFilter, tab, windowSize, grouped, timeType])

  const handleDotClick = (data: TotalDataPoint) => {
    const solve = solves.find(s => s.id === data.solveId)
    if (solve) onSelectSolve(solve)
  }

  const handlePhaseLineDotClick = (_: unknown, payload: { payload: PhaseDataPoint }) => {
    const solve = solves.find(s => s.id === payload.payload.solveId)
    if (solve) onSelectSolve(solve)
  }

  const windowOptions: Array<{ label: string; value: WindowSize }> = [
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    ...(!isMobile ? [{ label: 'All', value: 'all' as const }] : []),
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: '#0a0a1a',
      display: 'flex',
      flexDirection: 'column',
      color: '#ccc',
      fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid #222',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 'bold', color: '#888', fontSize: 15 }}>Trends</span>
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value as MethodFilter)}
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
            <option value="all">All</option>
            <option value="cfop">CFOP</option>
            <option value="roux">Roux</option>
          </select>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', color: '#e94560', fontSize: 20, padding: '0 4px', border: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #222',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {/* Tab + window row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setTab('total')} style={btnStyle(tab === 'total')}>Total</button>
            <button onClick={() => setTab('phases')} style={btnStyle(tab === 'phases')}>Phases</button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {windowOptions.map(opt => (
              <button key={opt.label} onClick={() => setWindowSize(opt.value)} style={btnStyle(windowSize === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {/* Time type + group row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setTimeType('exec')} style={btnStyle(timeType === 'exec')}>Exec</button>
            <button onClick={() => setTimeType('recog')} style={btnStyle(timeType === 'recog')}>Recog</button>
          </div>
          {tab === 'phases' && hasGroups && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setGrouped(true)} style={btnStyle(grouped)}>Grp</button>
              <button onClick={() => setGrouped(false)} style={btnStyle(!grouped)}>Split</button>
            </div>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, padding: '16px', minHeight: 0 }}>
        {tab === 'total' ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={totalData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="seq" stroke="#555" tick={{ fill: '#555', fontSize: 11 }} />
              <YAxis
                stroke="#555"
                tick={{ fill: '#555', fontSize: 11 }}
                tickFormatter={v => (v / 1000).toFixed(2)}
              />
              <Tooltip content={<TotalTooltip />} />
              <Scatter
                dataKey="value"
                fill="#555"
                onClick={handleDotClick}
                style={{ cursor: 'pointer' }}
              />
              {totalData.length >= 5 && (
                <Line
                  dataKey="ao5"
                  stroke="#e94560"
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              )}
              {totalData.length >= 12 && (
                <Line
                  dataKey="ao12"
                  stroke="#3498db"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={phaseData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="seq" stroke="#555" tick={{ fill: '#555', fontSize: 11 }} />
              <YAxis
                stroke="#555"
                tick={{ fill: '#555', fontSize: 11 }}
                tickFormatter={v => (v / 1000).toFixed(2)}
              />
              <Tooltip content={<PhaseTooltip />} />
              <Legend wrapperStyle={{ color: '#888', fontSize: 12 }} />
              {phaseKeys.map(key => (
                <Line
                  key={key}
                  dataKey={key}
                  stroke={colorMap[key] ?? '#888'}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                  activeDot={{ r: 5, onClick: handlePhaseLineDotClick, style: { cursor: 'pointer' } }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: exits 0. If there are Recharts type errors on `activeDot`, try casting: `activeDot={{ r: 5, onClick: handlePhaseLineDotClick as never, style: { cursor: 'pointer' } }}`.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: build TrendsModal with Recharts charts, tabs, and controls"
```

---

## Task 7: Wire TrendsModal in TimerScreen and update docs

**Files:**
- Modify: `src/components/TimerScreen.tsx`
- Modify: `docs/ui-architecture.md`

- [ ] **Step 1: Import TrendsModal in TimerScreen**

In `src/components/TimerScreen.tsx`, add to the existing imports:

```ts
import { TrendsModal } from './TrendsModal'
```

- [ ] **Step 2: Render TrendsModal in the JSX**

In the `return (...)` block of `TimerScreen`, add the `TrendsModal` after the `{showHistory && ...}` block and before the `{selectedSolve && ...}` block:

```tsx
{showTrends && (
  <TrendsModal
    solves={solves}
    methodFilter={methodFilter}
    setMethodFilter={setMethodFilter}
    onSelectSolve={setSelectedSolve}
    onClose={() => {
      setShowTrends(false)
      setSelectedSolve(null)
    }}
  />
)}

{selectedSolve && (
  <SolveDetailModal
    solve={selectedSolve}
    onClose={() => setSelectedSolve(null)}
    onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
    onUseScramble={(s) => { loadScramble(s); setSelectedSolve(null) }}
  />
)}
```

- [ ] **Step 3: Verify full build and tests**

```bash
npm run build && npm run test
```

Expected: exits 0, all tests pass.

- [ ] **Step 4: Update docs/ui-architecture.md**

In the Component Tree section, update the `[timer mode]` subtree to include `TrendsModal`:

```
└── [timer mode]
    └── TimerScreen
        ├── SolveHistorySidebar  ← desktop sidebar (always rendered)
        ├── ScrambleDisplay
        ├── TimerDisplay
        ├── CubeCanvas
        ├── MethodSelector
        ├── PhaseBar
        ├── SolveHistorySidebar  ← mobile overlay (rendered when showHistory=true)
        ├── TrendsModal          ← rendered when showTrends=true
        └── SolveDetailModal     ← rendered when a solve is selected (can overlay TrendsModal)
            ├── PhaseBar
            └── CubeCanvas
```

In the Hook Ownership table for `TimerScreen`, add the new state:

```
| `methodFilter` / `setMethodFilter` | Shared MethodFilter state — passed to sidebar and TrendsModal |
| `showTrends` / `setShowTrends` | Controls TrendsModal visibility |
```

In the `SolveHistorySidebar` row of the Leaf/Display Components table, update the Props in column to include `methodFilter`, `setMethodFilter`, `onOpenTrends`.

- [ ] **Step 5: Add TrendsModal section to manual-test-checklist.md**

Append the following to `docs/manual-test-checklist.md`:

```markdown
## Trends Modal

- [ ] Click "Trends" button in the sidebar stats header → TrendsModal opens full-screen
- [ ] Click ✕ → modal closes, returns to main screen
- [ ] Method filter select (All / CFOP / Roux) → filters chart data and syncs with sidebar
- [ ] Total tab: scatter dots visible; Ao5 line appears once 5+ solves in window; Ao12 line appears once 12+ solves
- [ ] Phases tab: one line per phase (or group); lines use correct phase colors
- [ ] Exec/Recog toggle changes plotted values on both tabs
- [ ] Grp/Split toggle (Phases tab only): grouped sums F2L/OLL/PLL into single lines; split shows individual phases
- [ ] Grp/Split toggle hidden when active method has no grouped phases (e.g. Roux FB/SB/CMLL)
- [ ] Window 25/50/100/All slices the data correctly
- [ ] On mobile (< 640px): default window is 25; All option is hidden
- [ ] Click a dot (Total tab) → SolveDetailModal opens on top of TrendsModal
- [ ] Click ✕ on SolveDetailModal → returns to TrendsModal (TrendsModal still visible)
- [ ] Click ✕ on TrendsModal → both modals close
- [ ] URL hash updates to `#trends?method=...&tab=...&window=...&group=...&timetype=...` while modal is open
- [ ] Paste a `#trends?...` URL → modal opens with correct tab/window/group/timetype restored
- [ ] Cloud sync ON: paste a `#trends?...` URL → modal opens after solves load (not blank)
- [ ] Paste a `#solve-N` URL with cloud sync ON → SolveDetailModal opens after solves load
```

- [ ] **Step 6: Final commit**

```bash
git add src/components/TimerScreen.tsx docs/ui-architecture.md docs/manual-test-checklist.md
git commit -m "feat: wire TrendsModal in TimerScreen, update docs"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Trends modal, full-screen, same style as mobile overlay | Task 6 |
| Entry point: "Trends" button in stats section header | Task 4 |
| Recharts | Task 1 |
| Tabs: Total / Phases | Task 6 |
| Total tab: Scatter + Ao5 + Ao12 lines | Task 6 |
| Phases tab: one Line per phase key | Task 6 |
| Time type toggle (Exec / Recog), both tabs | Task 6 |
| Group toggle (Grp / Split), Phases tab only, when method has groups | Task 6 |
| Window toggle 25/50/100/All | Task 6 |
| Method filter synced bidirectionally | Tasks 4, 5, 6 |
| Click dot → SolveDetailModal on top | Task 7 |
| URL encoding: `#trends?method=...` | Task 6 |
| Mobile default window = 25, hide All | Task 6 |
| Cloud timing fix: defer URL-restore until cloudLoading=false | Task 5 |
| `buildTotalData` with exec/recog, window, Ao5/Ao12 | Task 3 |
| `buildPhaseData` with grouped/split, exec/recog, window | Task 3 |
| Unit tests: all listed test cases | Task 2 |
| Exclude example solves from data and Ao calculation | Tasks 2, 3 |
| `docs/ui-architecture.md` updated | Task 7 |

### Placeholder Scan

No TBD, TODO, or "implement later" entries found. All code steps include complete code blocks.

### Type Consistency

- `MethodFilter` defined in `src/types/solve.ts`; imported by `SolveHistorySidebar`, `TimerScreen`, `TrendsModal` — consistent.
- `TotalDataPoint` and `PhaseDataPoint` defined in `src/utils/trends.ts`; imported by `TrendsModal` — consistent.
- `buildTotalData` / `buildPhaseData` signatures used in tests (Task 2) match the implementation (Task 3) — consistent.
- `handlePhaseLineDotClick` receives `payload.payload` which is `PhaseDataPoint` — consistent with `buildPhaseData` return type.

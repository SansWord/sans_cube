# Driver Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a driver filter (`all` / `cube` / `mouse`) alongside the method filter, affecting both sidebar stats and TrendsModal, persisted to localStorage.

**Architecture:** Introduce a unified `SolveFilter` object replacing the standalone `methodFilter` prop throughout the tree. `TimerScreen` owns the state, reads/writes two localStorage keys on mount and change, and passes the filter down. `filterSolves` is updated to apply both legs. Both `SolveHistorySidebar` and `TrendsModal` gain a driver dropdown next to the existing method dropdown.

**Tech Stack:** React 19 + TypeScript, localStorage, Vitest

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/storageKeys.ts` | Add `METHOD_FILTER` and `DRIVER_FILTER` keys |
| `src/types/solve.ts` | Add `DriverFilter` type and `SolveFilter` interface |
| `src/hooks/useSolveHistory.ts` | Update `filterSolves` to accept `SolveFilter` |
| `src/components/TimerScreen.tsx` | Replace `methodFilter` state with `solveFilter` + localStorage persistence |
| `src/components/SolveHistorySidebar.tsx` | Update props, remove `filterStatsPool`, add driver dropdown |
| `src/components/TrendsModal.tsx` | Update props, update filter call, add driver dropdown, extend URL hash |
| `tests/filterSolves.test.ts` | New: tests for updated `filterSolves` |

---

### Task 1: Add storage keys and types

**Files:**
- Modify: `src/utils/storageKeys.ts`
- Modify: `src/types/solve.ts`

- [ ] **Step 1: Add the two new localStorage keys to `src/utils/storageKeys.ts`**

Replace the entire file with:

```ts
export const STORAGE_KEYS = {
  SOLVES: 'sans_cube_solves',
  NEXT_ID: 'sans_cube_next_id',
  DISMISSED_EXAMPLES: 'sans_cube_dismissed_examples',
  ORIENTATION_CONFIG: 'cubeOrientationConfig',
  SIDEBAR_WIDTH: 'sidebarWidth',
  METHOD: 'sans_cube_method',
  METHOD_FILTER: 'sans_cube_method_filter',
  DRIVER_FILTER: 'sans_cube_driver_filter',
  CLOUD_SYNC_ENABLED: 'sans_cube_cloud_sync_enabled',
  ANALYTICS_ACKNOWLEDGED: 'sans_cube_analytics_acknowledged',
} as const
```

- [ ] **Step 2: Add `DriverFilter` and `SolveFilter` to `src/types/solve.ts`**

Append after the existing `MethodFilter` line (currently the last line):

```ts
export type DriverFilter = 'all' | 'cube' | 'mouse'

export interface SolveFilter {
  method: MethodFilter
  driver: DriverFilter
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storageKeys.ts src/types/solve.ts
git commit -m "feat: add DriverFilter, SolveFilter types and storage keys"
```

---

### Task 2: Update `filterSolves` and write tests

**Files:**
- Modify: `src/hooks/useSolveHistory.ts:89-92`
- Create: `tests/filterSolves.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/filterSolves.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filterSolves } from '../src/hooks/useSolveHistory'
import type { SolveRecord, SolveFilter } from '../src/types/solve'

function makeSolve(overrides: Partial<SolveRecord>): SolveRecord {
  return {
    id: 1, seq: 1, scramble: '', timeMs: 10000, moves: [], phases: [], date: 0,
    ...overrides,
  }
}

const cfopCube  = makeSolve({ id: 1, method: 'cfop', driver: 'cube' })
const cfopMouse = makeSolve({ id: 2, method: 'cfop', driver: 'mouse' })
const rouxCube  = makeSolve({ id: 3, method: 'roux', driver: 'cube' })
const example   = makeSolve({ id: 4, method: 'cfop', driver: 'mouse', isExample: true })
const legacy    = makeSolve({ id: 5 }) // no method, no driver

const ALL: SolveRecord[] = [cfopCube, cfopMouse, rouxCube, example, legacy]

describe('filterSolves', () => {
  it('all+all returns every solve', () => {
    const f: SolveFilter = { method: 'all', driver: 'all' }
    expect(filterSolves(ALL, f)).toEqual(ALL)
  })

  it('cfop+all returns cfop solves and examples', () => {
    const f: SolveFilter = { method: 'cfop', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 2, 4, 5]) // legacy defaults to cfop
  })

  it('roux+all returns roux solves and examples', () => {
    const f: SolveFilter = { method: 'roux', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([3, 4])
  })

  it('all+cube returns cube solves and examples', () => {
    const f: SolveFilter = { method: 'all', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 3, 4, 5]) // legacy defaults to cube, example bypasses
  })

  it('all+mouse returns mouse solves and examples', () => {
    const f: SolveFilter = { method: 'all', driver: 'mouse' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([2, 4])
  })

  it('cfop+cube returns cfop+cube solves and examples', () => {
    const f: SolveFilter = { method: 'cfop', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 4, 5]) // legacy: cfop+cube, example bypasses
  })

  it('roux+mouse returns no solves (only example)', () => {
    const f: SolveFilter = { method: 'roux', driver: 'mouse' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([4]) // only example bypasses both
  })

  it('example solves always pass through regardless of both filters', () => {
    const f: SolveFilter = { method: 'roux', driver: 'mouse' }
    const result = filterSolves([example], f)
    expect(result).toEqual([example])
  })

  it('legacy solve (no driver) defaults to cube', () => {
    const f: SolveFilter = { method: 'all', driver: 'cube' }
    expect(filterSolves([legacy], f)).toEqual([legacy])
  })

  it('legacy solve (no driver) excluded by mouse filter', () => {
    const f: SolveFilter = { method: 'all', driver: 'mouse' }
    expect(filterSolves([legacy], f)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- tests/filterSolves.test.ts 2>&1 | tail -20
```

Expected: type errors or test failures because `filterSolves` still takes `MethodFilter`.

- [ ] **Step 3: Update `filterSolves` in `src/hooks/useSolveHistory.ts`**

Change the import at line 3 from:
```ts
import type { SolveRecord, MethodFilter } from '../types/solve'
```
to:
```ts
import type { SolveRecord, SolveFilter } from '../types/solve'
```

Replace lines 89-92:
```ts
export function filterSolves(solves: SolveRecord[], methodFilter: MethodFilter): SolveRecord[] {
  if (methodFilter === 'all') return solves
  return solves.filter(s => s.isExample || (s.method ?? 'cfop') === methodFilter)
}
```
with:
```ts
export function filterSolves(solves: SolveRecord[], filter: SolveFilter): SolveRecord[] {
  let result = solves
  if (filter.method !== 'all')
    result = result.filter(s => s.isExample || (s.method ?? 'cfop') === filter.method)
  if (filter.driver !== 'all')
    result = result.filter(s => s.isExample || (s.driver ?? 'cube') === filter.driver)
  return result
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- tests/filterSolves.test.ts 2>&1 | tail -10
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSolveHistory.ts tests/filterSolves.test.ts
git commit -m "feat: update filterSolves to accept SolveFilter with driver leg"
```

---

### Task 3: Update `TimerScreen` state and persistence

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Update the import at the top of `TimerScreen.tsx`**

Find line 6 (the types import):
```ts
import type { SolveRecord, MethodFilter } from '../types/solve'
```
Replace with:
```ts
import type { SolveRecord, SolveFilter, MethodFilter, DriverFilter } from '../types/solve'
```

- [ ] **Step 2: Add `readSolveFilter` helper and replace `methodFilter` state**

Find line 78:
```ts
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
```

Replace with:
```ts
  const [solveFilter, setSolveFilter] = useState<SolveFilter>(() => {
    const method = (localStorage.getItem(STORAGE_KEYS.METHOD_FILTER) ?? 'all') as MethodFilter
    const driver = (localStorage.getItem(STORAGE_KEYS.DRIVER_FILTER) ?? 'all') as DriverFilter
    return { method, driver }
  })

  function updateSolveFilter(updater: (f: SolveFilter) => SolveFilter) {
    setSolveFilter(prev => {
      const next = updater(prev)
      localStorage.setItem(STORAGE_KEYS.METHOD_FILTER, next.method)
      localStorage.setItem(STORAGE_KEYS.DRIVER_FILTER, next.driver)
      return next
    })
  }
```

- [ ] **Step 3: Update both `SolveHistorySidebar` usages (lines ~277–286 and ~347–358)**

First usage (desktop sidebar, around line 277):
```tsx
<SolveHistorySidebar
  solves={solves}
  onSelectSolve={setSelectedSolve}
  width={sidebarWidth}
  onWidthChange={setSidebarWidth}
  cloudLoading={cloudLoading}
  solveFilter={solveFilter}
  updateSolveFilter={updateSolveFilter}
  onOpenTrends={() => setShowTrends(true)}
/>
```

Second usage (mobile overlay, around line 347):
```tsx
<SolveHistorySidebar
  solves={solves}
  onSelectSolve={(s) => setSelectedSolve(s)}
  width={sidebarWidth}
  onWidthChange={setSidebarWidth}
  onClose={() => setShowHistory(false)}
  cloudLoading={cloudLoading}
  solveFilter={solveFilter}
  updateSolveFilter={updateSolveFilter}
  onOpenTrends={() => { setShowTrends(true); setShowHistory(false) }}
/>
```

- [ ] **Step 4: Update `TrendsModal` usage (around line 361)**

```tsx
<TrendsModal
  solves={solves}
  solveFilter={solveFilter}
  updateSolveFilter={updateSolveFilter}
  onSelectSolve={setSelectedSolve}
  onClose={() => {
    setShowTrends(false)
    setSelectedSolve(null)
```

(Keep the rest of the `onClose` body unchanged.)

- [ ] **Step 5: Verify build (TypeScript will flag prop mismatches as errors)**

```bash
npm run build 2>&1 | grep -E "error TS|SolveHistorySidebar|TrendsModal"
```

Expected: errors about `methodFilter`/`setMethodFilter` not existing on the components — these will be fixed in Tasks 4 and 5.

- [ ] **Step 6: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: replace methodFilter state with SolveFilter in TimerScreen"
```

---

### Task 4: Update `SolveHistorySidebar`

**Files:**
- Modify: `src/components/SolveHistorySidebar.tsx`

- [ ] **Step 1: Update the import**

Line 2, change:
```ts
import type { SolveRecord, MethodFilter } from '../types/solve'
```
to:
```ts
import type { SolveRecord, SolveFilter } from '../types/solve'
```

- [ ] **Step 2: Update the `Props` interface**

Find (around lines 8–18):
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
Replace with:
```ts
interface Props {
  solves: SolveRecord[]
  onSelectSolve: (solve: SolveRecord) => void
  width: number
  onWidthChange: (w: number) => void
  onClose?: () => void
  cloudLoading?: boolean
  solveFilter: SolveFilter
  updateSolveFilter: (updater: (f: SolveFilter) => SolveFilter) => void
  onOpenTrends?: () => void
}
```

- [ ] **Step 3: Delete `filterStatsPool` and update `StatsSection` props**

Delete the `filterStatsPool` function (lines 35–39):
```ts
function filterStatsPool(solves: SolveRecord[], methodFilter: MethodFilter): SolveRecord[] {
  const realSolves = solves.filter(s => !s.isExample)
  if (methodFilter === 'all') return realSolves
  return realSolves.filter(s => (s.method ?? 'cfop') === methodFilter)
}
```

Update the `StatsSection` function signature (around line 51):
```ts
function StatsSection({ solves, methodFilter, onFilterChange, onOpenTrends, cloudLoading, fontSize }: {
  solves: SolveRecord[]
  methodFilter: MethodFilter
  onFilterChange: (f: MethodFilter) => void
  onOpenTrends?: () => void
  cloudLoading?: boolean
  fontSize?: number
})
```
Replace with:
```ts
function StatsSection({ solves, solveFilter, updateSolveFilter, onOpenTrends, cloudLoading, fontSize }: {
  solves: SolveRecord[]
  solveFilter: SolveFilter
  updateSolveFilter: (updater: (f: SolveFilter) => SolveFilter) => void
  onOpenTrends?: () => void
  cloudLoading?: boolean
  fontSize?: number
})
```

- [ ] **Step 4: Update `StatsSection` body — replace `filterStatsPool` call and method dropdown**

Replace:
```ts
  const statsPool = filterStatsPool(solves, methodFilter)
```
with:
```ts
  const statsPool = filterSolves(solves, solveFilter).filter(s => !s.isExample)
```

Replace the method `<select>` (the one with options All/CFOP/Roux, around line 90):
```tsx
          <select
            value={methodFilter}
            onChange={e => onFilterChange(e.target.value as MethodFilter)}
            disabled={cloudLoading}
            style={{
              ...filterSelectStyle,
              cursor: cloudLoading ? 'not-allowed' : 'pointer',
              opacity: cloudLoading ? 0.5 : 1,
            }}
          >
            <option value="all">All</option>
            <option value="cfop">CFOP</option>
            <option value="roux">Roux</option>
          </select>
```
with:
```tsx
          <select
            value={solveFilter.method}
            onChange={e => updateSolveFilter(f => ({ ...f, method: e.target.value as SolveFilter['method'] }))}
            disabled={cloudLoading}
            style={{
              ...filterSelectStyle,
              cursor: cloudLoading ? 'not-allowed' : 'pointer',
              opacity: cloudLoading ? 0.5 : 1,
            }}
          >
            <option value="all">All</option>
            <option value="cfop">CFOP</option>
            <option value="roux">Roux</option>
          </select>
          <select
            value={solveFilter.driver}
            onChange={e => updateSolveFilter(f => ({ ...f, driver: e.target.value as SolveFilter['driver'] }))}
            disabled={cloudLoading}
            style={{
              ...filterSelectStyle,
              cursor: cloudLoading ? 'not-allowed' : 'pointer',
              opacity: cloudLoading ? 0.5 : 1,
            }}
          >
            <option value="all">All</option>
            <option value="cube">Cube</option>
            <option value="mouse">Mouse</option>
          </select>
```

- [ ] **Step 5: Update `SolveHistorySidebar` export — destructure and pass new props**

Find the export function signature (line 157):
```ts
export function SolveHistorySidebar({ solves, onSelectSolve, width, onWidthChange, onClose, cloudLoading, methodFilter, setMethodFilter, onOpenTrends }: Props) {
```
Replace with:
```ts
export function SolveHistorySidebar({ solves, onSelectSolve, width, onWidthChange, onClose, cloudLoading, solveFilter, updateSolveFilter, onOpenTrends }: Props) {
```

Then find the two `filterSolves` call and `StatsSection` usages inside the function body.

The `filterSolves` call (around line 182):
```ts
  const filteredSolves = filterSolves(solves, methodFilter)
```
Replace with:
```ts
  const filteredSolves = filterSolves(solves, solveFilter)
```

The two `StatsSection` usages (lines ~194 and ~253) — both look like:
```tsx
<StatsSection solves={solves} methodFilter={methodFilter} onFilterChange={setMethodFilter} onOpenTrends={onOpenTrends} cloudLoading={cloudLoading} />
```
Replace both with:
```tsx
<StatsSection solves={solves} solveFilter={solveFilter} updateSolveFilter={updateSolveFilter} onOpenTrends={onOpenTrends} cloudLoading={cloudLoading} />
```
(The second one may include `fontSize` — keep that prop if present.)

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep "error TS"
```

Expected: only errors remaining should be in `TrendsModal.tsx` (fixed in Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/components/SolveHistorySidebar.tsx
git commit -m "feat: update SolveHistorySidebar to use SolveFilter with driver dropdown"
```

---

### Task 5: Update `TrendsModal`

**Files:**
- Modify: `src/components/TrendsModal.tsx`

- [ ] **Step 1: Update imports**

Line 15:
```ts
import type { SolveRecord, MethodFilter } from '../types/solve'
```
Replace with:
```ts
import type { SolveRecord, SolveFilter } from '../types/solve'
```

- [ ] **Step 2: Update the `Props` interface (around line 41)**

```ts
interface Props {
  solves: SolveRecord[]
  methodFilter: MethodFilter
  setMethodFilter: (f: MethodFilter) => void
  onSelectSolve: (solve: SolveRecord) => void
  onClose: () => void
  detailOpen?: boolean
}
```
Replace with:
```ts
interface Props {
  solves: SolveRecord[]
  solveFilter: SolveFilter
  updateSolveFilter: (updater: (f: SolveFilter) => SolveFilter) => void
  onSelectSolve: (solve: SolveRecord) => void
  onClose: () => void
  detailOpen?: boolean
}
```

- [ ] **Step 3: Update `buildColorMap` call signature (line 163)**

```ts
function buildColorMap(
  methodFilter: MethodFilter,
  grouped: boolean,
): Record<string, string> {
  if (methodFilter === 'all') {
```
Replace with:
```ts
function buildColorMap(
  method: SolveFilter['method'],
  grouped: boolean,
): Record<string, string> {
  if (method === 'all') {
```

And the return line inside:
```ts
  return buildColorMapForMethod(getMethod(methodFilter), grouped)
```
Replace with:
```ts
  return buildColorMapForMethod(getMethod(method), grouped)
```

- [ ] **Step 4: Update `TrendsModal` component — destructure, state, and derived values**

Line 342:
```ts
export function TrendsModal({ solves, methodFilter, setMethodFilter, onSelectSolve, onClose, detailOpen }: Props) {
```
Replace with:
```ts
export function TrendsModal({ solves, solveFilter, updateSolveFilter, onSelectSolve, onClose, detailOpen }: Props) {
```

Line 362:
```ts
  const filtered = filterSolves(solves, methodFilter)
  const method = getMethod(methodFilter === 'all' ? 'cfop' : methodFilter)
```
Replace with:
```ts
  const filtered = filterSolves(solves, solveFilter)
  const method = getMethod(solveFilter.method === 'all' ? 'cfop' : solveFilter.method)
```

Line 387:
```ts
  const colorMap = buildColorMap(methodFilter, grouped)
```
Replace with:
```ts
  const colorMap = buildColorMap(solveFilter.method, grouped)
```

- [ ] **Step 5: Update the URL hash sync `useEffect`**

Find (around line 403):
```ts
    const params = new URLSearchParams({
      method: methodFilter,
      tab,
      window: String(windowSize),
      group: grouped ? 'grouped' : 'split',
      ttotal: activeTotalTypes,
      tphase: activePhaseTypes,
    })
    window.location.hash = `trends?${params.toString()}`
  }, [methodFilter, tab, windowSize, grouped, totalToggle, phaseToggle])
```
Replace with:
```ts
    const params = new URLSearchParams({
      method: solveFilter.method,
      driver: solveFilter.driver,
      tab,
      window: String(windowSize),
      group: grouped ? 'grouped' : 'split',
      ttotal: activeTotalTypes,
      tphase: activePhaseTypes,
    })
    window.location.hash = `trends?${params.toString()}`
  }, [solveFilter, tab, windowSize, grouped, totalToggle, phaseToggle])
```

- [ ] **Step 6: Update the method dropdown in the modal header (around line 543)**

```tsx
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
```
Replace with:
```tsx
          <select
            value={solveFilter.method}
            onChange={e => updateSolveFilter(f => ({ ...f, method: e.target.value as SolveFilter['method'] }))}
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
          <select
            value={solveFilter.driver}
            onChange={e => updateSolveFilter(f => ({ ...f, driver: e.target.value as SolveFilter['driver'] }))}
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
            <option value="cube">Cube</option>
            <option value="mouse">Mouse</option>
          </select>
```

- [ ] **Step 7: Verify full build passes**

```bash
npm run build 2>&1 | grep "error TS"
```

Expected: no errors.

- [ ] **Step 8: Run all tests**

```bash
npm run test 2>&1 | tail -15
```

Expected: all tests pass including the new `filterSolves` tests.

- [ ] **Step 9: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: update TrendsModal to use SolveFilter with driver dropdown"
```

---

### Task 6: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open in Chrome (required for Web Bluetooth).

- [ ] **Step 2: Check sidebar — method filter**

Set method filter to CFOP. Confirm stats update. Set back to All.

- [ ] **Step 3: Check sidebar — driver filter**

Set driver filter to Mouse. Confirm only mouse solves count in stats (old solves without `driver` field count as Cube). Set to Cube. Set back to All.

- [ ] **Step 4: Check TrendsModal — both dropdowns visible**

Open Trends. Confirm method and driver dropdowns both appear in the header. Toggle each and confirm the chart updates.

- [ ] **Step 5: Check persistence**

Set method to CFOP, driver to Cube. Reload the page. Confirm both dropdowns restore to CFOP and Cube.

- [ ] **Step 6: Check URL hash**

With Trends open, confirm the URL hash includes both `method=cfop` and `driver=cube`.

# Driver Filter Design

**Date:** 2026-04-14  
**Feature:** Filter Trends and sidebar stats by input driver (smart cube vs mouse)

---

## Overview

Add a `driver` filter alongside the existing `method` filter. Both filters affect the sidebar stats section and the TrendsModal chart. The two filters are unified into a single `SolveFilter` object passed through the component tree.

---

## Types (`src/types/solve.ts`)

Add `DriverFilter` and `SolveFilter`:

```ts
export type DriverFilter = 'all' | 'cube' | 'mouse'

export interface SolveFilter {
  method: MethodFilter
  driver: DriverFilter
}
```

`MethodFilter` is unchanged. All filter-passing in the app uses `SolveFilter`.

Default value: `{ method: 'all', driver: 'all' }`.

---

## Filter logic (`src/hooks/useSolveHistory.ts`)

`filterSolves` signature changes from `(solves, methodFilter: MethodFilter)` to `(solves, filter: SolveFilter)`.

Rules:
- `filter.method !== 'all'`: keep solves where `s.isExample` OR `(s.method ?? 'cfop') === filter.method`
- `filter.driver !== 'all'`: keep solves where `s.isExample` OR `(s.driver ?? 'cube') === filter.driver`
- Example solves bypass both filters (same behaviour as the existing method filter)
- Old solves without a `driver` field default to `'cube'`

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

---

## Persistence (`src/components/TimerScreen.tsx`)

Both filter values persist to localStorage so they survive page reloads:

| Key | Type | Values |
|-----|------|--------|
| `sans_cube_method` | `string` | `'all'` \| `'cfop'` \| `'roux'` (already exists) |
| `sans_cube_driver` | `string` | `'all'` \| `'cube'` \| `'mouse'` (new) |

`TimerScreen` reads both keys on mount to initialize `solveFilter`, and writes them on every change:

```ts
function readSolveFilter(): SolveFilter {
  const method = (localStorage.getItem('sans_cube_method') ?? 'all') as MethodFilter
  const driver = (localStorage.getItem('sans_cube_driver') ?? 'all') as DriverFilter
  return { method, driver }
}

const [solveFilter, setSolveFilter] = useState<SolveFilter>(readSolveFilter)
```

On change, the setter also writes to localStorage:

```ts
function updateSolveFilter(updater: (f: SolveFilter) => SolveFilter) {
  setSolveFilter(prev => {
    const next = updater(prev)
    localStorage.setItem('sans_cube_method', next.method)
    localStorage.setItem('sans_cube_driver', next.driver)
    return next
  })
}
```

Pass `solveFilter` and `updateSolveFilter` to `SolveHistorySidebar` and `TrendsModal`. Each component updates only its slice:

```ts
updateSolveFilter(f => ({ ...f, method: newMethod }))
updateSolveFilter(f => ({ ...f, driver: newDriver }))
```

---

## Sidebar (`src/components/SolveHistorySidebar.tsx`)

- `StatsSection` props change: `methodFilter: MethodFilter` + `onFilterChange` → `solveFilter: SolveFilter` + `onFilterChange: (f: SolveFilter) => void`
- `SolveHistorySidebar` outer props update the same way
- Remove local `filterStatsPool` — replace with shared `filterSolves(solves, solveFilter)`
- Add a driver `<select>` next to the method `<select>` in `StatsSection`, same styling:

```
[CFOP ▾]  [Cube ▾]
```

Options: All / Cube / Mouse.

---

## TrendsModal (`src/components/TrendsModal.tsx`)

- Props change: `methodFilter`/`setMethodFilter` → `solveFilter`/`setSolveFilter`
- Replace `filterSolves(solves, methodFilter)` with `filterSolves(solves, solveFilter)`
- Add driver `<select>` next to method `<select>` in modal header:

```
Trends  [CFOP ▾]  [Cube ▾]          ✕
```

- Extend URL hash persistence to include `driver` alongside `method`, so both filters survive a page refresh.

---

## Out of scope

- Date range filtering
- Time range / outlier filtering
- Any changes to the solve list in the sidebar (only stats and Trends are filtered)

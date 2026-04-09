# Method Filter for Statistics & Solve List

**Date:** 2026-04-08  
**Status:** Approved

## Overview

Add a method filter dropdown to `SolveHistorySidebar` so the user can filter statistics and the solve list by solve method: All, CFOP, or Roux.

## Behaviour

### Filter options

| Value  | Label |
|--------|-------|
| `all`  | All   |
| `cfop` | CFOP  |
| `roux` | Roux  |

Default: `all`.

### Statistics table

Stats are always computed from **real solves only** (example solves excluded — this is current behaviour).

| Filter | Solves included in stats         |
|--------|----------------------------------|
| All    | all real solves                  |
| CFOP   | real solves where `(method ?? 'cfop') === 'cfop'` |
| Roux   | real solves where `method === 'roux'` |

### Solve list

Example solves always appear regardless of the selected filter. Real solves are filtered by method.

| Filter | Solves shown in list             |
|--------|----------------------------------|
| All    | all examples + all real solves   |
| CFOP   | all examples + real cfop solves  |
| Roux   | all examples + real roux solves  |

## Architecture

### Where the filter lives

Local `useState` inside `SolveHistorySidebar`. No changes to `TimerScreen`, `useSolveHistory`, or any props interface.

**Why:** The filter is purely a display concern. The sidebar already receives all solves and `computeStats` is already exported from `useSolveHistory.ts`.

### Logic

```ts
type MethodFilter = 'all' | 'cfop' | 'roux'

const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')

// For stats: real solves only, filtered by method
const realSolves = solves.filter(s => !s.isExample)
const statsPool = methodFilter === 'all'
  ? realSolves
  : realSolves.filter(s => (s.method ?? 'cfop') === methodFilter)
const filteredStats = computeStats(statsPool)

// For list: examples always shown, real solves filtered
const filteredSolves = methodFilter === 'all'
  ? solves
  : solves.filter(s => s.isExample || (s.method ?? 'cfop') === methodFilter)
```

### UI

- Dropdown sits inline with the "Statistics" section header, right-aligned.
- Styled to match the dark sidebar theme (transparent background, subtle border).
- Applied in **both** desktop sidebar mode and mobile overlay mode.
- No persistence — resets to `all` on page reload.

### Stats prop

The existing `stats` prop passed from `TimerScreen` is no longer used directly. `SolveHistorySidebar` imports `computeStats` and always derives stats locally from the filtered solve pool. The `stats` prop can be removed from the component's `Props` interface and the call sites in `TimerScreen`.

## Files changed

| File | Change |
|------|--------|
| `src/components/SolveHistorySidebar.tsx` | Add filter state, dropdown UI, filtered stats/list logic, import `computeStats` |
| `src/components/TimerScreen.tsx` | Remove `stats` from the two `SolveHistorySidebar` usages |
| `src/hooks/useSolveHistory.ts` | Remove `stats` from the return value (no longer needed by consumers) |

## Out of scope

- Persisting the filter selection across sessions
- Filtering the active timer method to match the sidebar filter

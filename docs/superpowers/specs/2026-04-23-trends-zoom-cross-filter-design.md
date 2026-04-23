# Trends Zoom Cross-Filter Persistence — Design

**Status:** spec
**Date:** 2026-04-23
**Follow-up to:** v1.29.1 (zoom URL persistence) — addresses the deferred bug recorded in `future.md`

## Problem

In the Trends modal, chart zoom is stored as a `[xIndexStart, xIndexEnd]` pair of positional indices into the current filtered + sorted + windowed data array. When the user changes the method or driver filter while zoomed, the array is recomputed from scratch, so `xIndex` values are renumbered from 1..N of the new filtered set. The saved zoom range no longer points at any data → the chart appears empty.

Reproduction (logged in `future.md` under Known bugs):

1. Open Trends, zoom into a range with filter = All.
2. Switch filter to Roux (or CFOP) → chart looks empty.
3. Switch back to All → data returns.

Expected: zoom persists across method / driver filter changes, showing only the filter-matching solves within the zoomed window. Zoom must still reset on sort-mode / window-size change (v1.29.1 behavior preserved).

## Solution summary

**Compute `xIndex` against the full sorted solve set, before any filter is applied.** `xIndex` becomes a stable integer position in the "canonical timeline" (sorted by current sortMode), independent of the filter. Zoom continues to store `[xIndexStart, xIndexEnd]` as integers; the URL format stays `zoom=a,b|c,d`. Filter changes change which solves are visible inside the zoom window but do not change the xIndex values of those solves.

The x-axis uses Recharts' `type: 'number'` mode. When zoomed, the axis domain is locked to the zoom range (Mode 2: fixed zoom domain). Filter changes keep the same chart width; what changes is the density of visible dots inside the window.

Ao5 / Ao12 rolling averages continue to be computed in entry-order over the filter + window output — i.e. "average of the previous 5 filter-matching solves." The only change is that their x-coordinates are the solves' full-sort xIndex values rather than positions in the filtered array, so Ao5 line segments naturally span gaps where filtered-out solves sit.

## Design

### Zoom semantics

- Zoom stack `Array<[number, number]>` stores integer ranges in the full-sorted xIndex space.
- xIndex is a 1-based position in the sorted (by current `sortMode`) real-solves array, **before filtering**. Examples are excluded from the chart pipeline; they never receive an xIndex.
- Zoom persists across method / driver filter changes.
- Zoom resets on sort-mode change and on window-size change (already shipped in v1.29.1 via handler-side resets).
- Zoom stack drill-down is preserved — each push is a subrange of the previous; pop returns to the parent level; empty stack means unzoomed.

### Data pipeline

Replace the current three-step pipeline:

```
filterSolves(solves, filter)            → filtered
sortAndSliceWindow(filtered, sortMode, window) → windowed (examples stripped inside)
buildTotalData(windowed)                → xIndex = 1..N of windowed
```

with:

```
buildStatsData(solves, sortMode)        → StatsSolvePoint[] (indexed, examples stripped, narrowed)
filterStats(indexed, filter)            → StatsSolvePoint[] (xIndex preserved)
windowStats(indexed, window)            → StatsSolvePoint[] (last N, xIndex preserved)
buildTotalData(windowed)                → reads xIndex off each entry
buildPhaseData(windowed, ...)           → reads xIndex off each entry
```

### StatsSolvePoint

A narrow projection of `SolveRecord` with only what the chart pipeline needs plus the computed `xIndex`. Ephemeral — never persisted to localStorage or Firestore. Defined in `src/utils/trends.ts`.

```ts
export interface StatsSolvePoint {
  id: number              // for click-through and solveMap lookup
  date: number            // for day-line rendering and tooltips
  timeMs: number          // for total plot
  phases: PhaseRecord[]   // for exec/recog/phase breakdown
  method?: string         // for method filter
  driver?: string         // for driver filter
  xIndex: number          // 1-based position in full-sorted real-solves set
}
```

Fields intentionally stripped from the source `SolveRecord`:
- `moves[]` — largest field, not needed for stats
- `quaternionSnapshots` — heavy, not needed
- `scramble`, `schemaVersion`, `migrationNote`, `importedFrom`, `seq` — not used in stats

`isExample` is not on `StatsSolvePoint` because examples are filtered out in `buildStatsData` before any downstream code sees the points.

### buildStatsData

```ts
export function buildStatsData(solves: SolveRecord[], sortMode: SortMode): StatsSolvePoint[] {
  const real = solves.filter(s => !s.isExample)
  const sorted = sortMode === 'date'
    ? [...real].sort((a, b) => a.date - b.date)
    : [...real].sort((a, b) => a.seq - b.seq)
  return sorted.map((s, i) => ({
    id: s.id,
    date: s.date,
    timeMs: s.timeMs,
    phases: s.phases,
    method: s.method,
    driver: s.driver,
    xIndex: i + 1,
  }))
}
```

### filterStats

Simpler than `filterSolves` because examples are already gone:

```ts
export function filterStats(
  indexed: StatsSolvePoint[],
  filter: SolveFilter,
): StatsSolvePoint[] {
  let result = indexed
  if (filter.method !== 'all') result = result.filter(p => (p.method ?? 'cfop') === filter.method)
  if (filter.driver !== 'all') result = result.filter(p => (p.driver ?? 'cube') === filter.driver)
  return result
}
```

`filterSolves` (in `src/utils/solveStats.ts`) stays as-is because the sidebar / history list still needs the `isExample ||` bypass.

### windowStats

```ts
export function windowStats(
  indexed: StatsSolvePoint[],
  windowSize: WindowSize,
): StatsSolvePoint[] {
  if (windowSize === 'all' || windowSize === null) return indexed
  return indexed.slice(-windowSize)
}
```

The previous `sortAndSliceWindow` becomes unnecessary — its responsibilities have migrated to `buildStatsData` (example-strip + sort) and `windowStats` (slice).

### buildTotalData / buildPhaseData signature change

Both functions change from "assign xIndex by input position" to "read xIndex off input entries":

```ts
// BEFORE
export function buildTotalData(windowed: SolveRecord[]): TotalDataPoint[] {
  // ...
  return windowed.map((s, i) => ({ xIndex: i + 1, solveId: s.id, /* ... */ }))
}

// AFTER
export function buildTotalData(windowed: StatsSolvePoint[]): TotalDataPoint[] {
  // ...
  return windowed.map(p => ({ xIndex: p.xIndex, solveId: p.id, /* ... */ }))
}
```

`TotalDataPoint` / `PhaseDataPoint` types themselves do not change — they already have `xIndex`. Only the origin of the value changes.

### X-axis domain (Mode 2: fixed zoom domain)

In `TrendsModal.tsx` the domain computation:

```ts
const currentDomain = zoomStack.at(-1) ?? null

const xAxisDomain: [number, number] = currentDomain
  ? [currentDomain[0] - 0.5, currentDomain[1] + 0.5]   // fixed to zoom range
  : [firstVisIndex - 0.5, lastVisIndex + 0.5]          // auto-fit (current behavior)
```

Unzoomed: auto-fit to first / last visible point (unchanged).
Zoomed: lock to zoom range regardless of filter.

Drill-down: top of stack wins. Zoom-out pops one level. Empty stack → unzoomed.

Day-separator reference lines (`buildDayLines`) are recomputed from visible data each render — naturally fewer lines when filters remove solves.

### Tooltip change

Remove `seq` from the tooltip. Add the solve's position as `#N` where `N = xIndex`. In seq sort, `#N` closely tracks the solve's seq number (since sort is by seq); in date sort, it's the solve's chronological position. Full seq / metadata remains accessible by clicking to open the detail modal.

### Edge cases

| Scenario | Behavior |
|---|---|
| Zoom + filter yields zero visible points | Empty chart, domain stays at `[zoom[0] - 0.5, zoom[1] + 0.5]`. Zoom is a view preference; zoom-out recovers. |
| Zoom range outside data bounds (URL-crafted) | Same as above — empty window at the crafted range. |
| Only one visible point | Renders fine; Ao5/Ao12 are `null` (existing behavior for short windows). |
| Drill-down with filter changes between pushes | Stack persists unchanged; each level renders with current filter applied inside its domain. |
| Solve deleted while modal open | xIndex values of later solves shift by -1; zoom range is unchanged and may now cover slightly different solves. Accepted drift — zoom is a view preference, not a data selection. |
| New solve added (live recording) | In seq sort: appended at xIndex = N+1, no shift. In date sort: usually appended (Date.now); no shift. No effect on zoom. |
| Imported solve (historical date) | In seq sort: appended, no shift. In date sort: inserted at its historical date; later-dated solves' xIndex shifts by +1. Accepted drift. |
| Zoom wider than window (URL-crafted: window=25, zoom=[1, 1000]) | Only last 25 points visible; domain still spans `[0.5, 1000.5]`. Visually odd, not a bug. |
| Invalid zoom pair in URL | URL parser (v1.29.1) drops invalid / reversed ranges. |
| Empty layer in drill-down (URL-crafted) | Same as "zero visible points" above. Pop still works. |

## Implementation

### Files changed

| File | Change |
|---|---|
| `src/utils/trends.ts` | Add `StatsSolvePoint` interface, `buildStatsData`, `windowStats`. Modify `buildTotalData` and `buildPhaseData` signatures to consume `StatsSolvePoint[]` and read `xIndex` off each entry. Delete `sortAndSliceWindow` or inline it into `buildStatsData` + `windowStats`. |
| `src/utils/solveStats.ts` | Add `filterStats(indexed, filter)`. Keep existing `filterSolves` (used by sidebar). |
| `src/components/TrendsModal.tsx` | Replace the three-call pipeline with `buildStatsData → filterStats → windowStats → buildTotalData / buildPhaseData`. Add zoomed-domain branch. Remove `seq` from tooltip, add `#N` using xIndex. |

### Files NOT changed

- `src/types/solve.ts` — SolveRecord schema untouched.
- `src/hooks/useSolveStore.ts` / `src/stores/solveStore.ts` — store layer untouched.
- `src/services/firestoreSolves.ts` / localStorage writers — no schema drift. xIndex never persists.
- `src/hooks/useHashRouter.ts` — URL format `zoom=a,b|c,d` unchanged; parser unchanged.

## Testing

### New unit tests (`src/utils/trends.ts` test file)

1. `buildStatsData` — seq-mode sort: `[{seq:1}, {seq:3}, {seq:2}]` → indexed 1, 2, 3 in `seq` order.
2. `buildStatsData` — date-mode sort: mixed seq, known dates → xIndex matches date order.
3. `buildStatsData` — strips examples: examples in input do not appear in output.
4. `buildStatsData` — narrows the source: output points contain no `moves` / `quaternionSnapshots` / `scramble` / `seq` / other non-stats fields.
5. `filterStats` — preserves xIndex: filter by method keeps matching entries' original xIndex (no renumber).
6. `windowStats` — last-N: returns last N entries with their original xIndex values.
7. `buildTotalData` — reads xIndex from input (input xIndex = 100, 200, 350 → output xIndex = 100, 200, 350).
8. `buildPhaseData` — reads xIndex from input (same assertion).

### Regression guard

- `filterSolves` still bypasses examples — existing test or new one: input contains an example solve with `isExample: true` + non-matching `method`; filter-by-method returns the example.

### Existing tests to update

Any `trends.test.ts` / `solveStats.test.ts` assertion that hard-codes `xIndex === i + 1` on `buildTotalData` / `buildPhaseData` output must be updated to reflect the new "xIndex from input" semantic.

### Component test (optional)

Smoke test asserting the XAxis domain prop in `TrendsModal`:
- Render with zoom stack `[[501, 600]]` and `filter.method = 'roux'`.
- Assert domain = `[500.5, 600.5]`.

Skip if Recharts is hard to assert against — the unit tests above cover the logic.

### Manual QA

- Zoom on All, switch to Roux → see only Roux solves in the zoom window.
- Switch back to All → original view restored.
- Zoom → drill-down to inner zoom → change filter → drill out; each layer's filter+zoom combination renders correctly.
- Sort-mode change resets zoom (v1.29.1 preserved).
- Window-size change resets zoom (v1.29.1 preserved).
- Tooltip shows `#N` using xIndex; seq is gone.
- Day-line reference lines still appear correctly in both sort modes.

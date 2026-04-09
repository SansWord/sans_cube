# Stats Trends — Design Spec

**Date:** 2026-04-09
**Status:** Approved

## Overview

Add a Trends modal to the app that lets the user visualize their solve performance over time. The modal shows two chart views — total time and per-phase breakdown — and is accessible from a "Trends" button in the solve history sidebar. Filters sync bidirectionally with the sidebar. Solve data points are clickable and open the existing SolveDetailModal for replay.

This feature also fixes an existing bug where URL-encoded solve/trends state fails to restore when cloud sync is enabled (Firestore data not yet loaded at mount time).

---

## Decisions

| Decision | Choice |
|---|---|
| Location | Dedicated full-screen modal (same style as mobile sidebar overlay) |
| Entry point | "Trends" button in the stats section header of the sidebar |
| Chart library | Recharts (`npm install recharts`) |
| Tabs | Total \| Phases |
| Total tab | Scatter dots (individual solves) + Ao5 line + Ao12 line |
| Phases tab | One line per phase group (Exec / Recog toggle) |
| Group toggle | Default: grouped. Toggle: Grouped \| Split |
| Groups | CFOP: F2L (4→1), OLL (2→1), PLL (2→1). Roux: LSE (3→1). Derived from `group` field on `Phase`, not hardcoded. |
| Window toggle | 25 / 50 / 100 / All |
| Method filter | Shared state — synced bidirectionally between sidebar and TrendsModal |
| Click dot | Opens SolveDetailModal on top of TrendsModal. Close (✕) returns to TrendsModal. |
| URL | `#trends?method=cfop&tab=phases&window=50&group=grouped&timetype=exec` |
| Mobile | Default window = 25 on screens < 640px. Full-width Recharts ResponsiveContainer fills modal width without horizontal scroll. |
| Cloud timing fix | Defer URL-triggered modal/solve state until `cloudReady` is true. |

---

## Architecture

### State changes in `TimerScreen`

`methodFilter` moves from local state inside `SolveHistorySidebar` to `TimerScreen`. Both the sidebar and `TrendsModal` receive it as a prop with its setter.

```
TimerScreen
├── methodFilter: MethodFilter          (lifted from sidebar)
├── setMethodFilter
├── showTrends: boolean                 (new)
├── setShowTrends
├── selectedSolve: SolveRecord | null   (existing, unchanged)
├── setSelectedSolve
│
├── SolveHistorySidebar
│     props: solves, methodFilter, setMethodFilter, onSelectSolve, ...
│
├── TrendsModal (when showTrends)
│     props: solves, methodFilter, setMethodFilter, onSelectSolve, onClose
│
└── SolveDetailModal (when selectedSolve)
      props: solve, onClose  (unchanged)
```

`TrendsModal` and `SolveDetailModal` are both `position: fixed` overlays. When a dot is clicked in TrendsModal, `selectedSolve` is set and SolveDetailModal renders on top. Closing SolveDetailModal sets `selectedSolve = null` and TrendsModal is still mounted beneath.

### New files

- `src/components/TrendsModal.tsx` — full-screen modal with tabs, controls, and charts
- `src/utils/trends.ts` — pure functions that transform `SolveRecord[]` into Recharts-ready data

### Modified files

- `src/components/TimerScreen.tsx` — lift `methodFilter`, add `showTrends` state, fix URL cloud timing, wire trends URL
- `src/components/SolveHistorySidebar.tsx` — receive `methodFilter`/`setMethodFilter` as props instead of local state; add Trends button

---

## `src/utils/trends.ts`

Pure functions, no React, fully testable.

```ts
// Total time data — one entry per solve in the window
export interface TotalDataPoint {
  seq: number           // solve seq (x-axis label)
  timeMs: number        // individual solve time
  ao5: number | null    // rolling Ao5 ending at this solve
  ao12: number | null   // rolling Ao12 ending at this solve
  solveId: number       // for click → SolveDetailModal lookup
}

// Phase data — one entry per solve in the window
export interface PhaseDataPoint {
  seq: number
  [phaseLabel: string]: number | null  // e.g. 'Cross': 1200, 'F2L': 8400
  solveId: number
}

export function buildTotalData(solves: SolveRecord[], window: number | 'all'): TotalDataPoint[]
export function buildPhaseData(
  solves: SolveRecord[],
  window: number | 'all',
  timeType: 'exec' | 'recog',
  grouped: boolean
): PhaseDataPoint[]
```

**Grouping logic in `buildPhaseData`:** iterate phases on each solve. If `grouped=true`, sum all phases that share the same `group` value into one key (the group name). Ungrouped phases use their `label` as the key. If `grouped=false`, use each phase's `label` directly.

**Window slicing:** take the last N real solves (excluding `isExample`). `'all'` = no limit.

---

## `src/components/TrendsModal.tsx`

### Layout

```
┌─────────────────────────────────────────┐
│ Trends    [CFOP ▼]               [✕]    │  ← header
├─────────────────────────────────────────┤
│ [Total] [Phases]    [25][50][100][All]  │  ← tab + window row
│                   [Exec][Recog] [Grp][Split] │  ← (phases tab only)
├─────────────────────────────────────────┤
│                                         │
│           Recharts chart area           │
│                                         │
└─────────────────────────────────────────┘
```

### Total tab — `ComposedChart`

- `<Scatter>` — individual solve dots, `dataKey="timeMs"`, colored `#555`
- `<Line>` — Ao5, `dataKey="ao5"`, `stroke="#e94560"`, hidden dots, only rendered when window ≥ 5
- `<Line>` — Ao12, `dataKey="ao12"`, `stroke="#3498db"`, dashed, only rendered when window ≥ 12
- Y-axis: seconds (format `timeMs / 1000` with 2dp)
- X-axis: solve seq number
- `<Tooltip>` custom: shows solve #, time, date. "▶ tap to replay" hint.
- `<Scatter onClick>` / `activeDot onClick`: calls `onSelectSolve(solve)`

### Phases tab — `LineChart`

- One `<Line>` per key in `PhaseDataPoint` (excluding `seq` and `solveId`)
- Colors: derive from the method's `Phase.color` (first phase in the group for grouped mode)
- Y-axis: seconds
- `<Legend>` below chart
- `<Tooltip>` custom: shows solve #, phase times, date. "▶ tap to replay" hint.
- Line `onClick`: calls `onSelectSolve(solve)` — look up solve by `solveId`

### Mobile behavior

- Detect `window.innerWidth < 640` on mount
- Default `windowSize` to `25` on mobile
- Hide "All" option on mobile
- `<ResponsiveContainer width="100%" height={300}>` fills modal width

### Group toggle visibility

The `Grouped | Split` toggle only appears in the Phases tab when the active method has at least one phase with a `group` field. Derived from the method definition — no hardcoding.

---

## URL encoding

### Format

```
#trends?method=cfop&tab=phases&window=50&group=grouped&timetype=exec
#solve-<id>   (existing, unchanged)
```

When TrendsModal is open, replace the URL hash with the encoded filter state on every filter change. When TrendsModal closes, clear the hash (same as existing solve URL logic).

### Filter state ownership

- `methodFilter` — lives in `TimerScreen` (shared between sidebar and modal)
- `showTrends` — lives in `TimerScreen`
- `tab`, `windowSize`, `grouped`, `timeType` — live in `TrendsModal` as local state

### On page load

```ts
// In TimerScreen — only resolves showTrends and selectedSolve from URL:
useEffect(() => {
  if (isCloudLoading || urlResolvedRef.current) return
  urlResolvedRef.current = true
  const hash = window.location.hash
  if (hash.startsWith('#trends')) setShowTrends(true)
  else if (hash.startsWith('#solve-')) {
    const id = parseInt(hash.replace('#solve-', ''), 10)
    const solve = solves.find(s => s.id === id)
    if (solve) setSelectedSolve(solve)
  }
}, [isCloudLoading, solves])
```

`TrendsModal` initializes its own local filter state from the URL hash on mount (tab, windowSize, grouped, timeType). Since it mounts only after `showTrends = true` — which is set only after cloud data is ready — the URL parse in TrendsModal always has access to the correct solves via props.

---

## Cloud sync timing fix

### Current bug

`selectedSolve` is initialized via a `useState` lazy initializer that calls `solves.find(id)`. When cloud sync is on, `solves` is empty at mount. The solve is never found; the modal never opens.

### Fix

Remove the lazy initializer. Add a `useEffect` that runs once when `isCloudLoading` transitions to `false`:

```ts
const urlResolvedRef = useRef(false)

useEffect(() => {
  if (isCloudLoading || urlResolvedRef.current) return
  urlResolvedRef.current = true
  const hash = window.location.hash
  if (hash.startsWith('#trends')) setShowTrends(true)
  else if (hash.startsWith('#solve-')) {
    const id = parseInt(hash.replace('#solve-', ''), 10)
    const solve = solves.find(s => s.id === id)
    if (solve) setSelectedSolve(solve)
  }
}, [isCloudLoading, solves])
```

When cloud is off, `isCloudLoading` is always `false` so this resolves immediately on mount — no behavior change for local mode.

---

## Testing

- `src/utils/trends.test.ts` — unit tests for `buildTotalData` and `buildPhaseData`:
  - window slicing (exact N, fewer than N, 'all')
  - Ao5/Ao12 returns null when fewer than 5/12 solves
  - grouped vs split phase keys
  - exec vs recog time selection
  - excludes example solves from data and from Ao calculation
- `TrendsModal.tsx` — no unit tests (pure rendering); covered by manual test checklist

---

## Out of scope

- Persisting trends filter preferences to localStorage (filters live in URL)
- Exporting chart data
- Date-range filtering (window size is sufficient for now)
- ZZ method support (follows from method definition, no extra work)

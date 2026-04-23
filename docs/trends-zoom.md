# Trends Chart Zoom

## Overview

The trends charts support drag-to-zoom with a multi-level zoom stack. Users can zoom into a range by dragging, navigate back one level, or reset to the full view.

## Interaction

### Zoom in
Click and drag horizontally on the chart to select a range. A shaded `ReferenceArea` appears during the drag to show the selected region. Release to commit the zoom. The chart re-renders to show only solves within that range.

**Drag sensitivity threshold:** The zoom only commits if `Math.abs(dragEnd - dragStart) >= 2` (in xIndex units). This prevents accidental single-click triggers, which matter on trackpads that produce tiny movement during a tap.

### Zoom stack
Each committed zoom pushes a `[left, right]` tuple onto a `zoomStack: Array<[number, number]>` state. The current view domain is always the top of the stack. This enables multi-level zoom without limit.

- **← Back**: pops the top entry, returning to the previous zoom level. Visible whenever `zoomStack.length >= 1`.
- **Reset zoom**: clears the entire stack, returning to the full window. Visible whenever `zoomStack.length >= 1`.

Both buttons appear in the left side of the controls row 2. When the stack is empty (no zoom), the buttons are hidden to keep the UI clean.

### Click vs. drag disambiguation
A `didZoomRef` (React ref, not state) is set to `true` only when a zoom actually commits in `handleChartMouseUp`. The chart-level `onClick` handler checks `didZoomRef.current` and skips the solve-detail open if it was a drag. The ref is reset to `false` on `mouseDown`. Because it's a ref (not state), toggling it never causes a re-render.

## Data pipeline (four-step)

The chart data is computed in four stages, each a named function with a narrow contract:

```
buildStatsData(solves, sortMode)   → StatsSolvePoint[]   (assigns stable xIndex to full solve set)
  → filterStats(indexed, filter)  → StatsSolvePoint[]   (drops non-matching solves, xIndex unchanged)
  → windowStats(filtered, N)      → StatsSolvePoint[]   (slices last-N, xIndex unchanged)
  → buildTotalData / buildPhaseData                      (reads xIndex from input, never recomputes it)
```

**Why this order matters:** `buildStatsData` assigns `xIndex` values (1-based position in the sorted set) **before** any filter is applied. Every subsequent stage passes those values through unchanged. This means the zoom range (`zoomStack` entries are raw `xIndex` pairs) stays valid when the user switches method/driver filter — the same solve always has the same `xIndex`, so zooming into `[50, 100]` and then switching from "all" to "Roux" simply shows only Roux solves whose `xIndex` falls in that window.

**`filterSolves` vs `filterStats`:** The sidebar still uses `filterSolves` (which has example-bypass logic — examples always pass through regardless of method filter). The chart pipeline uses `filterStats`, which has no example bypass because `buildStatsData` already strips examples before assigning xIndex.

## X-axis domain

When **not zoomed**: domain is `[firstVisIndex - 0.5, lastVisIndex + 0.5]` — auto-fits to the visible data. The 0.5 padding gives the first and last dots visual breathing room from the axis edges.

When **zoomed**: domain locks to `[currentDomain[0] - 0.5, currentDomain[1] + 0.5]` — the axis stays fixed to the zoom range even if the current filter leaves no visible dots in that range. This is intentional: filter changes are "look through the same window" operations, not "move the window" operations.

## Data filtering (visible slice)

The `XAxis domain` prop in Recharts only scales the axis — it does not remove out-of-range data points, which would still render as dots outside the visible area. To prevent this, `visibleTotalData` and `visiblePhaseData` are pre-filtered to `currentDomain` before being passed to the chart.

## Zoom resets

Zoom resets on **sort-mode change** and **window-size change** (via `changeSortMode` / `changeWindowSize` callbacks). These are the only two user actions that reassign all xIndex values, so a stored zoom domain would be invalid. Filter changes do **not** reset zoom.

## Day reference lines

Day boundary `ReferenceLine` components are computed from the currently visible data (post-domain filter), so they always reflect the actual dates in the zoomed range. Labels show `M/D` format in browser local timezone.

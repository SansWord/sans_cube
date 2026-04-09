# Trends Chart Zoom

## Overview

The trends charts support drag-to-zoom with a multi-level zoom stack. Users can zoom into a range by dragging, navigate back one level, or reset to the full view.

## Interaction

### Zoom in
Click and drag horizontally on the chart to select a range. A shaded `ReferenceArea` appears during the drag to show the selected region. Release to commit the zoom. The chart re-renders to show only solves within that range.

**Drag sensitivity threshold:** The zoom only commits if `Math.abs(dragEnd - dragStart) >= 2` (in seq units). This prevents accidental single-click triggers, which matter on trackpads that produce tiny movement during a tap.

### Zoom stack
Each committed zoom pushes a `[left, right]` tuple onto a `zoomStack: Array<[number, number]>` state. The current view domain is always the top of the stack. This enables multi-level zoom without limit.

- **← Back**: pops the top entry, returning to the previous zoom level. Visible whenever `zoomStack.length >= 1`.
- **Reset zoom**: clears the entire stack, returning to the full window. Visible whenever `zoomStack.length >= 1`.

Both buttons appear in the left side of the controls row 2. When the stack is empty (no zoom), the buttons are hidden to keep the UI clean.

### Click vs. drag disambiguation
A `didZoomRef` (React ref, not state) is set to `true` only when a zoom actually commits in `handleChartMouseUp`. The chart-level `onClick` handler checks `didZoomRef.current` and skips the solve-detail open if it was a drag. The ref is reset to `false` on `mouseDown`. Because it's a ref (not state), toggling it never causes a re-render.

## Data filtering

The `XAxis domain` prop in Recharts only scales the axis — it does not remove out-of-range data points, which would still render as dots outside the visible area. To prevent this, `visibleTotalData` and `visiblePhaseData` are pre-filtered to the current domain before being passed to the chart:

```ts
const visibleTotalData = currentDomain
  ? totalData.filter(pt => pt.seq >= currentDomain[0] && pt.seq <= currentDomain[1])
  : totalData
```

## X-axis domain padding

The domain is set to `[firstVisSeq - 0.5, lastVisSeq + 0.5]` rather than the default. Without this, Recharts (with `type="number"`) defaults to `[0, max]`, so a zoomed range like `[10, 20]` would still show a blank left section starting from 0. The 0.5 padding also gives the first and last dots visual breathing room from the axis edges.

## Window changes clear zoom

A `useEffect` on `[tab, windowSize]` resets `zoomStack` and clears `refAreaLeft`/`refAreaRight` whenever the tab or window size changes. This is intentional — the seq numbers in the new window don't correspond to the old zoom range.

## Day reference lines

Day boundary `ReferenceLine` components are computed from the currently visible data (post-filter), so they always reflect the actual dates in the zoomed range. Labels show `M/D` format in browser local timezone.

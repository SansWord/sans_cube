# Sort-by-Timestamp Toggle in Trends — Design Spec

**Date:** 2026-04-23
**Status:** Draft (pending review)

## 1. Overview & Goal

Add a sort-mode dropdown to the Trends modal header that reorders the chart data by either solve **sequence** (`seq`, current behavior) or **completion date** (`solve.date`, the cubeTimestamp of solve completion).

The motivating bug: after importing acubemy history, imported solves get `seq` values continuing from `max(existingSeq) + 1` but their `date` values are historical (months or years old). In the chart, day-boundary reference lines are labeled from `solve.date`, so the labels jump backward in time near the boundary where imports start. Sorting by date makes the x-axis chronological end-to-end, which removes the backward jump.

### Goals

- Give the user a one-click way to view the Trends chart in chronological order.
- Preserve current `seq`-ordered behavior as the default.
- Make the choice URL-shareable.

### Non-goals (v1)

- Reordering the `SolveHistorySidebar` (insertion-order today, with a similar latent bug — separate future work).
- Reordering stats blocks (PB, averages) anywhere.
- Persisting the sort choice across browser sessions (URL-only).
- Translating an active zoom range across a sort-mode change.

### Success criteria

After importing an acubemy history, opening `#trends?...&sort=date` shows day-boundary labels in monotonically increasing order, and the Ao5/Ao12 line reflects a chronological rolling window.

## 2. Data-layer change (`src/utils/trends.ts`)

New exported type:

```ts
export type SortMode = 'seq' | 'date'
```

Rename `sliceWindow` → `sortAndSliceWindow` and export it. Add a `sortMode` parameter:

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

`buildTotalData` and `buildPhaseData` no longer sort or slice internally. They accept a pre-windowed `SolveRecord[]`:

```ts
export function buildTotalData(windowed: SolveRecord[]): TotalDataPoint[] { ... }

export function buildPhaseData(
  windowed: SolveRecord[],
  timeType: 'exec' | 'recog' | 'total',
  grouped: boolean,
): PhaseDataPoint[] { ... }
```

`buildMergedPhaseData` in `TrendsModal.tsx:148-168` likewise accepts the pre-windowed array and forwards it to `buildPhaseData`.

`TrendsModal` calls `sortAndSliceWindow` once per render and threads the result through both builders:

```ts
const windowed = sortAndSliceWindow(filtered, windowSize, sortMode)
const totalData = buildTotalData(windowed)
const phaseData = buildMergedPhaseData(windowed, phaseToggle, grouped)
```

This eliminates redundant sort+slice work (previously up to 4× per render: once for Total, plus once per active time-type in Phases).

### Rename: data-point x-axis field `seq` → `xIndex`

The x-axis position field on `TotalDataPoint` and `PhaseDataPoint` is renamed from `seq` to `xIndex` to avoid confusion with `SolveRecord.seq` (the solve's display number). Semantics unchanged: `xIndex = i + 1`, i.e., the 1..N position within the windowed, sorted view. It is *not* the `SolveRecord.seq`.

Downstream touch-ups in `TrendsModal.tsx`:

- `xAxisProps.dataKey: 'seq'` → `'xIndex'` (at line 480).
- `buildDayLines` parameter type `Array<{ seq: number; solveId: number }>` → `Array<{ xIndex: number; solveId: number }>`; internal references updated.
- Current-domain filters `pt.seq >= currentDomain[0] ...` → `pt.xIndex >= currentDomain[0] ...` (lines 343, 346).
- `firstVisSeq` / `lastVisSeq` → `firstVisIndex` / `lastVisIndex`, reading `.xIndex`.
- `buildMergedPhaseData`'s field-skip guard: `'seq' || 'solveId'` → `'xIndex' || 'solveId'`.
- Tooltips: the fallback `Solve #{solve?.seq ?? d.seq}` / `Solve #{solve?.seq ?? pt.seq}` (lines 268, 299) — the fallback was to the data point's field, which under the rename is an x-axis index with no meaning as a solve identifier. Change to `Solve #{solve?.seq ?? '?'}` so the user sees an unambiguous placeholder if the `SolveRecord` lookup fails.

The zoom stack continues to store `[leftXIndex, rightXIndex]` pairs.

### Ao5 / Ao12 semantics

`rollingAo(values, index, n)` operates on whatever order the windowed array has, so Ao5/Ao12 automatically reflect the new sort. In `sort=date` mode this means "Ao5 at solve X = trimmed mean of X plus the 4 solves that immediately precede it chronologically" — the chosen semantic.

## 3. URL routing & initial params

`TrendsHashParams` in `src/hooks/useHashRouter.ts` gains `sortMode: SortMode`.

- **Read (`parseTrendsParams`):** `params.get('sort') === 'date'` → `'date'`; anything else (including missing) → `'seq'`.
- **Write (URL sync in `TrendsModal.tsx:375-395`):** the `URLSearchParams` block adds `sort: sortMode`. The param is always written, matching the convention already used by `group=grouped`, `method=all`, etc. `sortMode` is added to the effect's dependency array.
- **`initialParams`:** `TrendsModal` initializes `const [sortMode, setSortMode] = useState<SortMode>(initialParams.sortMode)`.

No new localStorage key; no cross-session persistence.

## 4. UI control

A new `<select>` dropdown in the Trends header filter cluster, positioned to the right of the existing Driver dropdown in `TrendsModal.tsx:543-561`. Styling matches Method / Driver exactly:

- Label text `Sort` (color `#555`, fontSize 11).
- `<select>` options: `Seq` (value `"seq"`) and `Date` (value `"date"`).
- `onChange` calls `setSortMode(e.target.value as SortMode)`.
- No extra mobile-layout handling; rides the same responsive rules as neighbors.

## 5. Zoom interaction

Flipping the Sort dropdown clears any active zoom. This is achieved by adding `sortMode` to the dependency array of the existing zoom-reset effect in `TrendsModal.tsx:368-372`:

```ts
useEffect(() => {
  setZoomStack([])
  setRefAreaLeft(null)
  setRefAreaRight(null)
}, [windowSize, sortMode])
```

Rationale: the zoom stack stores `[leftSeq, rightSeq]` pairs in x-axis position units (1..N), which point to different underlying solves after a sort change. Clearing is the simplest unambiguous behavior and matches how the existing `windowSize` change is handled.

## 6. Day-boundary labels & tooltips

No code change required.

- `buildDayLines` (`TrendsModal.tsx:184-215`) walks the visible data and emits a label whenever the day of `solve.date` changes vs the previous solve. Under `sort=date` the visible data is monotonic by date, so labels become monotonic automatically.
- Tooltips (`TotalTooltip` / `PhaseTooltip` at `TrendsModal.tsx:229-309`) show `Solve #{solve.seq}` and `formatDateTime(solve.date)`, both read straight from the `SolveRecord`. They are correct under either sort; the `Solve #` label always reflects the original `seq`, not the x-axis position index.

## 7. Testing

### Unit tests — new file `src/utils/trends.test.ts`

- `sortAndSliceWindow` with `sortMode: 'seq'` returns solves ordered by `seq` (preserves current behavior).
- `sortAndSliceWindow` with `sortMode: 'date'` returns solves ordered by `date` even when `seq` disagrees (simulate post-import store: imported solves have high `seq` but old `date`).
- `sortAndSliceWindow` window trimming: with `window = n`, returns the last n solves after sort, in both modes.
- `buildTotalData` on a date-ordered `windowed` array: Ao5 values at a given index match the date-ordered rolling window (compute expected trimmed mean manually and assert). Output rows carry `xIndex: i + 1` and the expected `solveId`.
- `buildPhaseData` on a date-ordered `windowed` array: same check on phase times at a given index; output carries `xIndex`.

### Unit tests — router

In the existing `useHashRouter` test file (or a new one if none): `parseTrendsParams` returns `sortMode: 'date'` for `sort=date`, `'seq'` for `sort=seq`, `'seq'` for missing, `'seq'` for garbage values.

### Manual QA

Add to `docs/manual-test-checklist.md`:

> Trends: after an import, toggle Sort between Seq and Date. In Date mode, day-boundary labels should be monotonically increasing. Changing Sort should clear any active zoom.

No new UI/integration test for the dropdown; follows the existing pattern (Method/Driver dropdowns have no component tests).

## 8. Docs touched

- `docs/url-routes.md` — add `sort=seq|date` to the Trends-route query-parameter table.
- `docs/ui-architecture.md` — update `TrendsModal` ownership to list the new `sortMode` state.
- `docs/manual-test-checklist.md` — add the sort-toggle QA line above.
- `future.md` — cross out "Sort-by-timestamp toggle in Trends" with the shipping version tag (at release time).
- `docs/devlog.md` — new entry at release time.

`docs/storage.md` untouched (no new keys).

## 9. Out-of-scope follow-up (noted for future)

`SolveHistorySidebar` presents solves in array-insertion order via `[...visibleExamples, ...state.solves].reverse()` (`useSolveStore.ts:9`, `SolveHistorySidebar.tsx:208`). For natively-recorded solves this equals chronological order, but after `addMany` appends imports (`solveStore.ts:248, 262`), the imported block sits at the top of the sidebar regardless of historical date. A future fix — either sorting by `date` at read time or inserting imports at their chronological position — is out of scope here.

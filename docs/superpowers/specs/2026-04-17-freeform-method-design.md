# Freeform Method — Design Spec

**Date:** 2026-04-17  
**Status:** Approved

---

## Overview

Add a **Freeform** solving method with a single phase ("Solved") covering the entire solve. No phase analysis is performed — the cube being solved is the only condition. Freeform is a first-class method: selectable globally in the timer, per-solve in the detail modal, and filterable in the record list and Trends stats.

---

## Method Definition

**File:** `src/methods/freeform.ts`

| Field | Value |
|-------|-------|
| `id` | `'freeform'` |
| `label` | `'Freeform'` |
| Phases | One phase: label `'Solved'`, color `#27ae60` (green, matches PLL), `isComplete: isSolvedFacelets` |

The single phase captures all moves from scramble start to full solve. No group field.

---

## Type Changes

**`src/types/solve.ts`**

```ts
export type MethodFilter = 'all' | 'cfop' | 'roux' | 'freeform'
```

`SolveRecord.method` stays typed as `string` — no change needed.

---

## Registry (`src/methods/index.ts`)

- Export `FREEFORM` alongside `CFOP` and `ROUX`
- `getMethod('freeform')` returns `FREEFORM`
- `getMethod(undefined)` continues to return `CFOP` (default unchanged)

---

## Global Method Selector (`src/components/MethodSelector.tsx`)

Add `FREEFORM` to the `METHODS` array. Freeform then appears in:
- Timer bar (global method selector via `TimerScreen`)
- Solve detail modal (per-solve method change)

---

## Per-Solve Recompute (`src/components/SolveDetailModal.tsx`)

No changes needed. `handleMethodChange` already calls `recomputePhases(solve, newMethod)` — passing `FREEFORM` produces one "Solved" phase covering all moves with full timing. The recompute core (`recomputePhases.ts`) requires no changes.

---

## Method Filter Dropdowns

Add `<option value="freeform">Freeform</option>` to:
- `src/components/SolveHistorySidebar.tsx`
- `src/components/TrendsModal.tsx`

Filter logic in `useSolveHistory.ts` already works correctly — it matches `s.method === filter.method`, so no changes needed there.

---

## Trends Color Map (`src/components/TrendsModal.tsx`)

`buildColorMap` switches on the method filter value. Add a `'freeform'` branch:

```ts
return buildColorMapForMethod(FREEFORM, grouped)
```

This produces a color entry for the single "Solved" phase. The phase chart renders one green bar representing full solve time.

The `'all'` branch in `buildColorMap` also needs FREEFORM merged in, so freeform solves get the correct color when the filter is set to "All":

```ts
if (method === 'all') {
  return {
    ...buildColorMapForMethod(FREEFORM, grouped),
    ...buildColorMapForMethod(ROUX, grouped),
    ...buildColorMapForMethod(CFOP, grouped),
  }
}
```

---

## Method Mismatch Detection (`src/utils/detectMethod.ts`)

Skip freeform solves — no CFOP/Roux signal to compare:

```ts
if (solve.method === 'freeform') continue
```

Add this guard after the existing `isExample` and empty-moves guards.

---

## What Is NOT Changing

- `recomputePhases.ts` core — no changes; single-phase freeform works through the existing loop
- `SolveRecord.method` field type — already `string`, stays flexible
- No data migration — freeform is opt-in per solve, old solves are unaffected
- `useSolveHistory.ts` filter logic — already handles arbitrary method strings

---

## File Changelist

| File | Change |
|------|--------|
| `src/methods/freeform.ts` | New — FREEFORM method definition |
| `src/methods/index.ts` | Export FREEFORM, add to `getMethod()` |
| `src/types/solve.ts` | Add `'freeform'` to `MethodFilter` |
| `src/components/MethodSelector.tsx` | Add FREEFORM to METHODS array |
| `src/components/SolveHistorySidebar.tsx` | Add freeform option to method filter dropdown |
| `src/components/TrendsModal.tsx` | Add freeform option to dropdown + `buildColorMap` branch |
| `src/utils/detectMethod.ts` | Skip freeform solves in mismatch detection |

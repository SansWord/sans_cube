# Freeform Method — Design

**Status:** draft
**Date:** 2026-04-17

## Summary

Add a third solving method, **Freeform**, with a single phase ("Solved") that completes when the cube reaches the solved state. Wire it into the method filter (sidebar + Trends), the method selector in Solve Detail (so existing solves can be recomputed to/from Freeform), and the hash-router URL whitelist. Exclude Freeform solves from the method-mismatch detector.

## Motivation

From `future.md`:

> add a "freeform" method that only has one cube-is-solved phase. we can use this for future preparation. method filter should support this for record list and stats

Freeform is an opt-in "ignore phase analysis" choice. It records only the total solve time (`timeMs`, derived from hardware `cubeTimestamp` with a per-solve calibrated offset — same as CFOP/Roux) and total turn count, useful when the solver is practicing in a way that doesn't map cleanly to CFOP or Roux.

## Design Decisions

1. **Single phase label:** `Solved`
2. **Phase color:** `#27ae60` (green — same as the "solved end-state" color used by CFOP EPLL and Roux EP)
3. **Method-mismatch detector behavior:** skip Freeform solves entirely. Never auto-suggest Freeform; never flag a Freeform-stored solve as mismatched. Rationale: the user deliberately opted out of phase analysis; flagging would work against that intent.
4. **Dropdown order:** CFOP, Roux, Freeform (appended at the end; preserves existing ordering).
5. **No storage migration:** the `method` field is already `string`; existing CFOP/Roux solves are untouched.

## New Method Definition

`src/methods/freeform.ts`:

```ts
import type { SolveMethod } from '../types/solve'
import { isSolvedFacelets } from '../utils/applyMove'

export const FREEFORM: SolveMethod = {
  id: 'freeform',
  label: 'Freeform',
  phases: [
    {
      label: 'Solved',
      color: '#27ae60',
      isComplete: isSolvedFacelets,
    },
  ],
}
```

## Files Changed

| File | Change |
|---|---|
| `src/methods/freeform.ts` | **new** — definition above |
| `src/methods/index.ts` | export `FREEFORM`; `getMethod('freeform')` returns FREEFORM |
| `src/types/solve.ts` | `MethodFilter = 'all' \| 'cfop' \| 'roux' \| 'freeform'`; update comment on `SolveRecord.method` field (`'cfop' \| 'roux' \| 'freeform'`) |
| `src/components/MethodSelector.tsx` | append FREEFORM to `METHODS` array |
| `src/components/SolveHistorySidebar.tsx` | add `<option value="freeform">Freeform</option>` to method filter dropdown (~line 108) |
| `src/components/TrendsModal.tsx` | add Freeform `<option>` to filter dropdown (~line 538); include FREEFORM in `buildColorMap` merge when `method === 'all'` |
| `src/hooks/useHashRouter.ts` | add `'freeform'` to the `method` whitelist — both the `TrendsHashParams` type (line 9) and the `parseTrendsParams` validation tuple (line 41) |
| `src/utils/detectMethod.ts` | one-line guard at top of the for-loop: `if ((solve.method ?? 'cfop') === 'freeform') continue` |

## Files NOT Changed (and why)

- `src/utils/recomputePhases.ts` — the generic phase-completion algorithm already produces a single "Solved" phase record when the method has one phase. The CFOP-specific EOLL/COLL/CPLL/EPLL merge rules key off those exact labels and won't trigger for Freeform.
- `src/hooks/useMethod.ts` — reads from localStorage and calls `getMethod`; any string value flows through.
- Firestore / localStorage schema — `method` is already a free-form `string` field; no migration needed.
- `src/utils/migrateSolveV1toV2.ts` — operates on moves, not method metadata; unaffected.

## Recompute / Change-Method Flow

Already fully supported. `SolveDetailModal` → `MethodSelector` → `handleMethodChange` calls `recomputePhases(solve, newMethod)` and persists via `onUpdate`. Because Freeform is added to the `METHODS` array in `MethodSelector.tsx`, users can:

- Switch an existing CFOP or Roux solve *to* Freeform (phases collapse to a single "Solved" row).
- Switch an existing Freeform solve back to CFOP or Roux (phases are re-derived from moves).

No new code path required.

## Phase-Bar Rendering

With a single phase, `PhaseBar` renders one colored bar spanning 100%. This already works: `PhaseBar` iterates `phaseRecords` and distributes width proportionally. The "Cross" special case (`row.label === 'Cross' ? '—' : …`) in `SolveDetailModal` for recognition time does not fire (label is "Solved").

## Tests

### New / updated unit tests

- **`tests/utils/recomputePhases.test.ts`** — add a case: `recomputePhases(solve, FREEFORM)` on any solved fixture returns a single-entry array with `label: 'Solved'`, `turns === solve.moves.length`, `recognitionMs === 0` (because `phaseStart === phaseFirstMove` for the first/only phase), and `executionMs === lastMoveTs - firstMoveTs`. Use one existing CFOP fixture.
- **`tests/filterSolves.test.ts`** — add a case: `filter: { method: 'freeform', driver: 'all' }` returns only solves whose `method === 'freeform'` (plus examples, per existing behavior).
- **`tests/hooks/useHashRouter.test.ts`** — add a case: `#trends?method=freeform` → `params.method === 'freeform'`.

### Manual QA

- Record a solve under CFOP → switch method filter to Freeform in sidebar → solve disappears.
- Open a CFOP solve in detail → change method to Freeform → phase table collapses to one "Solved" row; bar is a single green bar.
- Change the same solve back to CFOP → original phases return.
- URL `#trends?method=freeform` opens Trends with Freeform filter active.
- Open the maintenance panel (method mismatches) with a Freeform solve present → no mismatch entry for that solve.

## Docs

- `future.md` — strikethrough the Freeform item with version tag (done at end of implementation).
- `docs/devlog.md` — new versioned entry (done at end of session).
- No new `docs/*.md` file.

## Out of Scope

- ZZ method (listed separately in `future.md`).
- Changing the default method (remains CFOP).
- `detectMethod` suggesting Freeform (explicitly excluded — see Design Decision #3).
- Any change to how Freeform solves are recorded in real time (the recording pipeline is method-agnostic; the method is only used at the phase-analysis step).

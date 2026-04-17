# Commutative Ahead Execution — Design Spec

**Date:** 2026-04-17
**Status:** draft

---

## Overview

When two adjacent scramble steps commute (i.e., turning either face does not affect the other), the user should be able to execute the next step before the current one. The scramble display reflects this with live color feedback.

**Example:** In `... L R D ...`, L is current (white) and R is the next step (gray). Since L and R are on opposite axes, R can be executed ahead:
- User turns R → R turns **green** (done ahead, correct direction)
- User turns R' → R turns **orange** (done ahead, wrong direction — needs fixing)

---

## Scope

- Look-ahead is limited to **one step ahead only** (`currentStepIndex + 1`).
- No deep undo support (index-2 undo is out of scope).
- The existing single-step undo behavior is unchanged.

---

## Commutativity Rule

Only opposite face pairs commute. Slice moves (M, E, S) are never commutative.

| Face | Commutes with |
|------|--------------|
| R    | L            |
| L    | R            |
| U    | D            |
| D    | U            |
| F    | B            |
| B    | F            |

Encoded as a pure helper:

```ts
function commutes(face1: Face, face2: Face): boolean {
  return (
    (face1 === 'R' && face2 === 'L') || (face1 === 'L' && face2 === 'R') ||
    (face1 === 'U' && face2 === 'D') || (face1 === 'D' && face2 === 'U') ||
    (face1 === 'F' && face2 === 'B') || (face1 === 'B' && face2 === 'F')
  )
}
```

The ahead step is eligible only when `currentStepIndex + 1 < steps.length` (bounds guard — checked first to avoid out-of-bounds access) **and** `commutes(steps[currentStepIndex].face, steps[currentStepIndex + 1].face)` is true.

---

## State Changes

### New fields in `TrackerState`

```ts
aheadState: 'none' | 'done' | 'warning'
aheadNetTurns: number  // net turns on ahead face; only meaningful when aheadState === 'warning'
```

Both are initialized to `'none'` / `0` in `makeInitialTrackerState`.

Both reset to `'none'` / `0` whenever `currentStepIndex` advances.

### `buildStepStates` changes

Receives one new parameter: `aheadState: 'none' | 'done' | 'warning'`. The ahead index is always `currentStepIndex + 1` and is derived internally. When `aheadState` is not `'none'` **and** `currentStepIndex + 1 < steps.length` (bounds guard inside `buildStepStates`), that step is rendered as `'done'` (green) or `'warning'` (orange) — overriding the default `'pending'`.

---

## State Machine Logic

All new branches are inside the normal `'scrambling'` state in `applyTrackerMove`.

### Branch 1 — Ahead step move

**Condition:** `move.face === steps[currentStepIndex + 1].face` AND the ahead step is eligible (commutes + bounds).

Track net turns on the ahead face using the same net-turn logic as the existing warning state:

- `net4 === fulfilledNet4` → `aheadState: 'done'`
- `net4 === 0` → `aheadState: 'none'` (cancelled back to pending)
- anything else → `aheadState: 'warning'`, update `aheadNetTurns`

`fulfilledNet4` for the ahead step: `2` if `ahead.double`, else `1` (CW) or `3` (CCW).

### Branch 2 — Current face move while `aheadState === 'warning'`

The current step processes **exactly as normal** — `aheadState` does not block progress on the current step.

**Sub-case: current step fulfilled while `aheadState === 'warning'`:**

- `currentStepIndex` advances by 1 (to R).
- R becomes the new current step in **warning** state: `trackingState: 'warning'`, `warningNetTurns = aheadNetTurns`.
- `aheadState` resets to `'none'`, `aheadNetTurns` resets to `0`.

This means an orange ahead step seamlessly becomes an orange current step when L completes.

### Branch 3 — Current step fulfilled while `aheadState === 'done'`

- `currentStepIndex` advances by **2** (skips the already-done ahead step).
- `aheadState` resets to `'none'`, `aheadNetTurns` resets to `0`.
- If `currentStepIndex + 2 >= steps.length`, the tracker becomes `'armed'`.

### Other face moves while `aheadState === 'warning'`

Any face that is neither the current face nor the ahead face enters **wrong mode** as normal.

---

## UI / Rendering

`ScrambleDisplay` requires **no changes**. The existing `STATE_COLOR` map already covers all cases:

| `StepState` | Color |
|---|---|
| `'done'` | green (#2ecc71) — used for done-ahead |
| `'current'` | white (#ffffff) |
| `'pending'` | gray (#555) |
| `'warning'` | orange (#f39c12) — used for warning-ahead |

Only `buildStepStates` is updated to accept and apply the ahead index and state.

---

## Edge Cases

| Case | Behavior |
|---|---|
| Last step is current | `currentStepIndex + 1 >= steps.length` — no ahead check, no bounds issue |
| Ahead step is a double (R2) | `fulfilledNet4 = 2`; partial turn (net ≠ 0 and ≠ 2) → warning, full two turns → done |
| `trackingState === 'warning'` AND `aheadState === 'warning'` | Both run independently; each face routes to its own net-turn tracker; any third face → wrong mode |
| `aheadState === 'done'` and current step enters warning | warning proceeds normally; aheadState stays `'done'`; on fulfillment, advance by 2 |
| Slice move adjacent to any step | `commutes()` returns false → no ahead eligibility |

---

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useScrambleTracker.ts` | Add `commutes()`, new state fields, new branches in `applyTrackerMove`, update `buildStepStates` |
| `src/types/solve.ts` | No changes |
| `src/components/ScrambleDisplay.tsx` | No changes |
| Tests | New test cases in `useScrambleTracker.test.ts` covering all branches and edge cases |

# Commutative Ahead Execution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to execute the next scramble step before the current one when the two steps are on opposite (commuting) faces, with live green/orange visual feedback on the scramble display.

**Architecture:** All logic lives in `src/hooks/useScrambleTracker.ts`. Two new fields (`aheadState`, `aheadNetTurns`) are added to `TrackerState` to track the ahead step independently of the current step. A pure `commutes()` helper guards eligibility. `buildStepStates` gets a new parameter to color the ahead step. `ScrambleDisplay` and `solve.ts` require no changes.

**Tech Stack:** TypeScript, Vitest (`npm run test` or `npx vitest run tests/hooks/useScrambleTracker.test.ts`)

**Spec:** `docs/superpowers/specs/2026-04-17-commutative-ahead-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/hooks/useScrambleTracker.ts` | Add `commutes()`, new state fields, `applyAheadMove()`, routing in scrambling + warning states, update `buildStepStates` and all call sites |
| `tests/hooks/useScrambleTracker.test.ts` | Add new `describe` blocks for each branch |

---

## Task 1: `commutes()` helper

**Files:**
- Modify: `src/hooks/useScrambleTracker.ts`
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `tests/hooks/useScrambleTracker.test.ts` (after existing imports — `commutes` is not exported yet so this will fail to compile):

```ts
import { applyTrackerMove, makeInitialTrackerState, commutes } from '../../src/hooks/useScrambleTracker'
```

Replace the existing import line (which only imports `applyTrackerMove` and `makeInitialTrackerState`) with the line above, then add this block after the existing describes:

```ts
describe('commutes()', () => {
  it('opposite face pairs commute', () => {
    expect(commutes('R', 'L')).toBe(true)
    expect(commutes('L', 'R')).toBe(true)
    expect(commutes('U', 'D')).toBe(true)
    expect(commutes('D', 'U')).toBe(true)
    expect(commutes('F', 'B')).toBe(true)
    expect(commutes('B', 'F')).toBe(true)
  })

  it('same face does not commute', () => {
    expect(commutes('R', 'R')).toBe(false)
    expect(commutes('U', 'U')).toBe(false)
  })

  it('adjacent faces do not commute', () => {
    expect(commutes('R', 'U')).toBe(false)
    expect(commutes('F', 'R')).toBe(false)
    expect(commutes('U', 'B')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: compile error — `commutes` is not exported.

- [ ] **Step 3: Implement `commutes()` in `useScrambleTracker.ts`**

Add this function near the top of `src/hooks/useScrambleTracker.ts` (before `makeInitialTrackerState`) and add `commutes` to the exports:

```ts
export function commutes(face1: Face, face2: Face): boolean {
  return (
    (face1 === 'R' && face2 === 'L') || (face1 === 'L' && face2 === 'R') ||
    (face1 === 'U' && face2 === 'D') || (face1 === 'D' && face2 === 'U') ||
    (face1 === 'F' && face2 === 'B') || (face1 === 'B' && face2 === 'F')
  )
}
```

Also add `Face` to the import at the top of the file:
```ts
import type { Face } from '../types/cube'
```

(`Face` = `'U' | 'R' | 'F' | 'D' | 'L' | 'B'` — already available in `cube.ts`.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass including the new `commutes()` describe.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: add commutes() helper for opposite-face detection"
```

---

## Task 2: New state fields + `buildStepStates` update

**Files:**
- Modify: `src/hooks/useScrambleTracker.ts`
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/hooks/useScrambleTracker.test.ts`:

```ts
describe('makeInitialTrackerState — aheadState fields', () => {
  it('initializes aheadState to none and aheadNetTurns to 0', () => {
    const state = makeInitialTrackerState(steps)
    expect(state.aheadState).toBe('none')
    expect(state.aheadNetTurns).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: FAIL — `aheadState` and `aheadNetTurns` do not exist on the returned object.

- [ ] **Step 3: Add new fields to `TrackerState`**

In `src/hooks/useScrambleTracker.ts`, extend the `TrackerState` interface:

```ts
export interface TrackerState {
  stepStates: StepState[]
  trackingState: TrackingState
  wrongSegments: WrongSegment[]
  currentStepIndex: number
  warningNetTurns: number
  wrongFromWarning: boolean
  aheadState: 'none' | 'done' | 'warning'   // tracks the step at currentStepIndex + 1
  aheadNetTurns: number                       // net turns on ahead face; meaningful when aheadState === 'warning'
}
```

- [ ] **Step 4: Update `makeInitialTrackerState`**

```ts
export function makeInitialTrackerState(steps: ScrambleStep[]): TrackerState {
  return {
    stepStates: steps.map((_, i) => (i === 0 ? 'current' : 'pending')),
    trackingState: steps.length === 0 ? 'armed' : 'scrambling',
    wrongSegments: [],
    currentStepIndex: 0,
    warningNetTurns: 0,
    wrongFromWarning: false,
    aheadState: 'none',
    aheadNetTurns: 0,
  }
}
```

- [ ] **Step 5: Update `buildStepStates` signature**

Change the function signature to accept an optional `aheadState` parameter, and derive `aheadIndex` internally with a bounds guard:

```ts
function buildStepStates(
  steps: ScrambleStep[],
  doneCount: number,
  currentIndex: number,
  warningIndex: number | null,
  aheadState: 'none' | 'done' | 'warning' = 'none',
): StepState[] {
  const aheadIndex = currentIndex + 1 < steps.length ? currentIndex + 1 : null
  return steps.map((_, i) => {
    if (i < doneCount) return 'done'
    if (warningIndex !== null && i === warningIndex) return 'warning'
    if (i === currentIndex) return 'current'
    if (aheadState !== 'none' && aheadIndex !== null && i === aheadIndex) {
      return aheadState === 'done' ? 'done' : 'warning'
    }
    return 'pending'
  })
}
```

- [ ] **Step 6: Update all `buildStepStates` call sites**

Every call site either **preserves** `aheadState` (when `currentStepIndex` stays the same) or **resets** it to `'none'` (when `currentStepIndex` changes — advance or undo).

**In `exitWrongMode`** — currentStepIndex unchanged, preserve:
```ts
// from warning:
stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex, state.aheadState),
// from scrambling:
stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null, state.aheadState),
```

**In warning state handler (warning fulfilled → advance)** — reset:
```ts
stepStates: buildStepStates(steps, nextIndex, nextIndex, null, 'none'),
```
Also add `aheadState: 'none', aheadNetTurns: 0` to that return object.

**In warning state handler (net=0, cancel back)** — preserve:
```ts
stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null, state.aheadState),
```

**In scrambling state, undo double (enters warning for previous step)** — reset (position changed):
```ts
stepStates: buildStepStates(steps, newIndex, newIndex, newIndex, 'none'),
```
Add `aheadState: 'none', aheadNetTurns: 0` to that return.

**In scrambling state, undo single** — reset:
```ts
stepStates: buildStepStates(steps, newIndex, newIndex, null, 'none'),
```
Add `aheadState: 'none', aheadNetTurns: 0` to that return.

**In scrambling state, wrong face (enters wrong mode)** — preserve:
```ts
stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null, state.aheadState),
```

**In scrambling state, double first turn (enters warning)** — preserve:
```ts
stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex, state.aheadState),
```

**In scrambling state, single correct (advance)** — reset:
```ts
stepStates: buildStepStates(steps, nextIndex, nextIndex, null, 'none'),
```
Add `aheadState: 'none', aheadNetTurns: 0` to that return.

**In scrambling state, single wrong direction (enters warning)** — preserve:
```ts
stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex, state.aheadState),
```

- [ ] **Step 7: Run all tests to verify nothing broke**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass (existing behavior unchanged; new field test passes).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: add aheadState/aheadNetTurns to TrackerState, update buildStepStates"
```

---

## Task 3: `applyAheadMove` + routing in scrambling state

Handles Branch 1: when the user moves the ahead face while in scrambling state.

**Files:**
- Modify: `src/hooks/useScrambleTracker.ts`
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/hooks/useScrambleTracker.test.ts`:

```ts
describe('applyTrackerMove — ahead step (scrambling state)', () => {
  // L is current (index 0), R commutes with L (index 1), D does not commute with L (index 2)
  const aheadSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW'), step('D', 'CCW')]

  it('R before L → aheadState done, R shows green, L stays white', () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))
    expect(state.aheadState).toBe('done')
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(0)
    expect(state.stepStates[0]).toBe('current')
    expect(state.stepStates[1]).toBe('done')
    expect(state.stepStates[2]).toBe('pending')
  })

  it("R' before L → aheadState warning, R shows orange, L stays white", () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CCW'))
    expect(state.aheadState).toBe('warning')
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(0)
    expect(state.stepStates[0]).toBe('current')
    expect(state.stepStates[1]).toBe('warning')
    expect(state.stepStates[2]).toBe('pending')
  })

  it("R then R' → ahead cancelled, R back to gray", () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // done
    state = applyTrackerMove(state, aheadSteps, move('R', 'CCW'))  // cancel
    expect(state.aheadState).toBe('none')
    expect(state.aheadNetTurns).toBe(0)
    expect(state.stepStates[1]).toBe('pending')
  })

  it("R' then R → ahead cancelled back to gray", () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CCW'))  // warning
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // cancel
    expect(state.aheadState).toBe('none')
    expect(state.aheadNetTurns).toBe(0)
    expect(state.stepStates[1]).toBe('pending')
  })

  it('D (non-commuting face) → wrong mode, aheadState unaffected', () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('D', 'CW'))
    expect(state.trackingState).toBe('wrong')
    expect(state.aheadState).toBe('none')
  })

  it('ahead done then current step wrong face → wrong mode, aheadState preserved in stepStates', () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // R done ahead
    state = applyTrackerMove(state, aheadSteps, move('D', 'CW'))   // D wrong face
    expect(state.trackingState).toBe('wrong')
    expect(state.aheadState).toBe('done')           // preserved in TrackerState
    expect(state.stepStates[1]).toBe('done')        // R still green
  })

  it('ahead not eligible on last step — non-current face → wrong mode', () => {
    const lastSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW')]
    let state = makeInitialTrackerState(lastSteps)
    state = applyTrackerMove(state, lastSteps, move('L', 'CW'))  // advance to R
    // R is current (last step), no ahead step eligible
    state = applyTrackerMove(state, lastSteps, move('L', 'CW'))  // L is not ahead, should be wrong
    expect(state.trackingState).toBe('wrong')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: new tests FAIL — ahead moves currently enter wrong mode.

- [ ] **Step 3: Implement `applyAheadMove` helper**

Add this function to `src/hooks/useScrambleTracker.ts` before `applyTrackerMove`:

```ts
function applyAheadMove(state: TrackerState, steps: ScrambleStep[], move: PositionMove): TrackerState {
  const ahead = steps[state.currentStepIndex + 1]
  const delta = move.direction === 'CW' ? 1 : -1
  const newNet = state.aheadNetTurns + delta
  const net4 = ((newNet % 4) + 4) % 4
  const fulfilledNet4 = ahead.double ? 2 : (ahead.direction === 'CW' ? 1 : 3)
  // Preserve warning color for current step if trackingState is 'warning'
  const warningIndex = state.trackingState === 'warning' ? state.currentStepIndex : null

  if (net4 === fulfilledNet4) {
    return {
      ...state,
      aheadState: 'done',
      aheadNetTurns: newNet,
      stepStates: buildStepStates(steps, state.currentStepIndex, state.currentStepIndex, warningIndex, 'done'),
    }
  }
  if (net4 === 0) {
    return {
      ...state,
      aheadState: 'none',
      aheadNetTurns: 0,
      stepStates: buildStepStates(steps, state.currentStepIndex, state.currentStepIndex, warningIndex, 'none'),
    }
  }
  return {
    ...state,
    aheadState: 'warning',
    aheadNetTurns: newNet,
    stepStates: buildStepStates(steps, state.currentStepIndex, state.currentStepIndex, warningIndex, 'warning'),
  }
}
```

- [ ] **Step 4: Add ahead routing in scrambling state**

In `applyTrackerMove`, inside the `// Normal scrambling state` block, find the existing `if (move.face !== expected.face)` branch. After the undo checks and before the wrong-mode fallthrough, add:

```ts
// Ahead step check: only when face differs from current step (current has priority)
const aheadEligible =
  currentStepIndex + 1 < steps.length &&
  commutes(expected.face, steps[currentStepIndex + 1].face)
if (aheadEligible && move.face === steps[currentStepIndex + 1].face) {
  return applyAheadMove(state, steps, move)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: ahead step routing in scrambling state (Branch 1)"
```

---

## Task 4: Double ahead step

Verifies that `applyAheadMove` correctly handles double steps (R2 ahead of L).

**Files:**
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the `applyTrackerMove — ahead step (scrambling state)` describe block:

```ts
  it('double ahead step: first turn → warning, second turn → done', () => {
    // L current, R2 ahead (double)
    const doubleAheadSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW', true), step('D', 'CCW')]
    let state = makeInitialTrackerState(doubleAheadSteps)
    state = applyTrackerMove(state, doubleAheadSteps, move('R', 'CW'))  // first turn
    expect(state.aheadState).toBe('warning')
    expect(state.stepStates[1]).toBe('warning')
    state = applyTrackerMove(state, doubleAheadSteps, move('R', 'CW'))  // second turn → done
    expect(state.aheadState).toBe('done')
    expect(state.stepStates[1]).toBe('done')
    expect(state.currentStepIndex).toBe(0)  // L still current
  })

  it('double ahead step: CW then CCW → cancelled back to pending', () => {
    const doubleAheadSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW', true), step('D', 'CCW')]
    let state = makeInitialTrackerState(doubleAheadSteps)
    state = applyTrackerMove(state, doubleAheadSteps, move('R', 'CW'))   // net=1 → warning
    state = applyTrackerMove(state, doubleAheadSteps, move('R', 'CCW'))  // net=0 → none
    expect(state.aheadState).toBe('none')
    expect(state.stepStates[1]).toBe('pending')
  })
```

- [ ] **Step 2: Run tests to verify they pass (no new implementation needed)**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass — `applyAheadMove` already handles doubles via `fulfilledNet4 = 2`.

- [ ] **Step 3: Commit**

```bash
git add tests/hooks/useScrambleTracker.test.ts
git commit -m "test: double ahead step coverage"
```

---

## Task 5: Ahead routing from warning state

Branch 1 from warning state: the user can track the ahead step even while the current step is being corrected (in warning state).

**Files:**
- Modify: `src/hooks/useScrambleTracker.ts`
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/hooks/useScrambleTracker.test.ts`:

```ts
describe('applyTrackerMove — ahead step from warning state', () => {
  // L current, R ahead (commutes with L), D non-commuting
  const aheadSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW'), step('D', 'CCW')]

  it("L' (warning) then R (ahead done) — both active simultaneously", () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // L enters warning
    expect(state.trackingState).toBe('warning')
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // R done ahead
    expect(state.aheadState).toBe('done')
    expect(state.trackingState).toBe('warning')   // L still in warning
    expect(state.stepStates[0]).toBe('warning')   // L orange
    expect(state.stepStates[1]).toBe('done')      // R green
  })

  it("L' (warning) then R' (ahead warning) — both warning simultaneously", () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // L warning
    state = applyTrackerMove(state, aheadSteps, move('R', 'CCW'))  // R ahead warning
    expect(state.trackingState).toBe('warning')
    expect(state.aheadState).toBe('warning')
    expect(state.stepStates[0]).toBe('warning')   // L orange
    expect(state.stepStates[1]).toBe('warning')   // R orange
  })

  it('from warning: D (third face) → wrong mode, aheadState preserved', () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // L warning
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // R done ahead
    state = applyTrackerMove(state, aheadSteps, move('D', 'CW'))   // D wrong face → wrong
    expect(state.trackingState).toBe('wrong')
    expect(state.aheadState).toBe('done')         // R still tracked
    expect(state.stepStates[1]).toBe('done')      // R green preserved
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: FAIL — ahead moves from warning state currently enter wrong mode.

- [ ] **Step 3: Add ahead routing in warning state handler**

In `applyTrackerMove`, inside the `if (trackingState === 'warning')` block, find the line:
```ts
if (move.face !== expected.face) {
```

Add the ahead check before the wrong-mode return inside that block:

```ts
if (move.face !== expected.face) {
  // Ahead step check (same eligibility rule as in scrambling state)
  const aheadEligible =
    currentStepIndex + 1 < steps.length &&
    commutes(expected.face, steps[currentStepIndex + 1].face)
  if (aheadEligible && move.face === steps[currentStepIndex + 1].face) {
    return applyAheadMove(state, steps, move)
  }
  const delta = move.direction === 'CW' ? 1 : -1
  return {
    ...state,
    trackingState: 'wrong',
    wrongSegments: [{ face: move.face, netTurns: delta }],
    wrongFromWarning: true,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: ahead step routing in warning state (Branch 1 from warning)"
```

---

## Task 6: Branch 3 — advance by 2 when `aheadState === 'done'`

When the current step is fulfilled and the ahead step is already done, skip it and advance `currentStepIndex` by 2.

**Files:**
- Modify: `src/hooks/useScrambleTracker.ts`
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/hooks/useScrambleTracker.test.ts`:

```ts
describe('applyTrackerMove — Branch 3: advance by 2 when ahead done', () => {
  const aheadSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW'), step('D', 'CCW')]

  it('R done ahead then L done → skip to D (advance by 2)', () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))  // R done ahead
    state = applyTrackerMove(state, aheadSteps, move('L', 'CW'))  // L done → skip R
    expect(state.currentStepIndex).toBe(2)          // jumped to D
    expect(state.trackingState).toBe('scrambling')
    expect(state.aheadState).toBe('none')
    expect(state.stepStates[0]).toBe('done')        // L green
    expect(state.stepStates[1]).toBe('done')        // R green
    expect(state.stepStates[2]).toBe('current')     // D white
  })

  it('R done ahead then L done — armed when D is the only remaining step and was skipped', () => {
    // Steps: [L, R] only — R done ahead, then L done → armed
    const twoSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW')]
    let state = makeInitialTrackerState(twoSteps)
    state = applyTrackerMove(state, twoSteps, move('R', 'CW'))   // R done ahead
    state = applyTrackerMove(state, twoSteps, move('L', 'CW'))   // L done → skip R → armed
    expect(state.trackingState).toBe('armed')
    expect(state.currentStepIndex).toBe(2)
    expect(state.stepStates[0]).toBe('done')
    expect(state.stepStates[1]).toBe('done')
  })

  it('R done ahead then L fulfilled via warning → also skips to D', () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // R done ahead
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // L wrong dir → warning
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // L net=-2
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // L net=-3 ≡ +1 → fulfilled
    expect(state.currentStepIndex).toBe(2)
    expect(state.trackingState).toBe('scrambling')
    expect(state.aheadState).toBe('none')
    expect(state.stepStates[2]).toBe('current')     // D white
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: FAIL — current fulfillment only advances by 1.

- [ ] **Step 3: Implement Branch 3 in the scrambling state single-move fulfillment**

In `applyTrackerMove`, inside the `// Single move` → `if (move.direction === expected.direction)` block, replace the existing return with:

```ts
if (move.direction === expected.direction) {
  const nextIndex = currentStepIndex + 1
  const isArmed = nextIndex >= steps.length

  if (state.aheadState === 'done') {
    const skipIndex = currentStepIndex + 2
    const isArmedAfterSkip = skipIndex >= steps.length
    return {
      ...state,
      trackingState: isArmedAfterSkip ? 'armed' : 'scrambling',
      stepStates: buildStepStates(steps, skipIndex, skipIndex, null, 'none'),
      currentStepIndex: skipIndex,
      aheadState: 'none',
      aheadNetTurns: 0,
    }
  }

  return {
    ...state,
    trackingState: isArmed ? 'armed' : 'scrambling',
    stepStates: buildStepStates(steps, nextIndex, nextIndex, null, 'none'),
    currentStepIndex: nextIndex,
    aheadState: 'none',
    aheadNetTurns: 0,
  }
}
```

- [ ] **Step 4: Implement Branch 3 in the warning state fulfillment**

In `applyTrackerMove`, inside the `if (trackingState === 'warning')` block, find the `if (net4 === fulfilledNet4)` fulfillment. Replace its return with:

```ts
if (net4 === fulfilledNet4) {
  const nextIndex = currentStepIndex + 1
  const isArmed = nextIndex >= steps.length

  if (state.aheadState === 'done') {
    const skipIndex = currentStepIndex + 2
    const isArmedAfterSkip = skipIndex >= steps.length
    return {
      ...state,
      trackingState: isArmedAfterSkip ? 'armed' : 'scrambling',
      stepStates: buildStepStates(steps, skipIndex, skipIndex, null, 'none'),
      currentStepIndex: skipIndex,
      wrongSegments: [],
      warningNetTurns: 0,
      aheadState: 'none',
      aheadNetTurns: 0,
    }
  }

  return {
    ...state,
    trackingState: isArmed ? 'armed' : 'scrambling',
    stepStates: buildStepStates(steps, nextIndex, nextIndex, null, 'none'),
    currentStepIndex: nextIndex,
    wrongSegments: [],
    warningNetTurns: 0,
    aheadState: 'none',
    aheadNetTurns: 0,
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: advance by 2 when ahead step is done (Branch 3)"
```

---

## Task 7: Branch 2 sub-case — transfer ahead warning on fulfillment

When the current step is fulfilled while the ahead step is in warning state, the ahead step seamlessly becomes the new current step in warning state.

**Files:**
- Modify: `src/hooks/useScrambleTracker.ts`
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/hooks/useScrambleTracker.test.ts`:

```ts
describe('applyTrackerMove — Branch 2 sub-case: ahead warning transfers to current warning', () => {
  const aheadSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW'), step('D', 'CCW')]

  it("R' (ahead warning) then L done → R becomes current in warning", () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CCW'))  // R ahead warning, aheadNetTurns=-1
    state = applyTrackerMove(state, aheadSteps, move('L', 'CW'))   // L done → R becomes current
    expect(state.currentStepIndex).toBe(1)          // now at R
    expect(state.trackingState).toBe('warning')     // R in warning
    expect(state.warningNetTurns).toBe(-1)          // transferred from aheadNetTurns
    expect(state.aheadState).toBe('none')
    expect(state.aheadNetTurns).toBe(0)
    expect(state.stepStates[0]).toBe('done')        // L green
    expect(state.stepStates[1]).toBe('warning')     // R orange
    expect(state.stepStates[2]).toBe('pending')     // D gray
  })

  it("R' (ahead warning) then L fulfilled via warning → R still becomes current in warning", () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CCW'))  // R ahead warning, net=-1
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // L wrong dir → L warning
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // net=-2
    state = applyTrackerMove(state, aheadSteps, move('L', 'CCW'))  // net=-3 ≡ +1 → L fulfilled
    expect(state.currentStepIndex).toBe(1)
    expect(state.trackingState).toBe('warning')     // R in warning (transferred)
    expect(state.warningNetTurns).toBe(-1)
    expect(state.aheadState).toBe('none')
  })

  it('after transfer, user can fix R by doing R (net cancels → pending)', () => {
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CCW'))  // R ahead warning, net=-1
    state = applyTrackerMove(state, aheadSteps, move('L', 'CW'))   // L done → R current in warning
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // R: net=-1+1=0 → cancel
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(1)
    expect(state.stepStates[1]).toBe('current')     // R back to white
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: FAIL — current fulfillment with `aheadState === 'warning'` currently ignores the ahead warning.

- [ ] **Step 3: Implement Branch 2 sub-case in scrambling state single-move fulfillment**

In the `if (move.direction === expected.direction)` block updated in Task 6, add the `aheadState === 'warning'` branch between the `aheadState === 'done'` check and the default return:

```ts
if (move.direction === expected.direction) {
  const nextIndex = currentStepIndex + 1
  const isArmed = nextIndex >= steps.length

  if (state.aheadState === 'done') {
    const skipIndex = currentStepIndex + 2
    const isArmedAfterSkip = skipIndex >= steps.length
    return {
      ...state,
      trackingState: isArmedAfterSkip ? 'armed' : 'scrambling',
      stepStates: buildStepStates(steps, skipIndex, skipIndex, null, 'none'),
      currentStepIndex: skipIndex,
      aheadState: 'none',
      aheadNetTurns: 0,
    }
  }

  if (state.aheadState === 'warning' && !isArmed) {
    return {
      ...state,
      trackingState: 'warning',
      stepStates: buildStepStates(steps, nextIndex, nextIndex, nextIndex, 'none'),
      currentStepIndex: nextIndex,
      warningNetTurns: state.aheadNetTurns,
      aheadState: 'none',
      aheadNetTurns: 0,
    }
  }

  return {
    ...state,
    trackingState: isArmed ? 'armed' : 'scrambling',
    stepStates: buildStepStates(steps, nextIndex, nextIndex, null, 'none'),
    currentStepIndex: nextIndex,
    aheadState: 'none',
    aheadNetTurns: 0,
  }
}
```

- [ ] **Step 4: Implement Branch 2 sub-case in warning state fulfillment**

In the `if (net4 === fulfilledNet4)` block updated in Task 6, add the same `aheadState === 'warning'` branch between the `aheadState === 'done'` check and the default return:

```ts
if (state.aheadState === 'warning' && !isArmed) {
  return {
    ...state,
    trackingState: 'warning',
    stepStates: buildStepStates(steps, nextIndex, nextIndex, nextIndex, 'none'),
    currentStepIndex: nextIndex,
    wrongSegments: [],
    warningNetTurns: state.aheadNetTurns,
    aheadState: 'none',
    aheadNetTurns: 0,
  }
}
```

- [ ] **Step 5: Run all tests to verify they pass**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: transfer ahead warning to current warning on fulfillment (Branch 2 sub-case)"
```

---

## Task 8: Edge case tests

Verify the bounds guard, same-face sequences, and wrong-mode behavior with ahead active all behave correctly. No new implementation expected — these tests should pass with existing code.

**Files:**
- Test: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Write the edge case tests**

Add to `tests/hooks/useScrambleTracker.test.ts`:

```ts
describe('applyTrackerMove — ahead edge cases', () => {
  it('same-face sequence [R, R]: second R does not trigger ahead, advances current', () => {
    const sameSteps: ScrambleStep[] = [step('R', 'CW'), step('R', 'CW'), step('U', 'CW')]
    let state = makeInitialTrackerState(sameSteps)
    // R is current, next R does NOT commute with R (same face) — should process as current
    state = applyTrackerMove(state, sameSteps, move('R', 'CW'))
    expect(state.currentStepIndex).toBe(1)          // advanced to second R
    expect(state.trackingState).toBe('scrambling')
    expect(state.aheadState).toBe('none')           // no ahead triggered
  })

  it('last step is current: non-current face → wrong mode (no ahead eligible)', () => {
    const lastSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW')]
    let state = makeInitialTrackerState(lastSteps)
    state = applyTrackerMove(state, lastSteps, move('L', 'CW'))  // advance to R (last step)
    expect(state.currentStepIndex).toBe(1)
    // R is the last step, no ahead eligible
    state = applyTrackerMove(state, lastSteps, move('L', 'CW'))  // L after R — wrong, not ahead
    expect(state.trackingState).toBe('wrong')
  })

  it('slice-adjacent sequence [M, L]: M face → wrong mode (M not in Face type, not ahead)', () => {
    // ScrambleStep uses Face only, not slices; but PositionMove can carry slice faces.
    // A move on a slice face with L current → wrong mode.
    const sliceAdjSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW')]
    let state = makeInitialTrackerState(sliceAdjSteps)
    // commutes('L', 'R') = true, but move face M ≠ steps[1].face R → no ahead routing
    state = applyTrackerMove(state, sliceAdjSteps, { face: 'M', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(state.trackingState).toBe('wrong')
    expect(state.aheadState).toBe('none')
  })

  it('wrong mode preserves aheadState; cancelling wrong returns aheadState intact', () => {
    const aheadSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW'), step('D', 'CCW')]
    let state = makeInitialTrackerState(aheadSteps)
    state = applyTrackerMove(state, aheadSteps, move('R', 'CW'))   // R done ahead
    state = applyTrackerMove(state, aheadSteps, move('D', 'CW'))   // D → wrong mode
    expect(state.trackingState).toBe('wrong')
    expect(state.aheadState).toBe('done')            // preserved through wrong mode
    state = applyTrackerMove(state, aheadSteps, move('D', 'CCW'))  // cancel D → back to scrambling
    expect(state.trackingState).toBe('scrambling')
    expect(state.aheadState).toBe('done')            // still intact
    expect(state.stepStates[1]).toBe('done')         // R still green
  })
})
```

- [ ] **Step 2: Run tests to verify they pass (no new implementation needed)**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/hooks/useScrambleTracker.test.ts
git commit -m "test: edge case coverage for commutative ahead execution"
```

# Scramble Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the user to undo completed scramble steps by performing the inverse move while in `scrambling` state, with no new state fields required.

**Architecture:** Add a single undo-check branch inside the `scrambling` case of `applyTrackerMove`. For single steps, immediately decrement `currentStepIndex`. For double steps, pre-decrement `currentStepIndex` and enter warning with `warningNetTurns = 2` — the existing warning resolution then handles undo/re-complete naturally.

**Tech Stack:** TypeScript, Vitest

---

## Files

- Modify: `src/hooks/useScrambleTracker.ts` — add undo branch in `applyTrackerMove`
- Modify: `tests/hooks/useScrambleTracker.test.ts` — add undo test cases

---

### Task 1: Single-step undo tests (failing)

**Files:**
- Modify: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Add failing tests for single-step undo**

Append this new `describe` block to the end of `tests/hooks/useScrambleTracker.test.ts`:

```ts
describe('applyTrackerMove — single-step undo', () => {
  const undoSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW'), step('D', 'CCW')]

  function advanceTo(index: number): ReturnType<typeof makeInitialTrackerState> {
    let state = makeInitialTrackerState(undoSteps)
    if (index >= 1) state = applyTrackerMove(state, undoSteps, move('L', 'CW'))
    if (index >= 2) state = applyTrackerMove(state, undoSteps, move('R', 'CW'))
    return state
  }

  it('inverse of last CW step → undo: step back to white, next step to gray', () => {
    let state = advanceTo(2)  // L done, R done, D is current
    expect(state.currentStepIndex).toBe(2)
    state = applyTrackerMove(state, undoSteps, move('R', 'CCW'))  // R' undoes R
    expect(state.currentStepIndex).toBe(1)
    expect(state.trackingState).toBe('scrambling')
    expect(state.stepStates[0]).toBe('done')    // L still green
    expect(state.stepStates[1]).toBe('current') // R now white
    expect(state.stepStates[2]).toBe('pending') // D now gray
  })

  it('inverse of last CCW step → undo', () => {
    let state = advanceTo(2)  // L done, R done, D is current (CCW)
    state = applyTrackerMove(state, undoSteps, move('R', 'CCW'))  // undo R
    state = applyTrackerMove(state, undoSteps, move('L', 'CCW'))  // L' undoes L
    expect(state.currentStepIndex).toBe(0)
    expect(state.trackingState).toBe('scrambling')
    expect(state.stepStates[0]).toBe('current') // L now white
    expect(state.stepStates[1]).toBe('pending') // R now gray
  })

  it('chained undo — multiple steps in sequence', () => {
    let state = advanceTo(2)  // L done, R done
    state = applyTrackerMove(state, undoSteps, move('R', 'CCW'))  // undo R → index=1
    state = applyTrackerMove(state, undoSteps, move('L', 'CCW'))  // undo L → index=0
    expect(state.currentStepIndex).toBe(0)
    expect(state.stepStates[0]).toBe('current')
    expect(state.stepStates[1]).toBe('pending')
    expect(state.stepStates[2]).toBe('pending')
  })

  it('undo then redo — proceeds forward normally', () => {
    let state = advanceTo(2)  // L done, R done
    state = applyTrackerMove(state, undoSteps, move('R', 'CCW'))  // undo R → index=1
    state = applyTrackerMove(state, undoSteps, move('R', 'CW'))   // redo R → index=2
    expect(state.currentStepIndex).toBe(2)
    expect(state.stepStates[0]).toBe('done')
    expect(state.stepStates[1]).toBe('done')
    expect(state.stepStates[2]).toBe('current')
  })

  it('nothing to undo at index 0 → warning on current step (not undo)', () => {
    let state = makeInitialTrackerState(undoSteps)  // index=0, L is current
    // L' is the inverse of L, but nothing to undo — treated as wrong direction on current step
    state = applyTrackerMove(state, undoSteps, move('L', 'CCW'))
    expect(state.trackingState).toBe('warning')  // wrong direction for L CW → warning
    expect(state.currentStepIndex).toBe(0)
  })

  it('same direction as previous step (not inverse) → wrong state', () => {
    let state = advanceTo(1)  // L done, R is current
    // Doing L again (same direction as completed L) is not an undo
    state = applyTrackerMove(state, undoSteps, move('L', 'CW'))
    expect(state.trackingState).toBe('wrong')
    expect(state.wrongSegments).toEqual([{ face: 'L', netTurns: 1 }])
  })

  it('armed state — undo-like move is ignored', () => {
    const singleStep: ScrambleStep[] = [step('R', 'CW')]
    let state = makeInitialTrackerState(singleStep)
    state = applyTrackerMove(state, singleStep, move('R', 'CW'))  // complete → armed
    expect(state.trackingState).toBe('armed')
    state = applyTrackerMove(state, singleStep, move('R', 'CCW'))  // R' — ignored
    expect(state.trackingState).toBe('armed')
    expect(state.currentStepIndex).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- tests/hooks/useScrambleTracker.test.ts
```

Expected: new tests fail (undo logic not yet implemented). Existing tests still pass.

---

### Task 2: Double-step undo tests (failing)

**Files:**
- Modify: `tests/hooks/useScrambleTracker.test.ts`

- [ ] **Step 1: Add failing tests for double-step undo**

Append this new `describe` block after the single-step undo block:

```ts
describe('applyTrackerMove — double-step undo', () => {
  const doubleUndoSteps: ScrambleStep[] = [step('L', 'CW'), step('U', 'CW', true), step('D', 'CW')]

  function advancePastDouble(): ReturnType<typeof makeInitialTrackerState> {
    let state = makeInitialTrackerState(doubleUndoSteps)
    state = applyTrackerMove(state, doubleUndoSteps, move('L', 'CW'))   // L done
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))   // U2 first turn → warning
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))   // U2 second turn → done
    expect(state.currentStepIndex).toBe(2)
    return state
  }

  it('first undo turn → previous double step turns to warning (orange)', () => {
    let state = advancePastDouble()
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))  // trigger undo-warning
    expect(state.trackingState).toBe('warning')
    expect(state.currentStepIndex).toBe(1)
    expect(state.warningNetTurns).toBe(2)
    expect(state.stepStates[0]).toBe('done')    // L still green
    expect(state.stepStates[1]).toBe('warning') // U2 now orange
    expect(state.stepStates[2]).toBe('pending') // D now gray
  })

  it('CW + CW → undo confirmed (white)', () => {
    let state = advancePastDouble()
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))  // undo-warning, net=3
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))  // net=4 → net4=0 → cancel → undo
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(1)
    expect(state.stepStates[1]).toBe('current') // U2 now white
    expect(state.stepStates[2]).toBe('pending') // D gray
  })

  it('CW + CCW → re-complete (green)', () => {
    let state = advancePastDouble()
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))   // undo-warning, net=3
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CCW'))  // net=2 → net4=2 → advance → re-complete
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(2)
    expect(state.stepStates[1]).toBe('done')    // U2 back to green
    expect(state.stepStates[2]).toBe('current') // D back to white
  })

  it('CCW + CCW → undo confirmed (white)', () => {
    let state = advancePastDouble()
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CCW'))  // undo-warning, net=1
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CCW'))  // net=0 → net4=0 → undo
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(1)
    expect(state.stepStates[1]).toBe('current')
  })

  it('CCW + CW → re-complete (green)', () => {
    let state = advancePastDouble()
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CCW'))  // undo-warning, net=1
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))   // net=2 → re-complete
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(2)
    expect(state.stepStates[1]).toBe('done')
  })

  it('undo double then wrong face → wrong state; cancel → back to undo-warning', () => {
    let state = advancePastDouble()
    state = applyTrackerMove(state, doubleUndoSteps, move('U', 'CW'))   // undo-warning, net=3
    state = applyTrackerMove(state, doubleUndoSteps, move('F', 'CW'))   // wrong face → wrong
    expect(state.trackingState).toBe('wrong')
    expect(state.wrongFromWarning).toBe(true)
    state = applyTrackerMove(state, doubleUndoSteps, move('F', 'CCW'))  // cancel wrong → back to warning
    expect(state.trackingState).toBe('warning')
    expect(state.currentStepIndex).toBe(1)
    expect(state.warningNetTurns).toBe(3)  // preserved
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- tests/hooks/useScrambleTracker.test.ts
```

Expected: new double-step undo tests fail. All prior tests still pass.

---

### Task 3: Implement undo logic

**Files:**
- Modify: `src/hooks/useScrambleTracker.ts`

- [ ] **Step 1: Add the undo branch in `applyTrackerMove`**

In `src/hooks/useScrambleTracker.ts`, find the `// Normal scrambling state` section (around line 137). It currently looks like:

```ts
  // Normal scrambling state
  if (move.face !== expected.face) {
    const delta = move.direction === 'CW' ? 1 : -1
    return {
      ...state,
      trackingState: 'wrong',
      wrongSegments: [{ face: move.face, netTurns: delta }],
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
    }
  }
```

Replace it with:

```ts
  // Normal scrambling state
  if (move.face !== expected.face) {
    if (currentStepIndex > 0 && move.face === steps[currentStepIndex - 1].face) {
      const prevStep = steps[currentStepIndex - 1]
      const newIndex = currentStepIndex - 1
      if (prevStep.double) {
        return {
          ...state,
          trackingState: 'warning',
          currentStepIndex: newIndex,
          warningNetTurns: 2,
          stepStates: buildStepStates(steps, newIndex, newIndex, newIndex),
        }
      }
      if (move.direction !== prevStep.direction) {
        return {
          ...state,
          currentStepIndex: newIndex,
          stepStates: buildStepStates(steps, newIndex, newIndex, null),
        }
      }
    }
    const delta = move.direction === 'CW' ? 1 : -1
    return {
      ...state,
      trackingState: 'wrong',
      wrongSegments: [{ face: move.face, netTurns: delta }],
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
    }
  }
```

- [ ] **Step 2: Run all tests**

```bash
npm run test -- tests/hooks/useScrambleTracker.test.ts
```

Expected: all tests pass, including the new undo tests.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: scramble undo — inverse move walks back completed steps"
```

# Scramble Undo — Design Spec

## Summary

Allow the user to undo completed scramble steps by performing the inverse move while in `scrambling` state. Works for both single and double moves. No new state fields required.

---

## Scope

- Undo is only available in `scrambling` state
- Undo is not available in `warning`, `wrong`, or `armed` states
- Multiple consecutive undos are allowed (chain back through any number of completed steps)
- `currentStepIndex === 0`: nothing to undo, move falls through to wrong state as usual
- `armed` (scramble fully complete): existing early return ignores all moves, no undo

---

## State Changes

None. No new fields in `TrackerState`.

---

## Logic Change: `applyTrackerMove` — scrambling state only

Add one new branch **before** the existing "wrong face" path:

```
condition:
  move.face !== expected.face       // not the current step's face
  && currentStepIndex > 0           // something to undo
  && move.face === steps[currentStepIndex - 1].face   // matches previous step's face
```

### Single-step undo

```
prevStep = steps[currentStepIndex - 1]

if !prevStep.double && move.direction !== prevStep.direction:
  // inverse direction → undo
  newIndex = currentStepIndex - 1
  → currentStepIndex = newIndex
  → trackingState = 'scrambling'
  → stepStates = buildStepStates(steps, newIndex, newIndex, null)

else if !prevStep.double && move.direction === prevStep.direction:
  // same direction (not inverse) → fall through to wrong state
```

Example: last completed step is R (CW). Doing R' (CCW) undoes it immediately — R goes from green to white, next step goes gray.

### Double-step undo

```
if prevStep.double:
  newIndex = currentStepIndex - 1
  → currentStepIndex = newIndex        // pre-decrement
  → trackingState = 'warning'
  → warningNetTurns = 2                // key: start at 2, not ±1
  → stepStates = buildStepStates(steps, newIndex, newIndex, newIndex)
```

Starting `warningNetTurns = 2` (instead of the normal ±1 seed) causes the existing warning
resolution to produce the correct undo semantics with zero code changes to the warning branch:

| Sequence | Net after 2nd move | net4 | Existing resolution | Result |
|---|---|---|---|---|
| U then U  | 2+1+1 = 4 | 0 | cancel → stay at newIndex | undo (white) ✓ |
| U then U' | 2+1-1 = 2 | 2 | advance → newIndex+1 | re-complete (green) ✓ |
| U' then U' | 2-1-1 = 0 | 0 | cancel → stay at newIndex | undo (white) ✓ |
| U' then U  | 2-1+1 = 2 | 2 | advance → newIndex+1 | re-complete (green) ✓ |

Face tracking in warning state also works automatically: after pre-decrement,
`expected = steps[currentStepIndex]` is the step being undone (correct face).

Wrong-from-warning also works: if user does a wrong-face move mid-undo, `wrongFromWarning = true`
restores to warning on the correct (pre-decremented) step when wrong is cancelled.

---

## Visual Behavior Summary

| Situation | Step color |
|---|---|
| Undo trigger fires (single) | Step instantly turns white |
| Undo trigger fires (double, first move) | Step turns orange |
| Double undo confirmed (net4=0) | Step turns white |
| Double undo cancelled / re-complete (net4=2) | Step turns green |

---

## Unchanged

- `warning` state resolution: no changes
- `wrong` state: no changes
- `armed` state: no changes
- `TrackerState` fields: no additions
- `makeInitialTrackerState`: no changes
- `ScrambleDisplay`: no changes (colors and step states already driven by `stepStates` array)

---

## Edge Cases

| Case | Behavior |
|---|---|
| `currentStepIndex === 0` | Undo check not reached; move treated as wrong |
| `armed` state | Early return; all moves including undo-like moves ignored |
| Current step face == previous step face | `move.face !== expected.face` is false; undo check skipped; forward takes priority |
| Undo mid-double-undo (wrong face) | `wrongFromWarning = true`; cancelling wrong restores undo-warning on previous step |

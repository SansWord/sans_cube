import { describe, it, expect } from 'vitest'
import { applyTrackerMove, makeInitialTrackerState, commutes } from '../../src/hooks/useScrambleTracker'
import type { ScrambleStep } from '../../src/types/solve'
import type { PositionMove } from '../../src/types/cube'

function step(face: PositionMove['face'], direction: PositionMove['direction'], double = false): ScrambleStep {
  return { face, direction, double }
}

function move(face: PositionMove['face'], direction: PositionMove['direction'] = 'CW'): PositionMove {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

const steps: ScrambleStep[] = [step('R', 'CW'), step('U', 'CCW'), step('F', 'CW', true)]

describe('applyTrackerMove — single CW step', () => {
  it('correct move → done, advance', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CW'))
    expect(state.stepStates[0]).toBe('done')
    expect(state.currentStepIndex).toBe(1)
    expect(state.trackingState).toBe('scrambling')
  })

  it('wrong direction → warning', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CCW'))
    expect(state.stepStates[0]).toBe('warning')
    expect(state.trackingState).toBe('warning')
    expect(state.currentStepIndex).toBe(0)
  })

  it('from warning: correct direction cancels wrong move, then correct again advances', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // warning, net=-1
    state = applyTrackerMove(state, steps, move('R', 'CW'))   // net=0 → cancelled, back to scrambling
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(0)
    state = applyTrackerMove(state, steps, move('R', 'CW'))   // correct in scrambling → done
    expect(state.stepStates[0]).toBe('done')
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(1)
  })

  it('3x wrong direction = net correct rotation → advance', () => {
    let state = makeInitialTrackerState(steps)
    // Expecting R CW. 3x CCW = net -3 ≡ +1 mod 4 → fulfilled
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // net=-1
    expect(state.trackingState).toBe('warning')
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // net=-2
    expect(state.trackingState).toBe('warning')
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // net=-3 ≡ +1 → done
    expect(state.stepStates[0]).toBe('done')
    expect(state.currentStepIndex).toBe(1)
  })

  it('2x wrong direction stays in warning', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // net=-1
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // net=-2
    expect(state.trackingState).toBe('warning')
    expect(state.currentStepIndex).toBe(0)
  })

  it('from warning: wrong face → wrong, then undo → back to warning', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // warning, net=-1
    expect(state.trackingState).toBe('warning')
    state = applyTrackerMove(state, steps, move('U', 'CW'))   // wrong face → wrong
    expect(state.trackingState).toBe('wrong')
    expect(state.wrongSegments).toEqual([{ face: 'U', netTurns: 1 }])
    expect(state.warningNetTurns).toBe(-1)  // preserved
    state = applyTrackerMove(state, steps, move('U', 'CCW'))  // undo wrong → back to warning
    expect(state.trackingState).toBe('warning')
    expect(state.warningNetTurns).toBe(-1)  // still preserved
    expect(state.currentStepIndex).toBe(0)
  })

  it('wrong face → wrong state', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('U', 'CW'))
    expect(state.trackingState).toBe('wrong')
    expect(state.wrongSegments).toEqual([{ face: 'U', netTurns: 1 }])
  })

  it('from wrong: reverse move → back to scrambling', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('U', 'CW'))   // wrong
    state = applyTrackerMove(state, steps, move('U', 'CCW'))  // undo
    expect(state.trackingState).toBe('scrambling')
    expect(state.wrongSegments).toEqual([])
    expect(state.currentStepIndex).toBe(0)
  })

  it('same face in wrong mode accumulates net turns: U×4 exits wrong mode', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('U', 'CW'))  // net=1
    expect(state.wrongSegments).toEqual([{ face: 'U', netTurns: 1 }])
    state = applyTrackerMove(state, steps, move('U', 'CW'))  // net=2
    expect(state.wrongSegments).toEqual([{ face: 'U', netTurns: 2 }])
    state = applyTrackerMove(state, steps, move('U', 'CW'))  // net=3
    expect(state.wrongSegments).toEqual([{ face: 'U', netTurns: 3 }])
    expect(state.trackingState).toBe('wrong')
    state = applyTrackerMove(state, steps, move('U', 'CW'))  // net=4≡0 → exits
    expect(state.trackingState).toBe('scrambling')
    expect(state.wrongSegments).toEqual([])
  })

  it('multiple wrong faces stack; cancelling in reverse order exits wrong mode', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('U', 'CW'))   // segments=[{U,1}]
    state = applyTrackerMove(state, steps, move('F', 'CCW'))  // segments=[{U,1},{F,-1}]
    expect(state.trackingState).toBe('wrong')
    expect(state.wrongSegments).toHaveLength(2)
    state = applyTrackerMove(state, steps, move('F', 'CW'))   // cancels F: segments=[{U,1}]
    expect(state.trackingState).toBe('wrong')
    expect(state.wrongSegments).toHaveLength(1)
    state = applyTrackerMove(state, steps, move('U', 'CCW'))  // cancels U: segments=[]
    expect(state.trackingState).toBe('scrambling')
    expect(state.wrongSegments).toEqual([])
  })
})

describe('applyTrackerMove — double step (F2)', () => {
  const doubleSteps: ScrambleStep[] = [step('F', 'CW', true)]

  it('first CW turn → warning, no advance', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    expect(state.trackingState).toBe('warning')
    expect(state.currentStepIndex).toBe(0)
    expect(state.warningNetTurns).toBe(1)
  })

  it('second same-direction CW turn → done', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    expect(state.stepStates[0]).toBe('done')
    expect(state.currentStepIndex).toBe(1)
  })

  it('CCW then CCW → also done (both directions valid for double)', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CCW'))
    state = applyTrackerMove(state, doubleSteps, move('F', 'CCW'))
    expect(state.stepStates[0]).toBe('done')
  })

  it('opposite direction second turn → net 0, back to scrambling', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    state = applyTrackerMove(state, doubleSteps, move('F', 'CCW'))
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(0)
    expect(state.warningNetTurns).toBe(0)
  })

  it('CW then CCW → net 0, back to scrambling', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))   // net=1 → warning
    state = applyTrackerMove(state, doubleSteps, move('F', 'CCW'))  // net=0 → cancelled
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(0)
    expect(state.warningNetTurns).toBe(0)
  })
})

describe('applyTrackerMove — all done → armed', () => {
  it('completing last step sets trackingState to armed', () => {
    const singleStep: ScrambleStep[] = [step('R', 'CW')]
    let state = makeInitialTrackerState(singleStep)
    state = applyTrackerMove(state, singleStep, move('R', 'CW'))
    expect(state.trackingState).toBe('armed')
  })
})

describe('applyTrackerMove — single-step undo', () => {
  const undoSteps: ScrambleStep[] = [step('L', 'CW'), step('R', 'CW'), step('D', 'CCW')]

  function advanceTo(index: number): ReturnType<typeof makeInitialTrackerState> {
    // valid for index 0..2 (matches length of undoSteps)
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
    const ccwSteps: ScrambleStep[] = [step('L', 'CW'), step('D', 'CCW'), step('R', 'CW')]
    let state = makeInitialTrackerState(ccwSteps)
    state = applyTrackerMove(state, ccwSteps, move('L', 'CW'))   // L done
    state = applyTrackerMove(state, ccwSteps, move('D', 'CCW'))  // D done (CCW)
    expect(state.currentStepIndex).toBe(2)
    // D CW is inverse of D CCW → undo
    state = applyTrackerMove(state, ccwSteps, move('D', 'CW'))
    expect(state.currentStepIndex).toBe(1)
    expect(state.trackingState).toBe('scrambling')
    expect(state.stepStates[0]).toBe('done')    // L still green
    expect(state.stepStates[1]).toBe('current') // D now white
    expect(state.stepStates[2]).toBe('pending') // R now gray
  })

  it('chained undo — multiple steps in sequence', () => {
    let state = advanceTo(2)  // L done, R done
    state = applyTrackerMove(state, undoSteps, move('R', 'CCW'))  // undo R → index=1
    state = applyTrackerMove(state, undoSteps, move('L', 'CCW'))  // undo L → index=0
    expect(state.currentStepIndex).toBe(0)
    expect(state.stepStates[0]).toBe('current')
    expect(state.stepStates[1]).toBe('pending')
    expect(state.stepStates[2]).toBe('pending')
    expect(state.trackingState).toBe('scrambling')
  })

  it('undo then redo — proceeds forward normally', () => {
    let state = advanceTo(2)  // L done, R done
    state = applyTrackerMove(state, undoSteps, move('R', 'CCW'))  // undo R → index=1
    state = applyTrackerMove(state, undoSteps, move('R', 'CW'))   // redo R → index=2
    expect(state.currentStepIndex).toBe(2)
    expect(state.stepStates[0]).toBe('done')
    expect(state.stepStates[1]).toBe('done')
    expect(state.stepStates[2]).toBe('current')
    expect(state.trackingState).toBe('scrambling')
  })

  it('nothing to undo at index 0 → warning on current step (not undo)', () => {
    let state = makeInitialTrackerState(undoSteps)  // index=0, L is current
    // L' is the inverse of L, but nothing to undo — treated as wrong direction on current step
    state = applyTrackerMove(state, undoSteps, move('L', 'CCW'))
    expect(state.trackingState).toBe('warning')  // wrong direction for L CW → warning
    expect(state.currentStepIndex).toBe(0)
    expect(state.stepStates[0]).toBe('warning')
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
    expect(state.warningNetTurns).toBe(3)
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
    expect(state.stepStates[2]).toBe('pending')
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

describe('makeInitialTrackerState — aheadState fields', () => {
  it('initializes aheadState to none and aheadNetTurns to 0', () => {
    const state = makeInitialTrackerState(steps)
    expect(state.aheadState).toBe('none')
    expect(state.aheadNetTurns).toBe(0)
  })
})

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
    expect(state.aheadNetTurns).toBe(-1)
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
})

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

  it('R done ahead then L done — armed when R is last step', () => {
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

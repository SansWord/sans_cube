import { describe, it, expect } from 'vitest'
import { applyTrackerMove, makeInitialTrackerState } from '../../src/hooks/useScrambleTracker'
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
    expect(state.stepStates[2]).toBe('current')
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

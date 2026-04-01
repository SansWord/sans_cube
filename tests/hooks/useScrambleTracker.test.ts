import { describe, it, expect } from 'vitest'
import { applyTrackerMove, makeInitialTrackerState } from '../../src/hooks/useScrambleTracker'
import type { ScrambleStep } from '../../src/types/solve'
import type { Move } from '../../src/types/cube'

function step(face: Move['face'], direction: Move['direction'], double = false): ScrambleStep {
  return { face, direction, double }
}

function move(face: Move['face'], direction: Move['direction'] = 'CW'): Move {
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

import { useState, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move } from '../types/cube'
import { useCubeDriverEvent } from './useCubeDriverEvent'
import type { ScrambleStep } from '../types/solve'

export type StepState = 'done' | 'current' | 'pending' | 'warning'
export type TrackingState = 'scrambling' | 'warning' | 'wrong' | 'armed'

export interface WrongSegment {
  face: Move['face']
  netTurns: number  // positive = net CW, negative = net CCW; mod-4 encodes cancellation
}

export interface TrackerState {
  stepStates: StepState[]
  trackingState: TrackingState
  wrongSegments: WrongSegment[]  // stack of face segments; reverse cancels all wrong-doing
  currentStepIndex: number
  warningNetTurns: number        // net CW(+1)/CCW(-1) count while in warning state
  wrongFromWarning: boolean      // whether wrong state was entered from warning
}

export function makeInitialTrackerState(steps: ScrambleStep[]): TrackerState {
  return {
    stepStates: steps.map((_, i) => (i === 0 ? 'current' : 'pending')),
    trackingState: steps.length === 0 ? 'armed' : 'scrambling',
    wrongSegments: [],
    currentStepIndex: 0,
    warningNetTurns: 0,
    wrongFromWarning: false,
  }
}

function buildStepStates(steps: ScrambleStep[], doneCount: number, currentIndex: number, warningIndex: number | null): StepState[] {
  return steps.map((_, i) => {
    if (i < doneCount) return 'done'
    if (warningIndex !== null && i === warningIndex) return 'warning'
    if (i === currentIndex) return 'current'
    return 'pending'
  })
}

function exitWrongMode(state: TrackerState, steps: ScrambleStep[]): TrackerState {
  const { currentStepIndex, wrongFromWarning } = state
  if (wrongFromWarning) {
    return {
      ...state,
      trackingState: 'warning',
      wrongSegments: [],
      wrongFromWarning: false,
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex),
    }
  }
  return {
    ...state,
    trackingState: 'scrambling',
    wrongSegments: [],
    wrongFromWarning: false,
    stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
  }
}

export function applyTrackerMove(state: TrackerState, steps: ScrambleStep[], move: Move): TrackerState {
  const { trackingState, currentStepIndex, wrongSegments } = state

  // Armed: scramble done, ignore further moves
  if (trackingState === 'armed') return state

  // Wrong state: same-face moves accumulate net turns on the top segment;
  // different face pushes a new segment. Segment at net≡0 pops itself.
  if (trackingState === 'wrong') {
    const top = wrongSegments[wrongSegments.length - 1]
    const delta = move.direction === 'CW' ? 1 : -1

    if (top && move.face === top.face) {
      const newNet = top.netTurns + delta
      const net4 = ((newNet % 4) + 4) % 4
      if (net4 === 0) {
        const remaining = wrongSegments.slice(0, -1)
        if (remaining.length === 0) return exitWrongMode(state, steps)
        return { ...state, wrongSegments: remaining }
      }
      return {
        ...state,
        wrongSegments: [...wrongSegments.slice(0, -1), { face: top.face, netTurns: newNet }],
      }
    }

    // Different face — push new segment
    return { ...state, wrongSegments: [...wrongSegments, { face: move.face, netTurns: delta }] }
  }

  const expected = steps[currentStepIndex]

  // Warning state: track net turns on the expected face (mod 4)
  if (trackingState === 'warning') {
    if (move.face !== expected.face) {
      const delta = move.direction === 'CW' ? 1 : -1
      return {
        ...state,
        trackingState: 'wrong',
        wrongSegments: [{ face: move.face, netTurns: delta }],
        wrongFromWarning: true,
      }
    }
    const delta = move.direction === 'CW' ? 1 : -1
    const newNet = state.warningNetTurns + delta
    const net4 = ((newNet % 4) + 4) % 4
    // double step: fulfilled at net ≡ 2; single step: fulfilled at net ≡ expected direction
    const fulfilledNet4 = expected.double ? 2 : (expected.direction === 'CW' ? 1 : 3)
    if (net4 === fulfilledNet4) {
      const nextIndex = currentStepIndex + 1
      const isArmed = nextIndex >= steps.length
      return {
        ...state,
        trackingState: isArmed ? 'armed' : 'scrambling',
        stepStates: buildStepStates(steps, nextIndex, nextIndex, null),
        currentStepIndex: nextIndex,
        wrongSegments: [],
        warningNetTurns: 0,
      }
    }
    if (net4 === 0) {
      return {
        ...state,
        trackingState: 'scrambling',
        stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
        warningNetTurns: 0,
      }
    }
    return { ...state, warningNetTurns: newNet }
  }

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

  if (expected.double) {
    return {
      ...state,
      trackingState: 'warning',
      warningNetTurns: move.direction === 'CW' ? 1 : -1,
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex),
    }
  }

  // Single move
  if (move.direction === expected.direction) {
    const nextIndex = currentStepIndex + 1
    const isArmed = nextIndex >= steps.length
    return {
      ...state,
      trackingState: isArmed ? 'armed' : 'scrambling',
      stepStates: buildStepStates(steps, nextIndex, nextIndex, null),
      currentStepIndex: nextIndex,
    }
  }

  // Wrong direction for single move → enter warning, seed net turns
  return {
    ...state,
    trackingState: 'warning',
    warningNetTurns: move.direction === 'CW' ? 1 : -1,
    stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex),
  }
}

export function useScrambleTracker(
  steps: ScrambleStep[],
  driver: MutableRefObject<CubeDriver | null>,
  onArmed?: () => void,
  driverVersion = 0,
) {
  const [state, setState] = useState<TrackerState>(() => makeInitialTrackerState(steps))

  useEffect(() => {
    setState(makeInitialTrackerState(steps))
  }, [steps])

  useCubeDriverEvent(driver, 'move', (move) => {
    setState((prev) => {
      const next = applyTrackerMove(prev, steps, move)
      if (next.trackingState === 'armed' && prev.trackingState !== 'armed') {
        onArmed?.()
      }
      return next
    })
  }, driverVersion)

  const reset = useCallback(() => setState(makeInitialTrackerState(steps)), [steps])

  return { ...state, reset }
}

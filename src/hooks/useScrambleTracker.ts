import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Face, PositionMove } from '../types/cube'
import { useCubeDriverEvent } from './useCubeDriverEvent'
import type { ScrambleStep } from '../types/solve'

export type StepState = 'done' | 'current' | 'pending' | 'warning'
export type TrackingState = 'scrambling' | 'warning' | 'wrong' | 'armed'

export interface WrongSegment {
  face: PositionMove['face']
  netTurns: number  // positive = net CW, negative = net CCW; mod-4 encodes cancellation
}

export interface TrackerState {
  stepStates: StepState[]
  trackingState: TrackingState
  wrongSegments: WrongSegment[]  // stack of face segments; reverse cancels all wrong-doing
  currentStepIndex: number
  warningNetTurns: number        // net CW(+1)/CCW(-1) count while in warning state
  wrongFromWarning: boolean      // whether wrong state was entered from warning
  aheadState: 'none' | 'done' | 'warning'   // tracks the step at currentStepIndex + 1
  aheadNetTurns: number                       // net turns on ahead face; meaningful when aheadState === 'warning'
}

export function commutes(face1: Face, face2: Face): boolean {
  return (
    (face1 === 'R' && face2 === 'L') || (face1 === 'L' && face2 === 'R') ||
    (face1 === 'U' && face2 === 'D') || (face1 === 'D' && face2 === 'U') ||
    (face1 === 'F' && face2 === 'B') || (face1 === 'B' && face2 === 'F')
  )
}

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

function exitWrongMode(state: TrackerState, steps: ScrambleStep[]): TrackerState {
  const { currentStepIndex, wrongFromWarning } = state
  if (wrongFromWarning) {
    return {
      ...state,
      trackingState: 'warning',
      wrongSegments: [],
      wrongFromWarning: false,
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex, state.aheadState),
    }
  }
  return {
    ...state,
    trackingState: 'scrambling',
    wrongSegments: [],
    wrongFromWarning: false,
    stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null, state.aheadState),
  }
}

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

export function applyTrackerMove(state: TrackerState, steps: ScrambleStep[], move: PositionMove): TrackerState {
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
        stepStates: buildStepStates(steps, nextIndex, nextIndex, null, 'none'),
        currentStepIndex: nextIndex,
        wrongSegments: [],
        warningNetTurns: 0,
        aheadState: 'none',
        aheadNetTurns: 0,
      }
    }
    if (net4 === 0) {
      return {
        ...state,
        trackingState: 'scrambling',
        stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null, state.aheadState),
        warningNetTurns: 0,
      }
    }
    return { ...state, warningNetTurns: newNet }
  }

  // Normal scrambling state
  if (move.face !== expected.face) {
    if (currentStepIndex > 0 && move.face === steps[currentStepIndex - 1].face) {
      const prevStep = steps[currentStepIndex - 1]
      const newIndex = currentStepIndex - 1
      if (prevStep.double) {
        const delta = move.direction === 'CW' ? 1 : -1
        return {
          ...state,
          trackingState: 'warning',
          currentStepIndex: newIndex,
          warningNetTurns: 2 + delta,
          stepStates: buildStepStates(steps, newIndex, newIndex, newIndex, 'none'),
          aheadState: 'none',
          aheadNetTurns: 0,
        }
      }
      if (move.direction !== prevStep.direction) {
        return {
          ...state,
          trackingState: 'scrambling',
          currentStepIndex: newIndex,
          stepStates: buildStepStates(steps, newIndex, newIndex, null, 'none'),
          aheadState: 'none',
          aheadNetTurns: 0,
        }
      }
    }
    // Ahead step check: only when face differs from current step (current has priority)
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
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null, state.aheadState),
    }
  }

  if (expected.double) {
    return {
      ...state,
      trackingState: 'warning',
      warningNetTurns: move.direction === 'CW' ? 1 : -1,
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex, state.aheadState),
    }
  }

  // Single move
  if (move.direction === expected.direction) {
    const nextIndex = currentStepIndex + 1
    const isArmed = nextIndex >= steps.length
    return {
      ...state,
      trackingState: isArmed ? 'armed' : 'scrambling',
      stepStates: buildStepStates(steps, nextIndex, nextIndex, null, 'none'),
      currentStepIndex: nextIndex,
      aheadState: 'none',
      aheadNetTurns: 0,
    }
  }

  // Wrong direction for single move → enter warning, seed net turns
  return {
    ...state,
    trackingState: 'warning',
    warningNetTurns: move.direction === 'CW' ? 1 : -1,
    stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex, state.aheadState),
  }
}

export function useScrambleTracker(
  steps: ScrambleStep[],
  driver: MutableRefObject<CubeDriver | null>,
  onArmed?: () => void,
  driverVersion = 0,
) {
  const [state, setState] = useState<TrackerState>(() => makeInitialTrackerState(steps))
  // Saved before each move so replacePreviousMove (e.g. M detected after R) can revert + re-apply.
  const prevStateRef = useRef<TrackerState | null>(null)

  useEffect(() => {
    setState(makeInitialTrackerState(steps))
  }, [steps])

  useCubeDriverEvent(driver, 'move', (move) => {
    setState((prev) => {
      prevStateRef.current = prev
      const next = applyTrackerMove(prev, steps, move)
      if (next.trackingState === 'armed' && prev.trackingState !== 'armed') {
        onArmed?.()
      }
      return next
    })
  }, driverVersion)

  useCubeDriverEvent(driver, 'replacePreviousMove', (move) => {
    setState((prev) => {
      const base = prevStateRef.current ?? prev
      prevStateRef.current = null
      const next = applyTrackerMove(base, steps, move)
      if (next.trackingState === 'armed' && prev.trackingState !== 'armed') {
        onArmed?.()
      }
      return next
    })
  }, driverVersion)

  const reset = useCallback(() => {
    prevStateRef.current = null
    setState(makeInitialTrackerState(steps))
  }, [steps])

  return { ...state, reset }
}

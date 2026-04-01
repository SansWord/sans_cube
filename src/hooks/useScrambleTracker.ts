import { useState, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, Direction } from '../types/cube'
import type { ScrambleStep } from '../types/solve'

export type StepState = 'done' | 'current' | 'pending' | 'warning'
export type TrackingState = 'scrambling' | 'warning' | 'wrong' | 'armed'

export interface TrackerState {
  stepStates: StepState[]
  trackingState: TrackingState
  wrongMoves: Move[]           // stack of wrong moves; reverse sequence cancels them all
  partialDirection: Direction | null
  currentStepIndex: number
  warningNetTurns: number      // net CW(+1)/CCW(-1) count while in warning state
  wrongFromWarning: boolean    // whether wrong state was entered from warning
}

export function makeInitialTrackerState(steps: ScrambleStep[]): TrackerState {
  return {
    stepStates: steps.map((_, i) => (i === 0 ? 'current' : 'pending')),
    trackingState: steps.length === 0 ? 'armed' : 'scrambling',
    wrongMoves: [],
    partialDirection: null,
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

export function applyTrackerMove(state: TrackerState, steps: ScrambleStep[], move: Move): TrackerState {
  const { trackingState, currentStepIndex, wrongMoves, partialDirection } = state

  // Armed: scramble done, ignore further moves
  if (trackingState === 'armed') return state

  // Wrong state: each move either cancels the top of the stack or pushes to it
  if (trackingState === 'wrong') {
    const top = wrongMoves[wrongMoves.length - 1]
    if (top && move.face === top.face && move.direction !== top.direction) {
      // Cancels the top move — pop the stack
      const remaining = wrongMoves.slice(0, -1)
      if (remaining.length === 0) {
        // Stack empty — exit wrong mode
        if (state.wrongFromWarning) {
          return {
            ...state,
            trackingState: 'warning',
            wrongMoves: [],
            wrongFromWarning: false,
            stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex),
          }
        }
        return {
          ...state,
          trackingState: 'scrambling',
          wrongMoves: [],
          wrongFromWarning: false,
          stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
        }
      }
      return { ...state, wrongMoves: remaining }
    }
    // New wrong move — push to stack
    return { ...state, wrongMoves: [...wrongMoves, move] }
  }

  const expected = steps[currentStepIndex]

  // Warning state: track net turns on the expected face (mod 4)
  if (trackingState === 'warning') {
    if (move.face !== expected.face) {
      return { ...state, trackingState: 'wrong', wrongMoves: [move], wrongFromWarning: true }
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
        wrongMoves: [],
        warningNetTurns: 0,
      }
    }
    if (net4 === 0) {
      // Net zero → moves cancelled out, back to waiting for this step
      return {
        ...state,
        trackingState: 'scrambling',
        stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
        warningNetTurns: 0,
      }
    }
    // Still in warning
    return { ...state, warningNetTurns: newNet }
  }

  // Normal scrambling state
  if (move.face !== expected.face) {
    return {
      ...state,
      trackingState: 'wrong',
      wrongMoves: [move],
      partialDirection: null,
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
    }
  }

  if (expected.double) {
    // First turn on correct face → enter warning, track net turns
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
) {
  const [state, setState] = useState<TrackerState>(() => makeInitialTrackerState(steps))

  // Reset when steps change (new scramble)
  useEffect(() => {
    setState(makeInitialTrackerState(steps))
  }, [steps])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (move: Move) => {
      setState((prev) => {
        const next = applyTrackerMove(prev, steps, move)
        if (next.trackingState === 'armed' && prev.trackingState !== 'armed') {
          onArmed?.()
        }
        return next
      })
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, steps]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => setState(makeInitialTrackerState(steps)), [steps])

  return { ...state, reset }
}

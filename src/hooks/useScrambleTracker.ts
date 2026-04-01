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
  wrongMove: Move | null
  partialDirection: Direction | null
  currentStepIndex: number
}

export function makeInitialTrackerState(steps: ScrambleStep[]): TrackerState {
  return {
    stepStates: steps.map((_, i) => (i === 0 ? 'current' : 'pending')),
    trackingState: steps.length === 0 ? 'armed' : 'scrambling',
    wrongMove: null,
    partialDirection: null,
    currentStepIndex: 0,
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
  const { trackingState, currentStepIndex, wrongMove, partialDirection } = state

  // Armed: scramble done, ignore further moves
  if (trackingState === 'armed') return state

  // Wrong state: wait for undo
  if (trackingState === 'wrong') {
    if (wrongMove && move.face === wrongMove.face && move.direction !== wrongMove.direction) {
      // Undone — back to scrambling
      return {
        ...state,
        trackingState: 'scrambling',
        wrongMove: null,
        stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
      }
    }
    // Any other move while wrong: update wrongMove to this latest wrong move
    return { ...state, wrongMove: move }
  }

  const expected = steps[currentStepIndex]

  // Warning state: only accept correct face moves
  if (trackingState === 'warning') {
    if (move.face !== expected.face) {
      return { ...state, trackingState: 'wrong', wrongMove: move }
    }
    if (move.direction === expected.direction) {
      // Corrected — step done
      const nextIndex = currentStepIndex + 1
      const isArmed = nextIndex >= steps.length
      return {
        ...state,
        trackingState: isArmed ? 'armed' : 'scrambling',
        stepStates: buildStepStates(steps, nextIndex, nextIndex, null),
        currentStepIndex: nextIndex,
        wrongMove: null,
      }
    }
    // Still wrong direction — stay in warning
    return state
  }

  // Normal scrambling state
  if (move.face !== expected.face) {
    // Reset partial progress if in middle of double
    return {
      ...state,
      trackingState: 'wrong',
      wrongMove: move,
      partialDirection: null,
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
    }
  }

  if (expected.double) {
    if (partialDirection === null) {
      // First turn on correct face — record direction
      return { ...state, partialDirection: move.direction }
    }
    if (move.direction === partialDirection) {
      // Second same-direction turn — step done
      const nextIndex = currentStepIndex + 1
      const isArmed = nextIndex >= steps.length
      return {
        ...state,
        trackingState: isArmed ? 'armed' : 'scrambling',
        stepStates: buildStepStates(steps, nextIndex, nextIndex, null),
        currentStepIndex: nextIndex,
        partialDirection: null,
      }
    }
    // Opposite direction — cancel partial progress
    return { ...state, partialDirection: null }
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

  // Wrong direction for single move
  return {
    ...state,
    trackingState: 'warning',
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

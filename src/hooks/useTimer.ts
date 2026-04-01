import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move } from '../types/cube'
import type { PhaseRecord, SolveMethod } from '../types/solve'
import { isSolvedFacelets } from './useCubeState'
import { applyMoveToFacelets } from './useCubeState'
import { SOLVED_FACELETS } from '../types/cube'

export type TimerStatus = 'idle' | 'solving' | 'solved'

export interface TimerResult {
  status: TimerStatus
  elapsedMs: number
  phaseRecords: PhaseRecord[]
  recordedMoves: Move[]
  reset: () => void
}

export function useTimer(
  driver: MutableRefObject<CubeDriver | null>,
  method: SolveMethod,
  armed: boolean,
): TimerResult {
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [phaseRecords, setPhaseRecords] = useState<PhaseRecord[]>([])
  const [recordedMoves, setRecordedMoves] = useState<Move[]>([])

  // Internal refs — avoid stale closures
  const statusRef = useRef<TimerStatus>('idle')
  const armedRef = useRef(false)
  const startTimeRef = useRef(0)
  const phaseStartTimeRef = useRef(0)
  const phaseFirstMoveTimeRef = useRef<number | null>(null)
  const phaseIndexRef = useRef(0)
  const phaseMoveCountRef = useRef(0)
  const completedPhasesRef = useRef<PhaseRecord[]>([])
  const movesRef = useRef<Move[]>([])
  const faceletsRef = useRef(SOLVED_FACELETS)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const methodRef = useRef(method)
  methodRef.current = method

  useEffect(() => { armedRef.current = armed }, [armed])

  const startInterval = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 50)
  }, [])

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const completePhase = useCallback((now: number) => {
    const label = methodRef.current.phases[phaseIndexRef.current]?.label ?? ''
    const group = methodRef.current.phases[phaseIndexRef.current]?.group
    const phaseStart = phaseStartTimeRef.current
    const firstMove = phaseFirstMoveTimeRef.current ?? now
    const recognitionMs = firstMove - phaseStart
    const executionMs = now - firstMove

    completedPhasesRef.current = [
      ...completedPhasesRef.current,
      { label, group, recognitionMs, executionMs, turns: phaseMoveCountRef.current },
    ]

    phaseIndexRef.current++
    phaseStartTimeRef.current = now
    phaseFirstMoveTimeRef.current = null
    phaseMoveCountRef.current = 0
  }, [])

  const reset = useCallback(() => {
    stopInterval()
    statusRef.current = 'idle'
    faceletsRef.current = SOLVED_FACELETS
    completedPhasesRef.current = []
    movesRef.current = []
    phaseIndexRef.current = 0
    phaseMoveCountRef.current = 0
    phaseFirstMoveTimeRef.current = null
    setStatus('idle')
    setElapsedMs(0)
    setPhaseRecords([])
    setRecordedMoves([])
  }, [stopInterval])

  useEffect(() => {
    const d = driver.current
    if (!d) return

    const onMove = (move: Move) => {
      const now = Date.now()

      if (statusRef.current === 'solved') return

      // Update facelets
      faceletsRef.current = applyMoveToFacelets(faceletsRef.current, move)

      if (statusRef.current === 'idle') {
        if (!armedRef.current) return
        // First move after armed → start timer
        statusRef.current = 'solving'
        startTimeRef.current = now
        phaseStartTimeRef.current = now
        phaseFirstMoveTimeRef.current = now  // Cross has no recognition
        phaseIndexRef.current = 0
        phaseMoveCountRef.current = 0
        completedPhasesRef.current = []
        movesRef.current = []
        setStatus('solving')
        startInterval()
      }

      if (statusRef.current !== 'solving') return

      movesRef.current = [...movesRef.current, move]
      phaseMoveCountRef.current++

      if (phaseFirstMoveTimeRef.current === null) {
        phaseFirstMoveTimeRef.current = now
      }

      // Check if current phase is complete
      const currentPhase = methodRef.current.phases[phaseIndexRef.current]
      if (currentPhase && currentPhase.isComplete(faceletsRef.current)) {
        completePhase(now)
      }

      // Check if cube is solved
      if (isSolvedFacelets(faceletsRef.current)) {
        // Complete any remaining phases
        while (phaseIndexRef.current < methodRef.current.phases.length) {
          completePhase(now)
        }
        // If CPLL and PLL finished on the same move (PLL has 0 turns), absorb CPLL into PLL
        const phases = completedPhasesRef.current
        const n = phases.length
        if (n >= 2 && phases[n - 2].label === 'CPLL' && phases[n - 1].label === 'PLL' && phases[n - 1].turns === 0) {
          const cpll = phases[n - 2]
          completedPhasesRef.current = [
            ...phases.slice(0, n - 2),
            { ...cpll, recognitionMs: 0, executionMs: 0, turns: 0 },
            { ...phases[n - 1], recognitionMs: cpll.recognitionMs, executionMs: cpll.executionMs, turns: cpll.turns },
          ]
        }
        stopInterval()
        const total = now - startTimeRef.current
        statusRef.current = 'solved'
        setStatus('solved')
        setElapsedMs(total)
        setPhaseRecords([...completedPhasesRef.current])
        setRecordedMoves([...movesRef.current])
      }
    }

    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, completePhase, startInterval, stopInterval])

  return { status, elapsedMs, phaseRecords, recordedMoves, reset }
}

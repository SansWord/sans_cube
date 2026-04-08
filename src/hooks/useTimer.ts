import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, Quaternion } from '../types/cube'
import type { PhaseRecord, QuaternionSnapshot, SolveMethod } from '../types/solve'
import { isSolvedFacelets } from './useCubeState'
import { applyMoveToFacelets } from './useCubeState'
import { SOLVED_FACELETS } from '../types/cube'

export type TimerStatus = 'idle' | 'solving' | 'solved'

export interface TimerResult {
  status: TimerStatus
  elapsedMs: number
  phaseRecords: PhaseRecord[]
  recordedMoves: Move[]
  quaternionSnapshots: QuaternionSnapshot[]
  reset: () => void
}

export function useTimer(
  driver: MutableRefObject<CubeDriver | null>,
  method: SolveMethod,
  armed: boolean,
  driverVersion = 0,
): TimerResult {
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [phaseRecords, setPhaseRecords] = useState<PhaseRecord[]>([])
  const [recordedMoves, setRecordedMoves] = useState<Move[]>([])
  const [quaternionSnapshots, setQuaternionSnapshots] = useState<QuaternionSnapshot[]>([])

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
  const quaternionSnapshotsRef = useRef<QuaternionSnapshot[]>([])
  const lastGyroMsRef = useRef(-Infinity)
  const faceletsRef = useRef(SOLVED_FACELETS)
  const prevFaceletsRef = useRef(SOLVED_FACELETS)
  const latestQuaternionRef = useRef<Quaternion | undefined>(undefined)
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
    prevFaceletsRef.current = SOLVED_FACELETS
    completedPhasesRef.current = []
    movesRef.current = []
    quaternionSnapshotsRef.current = []
    lastGyroMsRef.current = -Infinity
    phaseIndexRef.current = 0
    phaseMoveCountRef.current = 0
    phaseFirstMoveTimeRef.current = null
    setStatus('idle')
    setElapsedMs(0)
    setPhaseRecords([])
    setRecordedMoves([])
    setQuaternionSnapshots([])
  }, [stopInterval])

  useEffect(() => {
    const d = driver.current
    if (!d) return

    const r5 = (n: number) => Math.round(n * 1e5) / 1e5
    const onGyro = (q: Quaternion) => {
      latestQuaternionRef.current = q
      if (statusRef.current === 'solving') {
        const relativeMs = Date.now() - startTimeRef.current
        if (relativeMs - lastGyroMsRef.current >= 100) {   // 10 Hz cap
          lastGyroMsRef.current = relativeMs
          quaternionSnapshotsRef.current.push({
            quaternion: { x: r5(q.x), y: r5(q.y), z: r5(q.z), w: r5(q.w) },
            relativeMs,
          })
        }
      }
    }
    d.on('gyro', onGyro)

    const onMove = (move: Move) => {
      const moveWithQ: Move = { ...move, quaternion: latestQuaternionRef.current }
      const now = Date.now()

      if (statusRef.current === 'solved') return

      // Update facelets (save previous for retroactive slice correction)
      prevFaceletsRef.current = faceletsRef.current
      faceletsRef.current = applyMoveToFacelets(faceletsRef.current, moveWithQ)

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

      movesRef.current = [...movesRef.current, moveWithQ]
      phaseMoveCountRef.current++

      if (phaseFirstMoveTimeRef.current === null) {
        phaseFirstMoveTimeRef.current = now
      }

      // Advance through any phases that became complete on this move
      while (phaseIndexRef.current < methodRef.current.phases.length) {
        const ph = methodRef.current.phases[phaseIndexRef.current]
        if (ph && ph.isComplete(faceletsRef.current)) {
          completePhase(now)
        } else {
          break
        }
      }

      // Check if cube is solved
      if (isSolvedFacelets(faceletsRef.current)) {
        // Complete any remaining phases not yet caught by the while loop above
        while (phaseIndexRef.current < methodRef.current.phases.length) {
          completePhase(now)
        }
        const phases = completedPhasesRef.current
        const n = phases.length

        // If EOLL completed OLL on the same move (OLL has 0 turns), absorb EOLL into OLL
        const eollIdx = phases.findIndex((p) => p.label === 'EOLL')
        if (eollIdx >= 0 && eollIdx + 1 < n && phases[eollIdx + 1].label === 'COLL' && phases[eollIdx + 1].turns === 0) {
          const eoll = phases[eollIdx]
          completedPhasesRef.current = [
            ...phases.slice(0, eollIdx),
            { ...eoll, recognitionMs: 0, executionMs: 0, turns: 0 },
            { ...phases[eollIdx + 1], recognitionMs: eoll.recognitionMs, executionMs: eoll.executionMs, turns: eoll.turns },
            ...phases.slice(eollIdx + 2),
          ]
        }

        // If CPLL and PLL finished on the same move (PLL has 0 turns), absorb CPLL into PLL
        const phases2 = completedPhasesRef.current
        const n2 = phases2.length
        if (n2 >= 2 && phases2[n2 - 2].label === 'CPLL' && phases2[n2 - 1].label === 'EPLL' && phases2[n2 - 1].turns === 0) {
          const cpll = phases2[n2 - 2]
          completedPhasesRef.current = [
            ...phases2.slice(0, n2 - 2),
            { ...cpll, recognitionMs: 0, executionMs: 0, turns: 0 },
            { ...phases2[n2 - 1], recognitionMs: cpll.recognitionMs, executionMs: cpll.executionMs, turns: cpll.turns },
          ]
        }
        stopInterval()
        const total = now - startTimeRef.current
        statusRef.current = 'solved'
        setStatus('solved')
        setElapsedMs(total)
        setPhaseRecords([...completedPhasesRef.current])
        setRecordedMoves([...movesRef.current])
        setQuaternionSnapshots([...quaternionSnapshotsRef.current])
      }
    }

    const onReplacePreviousMove = (move: Move) => {
      if (statusRef.current !== 'solving') return
      const moveWithQ: Move = { ...move, quaternion: latestQuaternionRef.current }

      // Revert the last move and apply the replacement slice move
      faceletsRef.current = applyMoveToFacelets(prevFaceletsRef.current, moveWithQ)

      // Replace the last recorded move
      if (movesRef.current.length > 0) {
        movesRef.current = [...movesRef.current.slice(0, -1), moveWithQ]
      }

      // Check if the replacement move solves the cube
      if (isSolvedFacelets(faceletsRef.current)) {
        const now = Date.now()
        while (phaseIndexRef.current < methodRef.current.phases.length) {
          completePhase(now)
        }
        stopInterval()
        const total = now - startTimeRef.current
        statusRef.current = 'solved'
        setStatus('solved')
        setElapsedMs(total)
        setPhaseRecords([...completedPhasesRef.current])
        setRecordedMoves([...movesRef.current])
        setQuaternionSnapshots([...quaternionSnapshotsRef.current])
      }
    }

    d.on('move', onMove)
    d.on('replacePreviousMove', onReplacePreviousMove)
    return () => {
      d.off('move', onMove)
      d.off('gyro', onGyro)
      d.off('replacePreviousMove', onReplacePreviousMove)
    }
  }, [driver, driverVersion, completePhase, startInterval, stopInterval])

  return { status, elapsedMs, phaseRecords, recordedMoves, quaternionSnapshots, reset }
}

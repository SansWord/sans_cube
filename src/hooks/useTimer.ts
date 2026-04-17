import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { PositionMove, Quaternion } from '../types/cube'
import type { PhaseRecord, QuaternionSnapshot, SolveMethod } from '../types/solve'
import { isSolvedFacelets, applyMoveToFacelets } from '../utils/applyMove'
import { SOLVED_FACELETS } from '../types/cube'
import { useCubeDriverEvent } from './useCubeDriverEvent'

const r5 = (n: number) => Math.round(n * 1e5) / 1e5

export type TimerStatus = 'idle' | 'solving' | 'solved'

export interface TimerResult {
  status: TimerStatus
  elapsedMs: number
  phaseRecords: PhaseRecord[]
  recordedMoves: PositionMove[]
  quaternionSnapshots: QuaternionSnapshot[]
  reset: () => void
  /** Sync facelets tracking to an externally-reoriented state (e.g. after resetCenterPositions).
   *  Only effective during idle — never disrupts an in-progress solve. */
  syncFacelets: (facelets: string) => void
}

function absorbPhaseIntoNext(phases: PhaseRecord[], searchLabel: string, nextLabel: string): PhaseRecord[] {
  const idx = phases.findIndex((p) => p.label === searchLabel)
  if (idx < 0 || idx + 1 >= phases.length) return phases
  if (phases[idx + 1].label !== nextLabel || phases[idx + 1].turns !== 0) return phases
  const absorbed = phases[idx]
  return [
    ...phases.slice(0, idx),
    { ...absorbed, recognitionMs: 0, executionMs: 0, turns: 0 },
    { ...phases[idx + 1], recognitionMs: absorbed.recognitionMs, executionMs: absorbed.executionMs, turns: absorbed.turns },
    ...phases.slice(idx + 2),
  ]
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
  const [recordedMoves, setRecordedMoves] = useState<PositionMove[]>([])
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
  const movesRef = useRef<PositionMove[]>([])
  const quaternionSnapshotsRef = useRef<QuaternionSnapshot[]>([])
  const lastGyroMsRef = useRef(-Infinity)
  const faceletsRef = useRef(SOLVED_FACELETS)
  const prevFaceletsRef = useRef(SOLVED_FACELETS)
  const latestQuaternionRef = useRef<Quaternion | undefined>(undefined)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hwOffsetRef = useRef(0)   // wall-clock offset from cube hardware clock: Date.now() - cubeTimestamp at first move
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

  useCubeDriverEvent(driver, 'gyro', (q) => {
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
  }, driverVersion)

  useCubeDriverEvent(driver, 'move', (move) => {
      const moveWithQ: PositionMove = { ...move, quaternion: latestQuaternionRef.current }

      if (statusRef.current === 'solved') return

      // Update facelets (save previous for retroactive slice correction)
      prevFaceletsRef.current = faceletsRef.current
      faceletsRef.current = applyMoveToFacelets(faceletsRef.current, moveWithQ)

      if (statusRef.current === 'idle') {
        if (!armedRef.current) return
        // First move after armed → calibrate hardware clock offset and start timer
        hwOffsetRef.current = Date.now() - move.cubeTimestamp
        statusRef.current = 'solving'
        startTimeRef.current = move.cubeTimestamp + hwOffsetRef.current
        phaseStartTimeRef.current = move.cubeTimestamp + hwOffsetRef.current
        phaseFirstMoveTimeRef.current = move.cubeTimestamp + hwOffsetRef.current
        phaseIndexRef.current = 0
        phaseMoveCountRef.current = 0
        completedPhasesRef.current = []
        movesRef.current = []
        setStatus('solving')
        startInterval()
      }

      if (statusRef.current !== 'solving') return

      const now = move.cubeTimestamp + hwOffsetRef.current

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
        // Absorb zero-turn phase completions: EOLL→COLL and CPLL→EPLL
        completedPhasesRef.current = absorbPhaseIntoNext(completedPhasesRef.current, 'EOLL', 'COLL')
        completedPhasesRef.current = absorbPhaseIntoNext(completedPhasesRef.current, 'CPLL', 'EPLL')
        stopInterval()
        const total = now - startTimeRef.current
        statusRef.current = 'solved'
        setStatus('solved')
        setElapsedMs(total)
        setPhaseRecords([...completedPhasesRef.current])
        setRecordedMoves([...movesRef.current])
        setQuaternionSnapshots([...quaternionSnapshotsRef.current])
      }
  }, driverVersion)

  useCubeDriverEvent(driver, 'replacePreviousMove', (move) => {
    if (statusRef.current === 'solved') return
    const moveWithQ: PositionMove = { ...move, quaternion: latestQuaternionRef.current }

    // Always revert + re-apply, even during idle/scrambling — M/E/S in the scramble must
    // be tracked correctly so facelets are accurate when the solve starts.
    faceletsRef.current = applyMoveToFacelets(prevFaceletsRef.current, moveWithQ)

    if (statusRef.current !== 'solving') return

    // Replace the last recorded move
    if (movesRef.current.length > 0) {
      movesRef.current = [...movesRef.current.slice(0, -1), moveWithQ]
    }

    // Check if the replacement move solves the cube
    if (isSolvedFacelets(faceletsRef.current)) {
      const now = move.cubeTimestamp + hwOffsetRef.current
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
  }, driverVersion)

  const syncFacelets = useCallback((facelets: string) => {
    if (statusRef.current !== 'idle') return
    faceletsRef.current = facelets
    prevFaceletsRef.current = facelets
  }, [])

  return { status, elapsedMs, phaseRecords, recordedMoves, quaternionSnapshots, reset, syncFacelets }
}

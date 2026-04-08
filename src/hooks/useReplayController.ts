import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import type { SolveRecord } from '../types/solve'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import { IDENTITY_QUATERNION, findSlerpedQuaternion } from '../utils/quaternion'

export const SPEED_OPTIONS = [0.5, 1, 2, 3, 5]

export function useReplayController(solve: SolveRecord, rendererRef: RefObject<CubeRenderer | null>) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [indicatorMs, setIndicatorMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(solve.driver === 'mouse' ? 3 : 1)
  const [gyroEnabled, setGyroEnabled] = useState(true)

  const gyroEnabledRef = useRef(true)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const gyroRafRef = useRef<number | null>(null)
  const playStartWallRef = useRef(0)
  const playStartOffsetRef = useRef(0)
  const lastFastBackwardMs = useRef(0)
  const currentIndexRef = useRef(0)
  const wasAnimatingRef = useRef(false)
  const settleUntilRef = useRef(0)

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    gyroEnabledRef.current = gyroEnabled
    if (!gyroEnabled) {
      rendererRef.current?.setQuaternion(IDENTITY_QUATERNION)
      rendererRef.current?.setCameraPosition(4.5, 5, 5.5)
    } else {
      rendererRef.current?.setCameraPosition(0, 6, 7)
      rendererRef.current?.setQuaternion(IDENTITY_QUATERNION)
    }
  }, [gyroEnabled, rendererRef])

  const cancelScheduled = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (gyroRafRef.current !== null) {
      cancelAnimationFrame(gyroRafRef.current)
      gyroRafRef.current = null
    }
  }, [])

  const playFrom = useCallback((startIdx: number) => {
    cancelScheduled()
    setCurrentIndex(startIdx)
    setIsPlaying(true)
    const moves = solve.moves
    const snapshots = solve.quaternionSnapshots ?? []

    const startOffsetMs = startIdx > 0
      ? Math.max(0, moves[startIdx - 1].cubeTimestamp - moves[0].cubeTimestamp)
      : 0

    let cumulativeDelay = 0
    moves.slice(startIdx).forEach((m, i) => {
      const globalIdx = startIdx + i
      if (globalIdx > 0) {
        cumulativeDelay += Math.max(0, m.cubeTimestamp - moves[globalIdx - 1].cubeTimestamp) / speed
      }
      const t = setTimeout(() => {
        rendererRef.current?.animateMove(m.face, m.direction, 150)
        setCurrentIndex(globalIdx + 1)
        if (globalIdx + 1 >= moves.length) setIsPlaying(false)
      }, cumulativeDelay)
      timeoutsRef.current.push(t)
    })

    playStartWallRef.current = performance.now()
    playStartOffsetRef.current = startOffsetMs
    wasAnimatingRef.current = false
    settleUntilRef.current = 0
    const totalMs = solve.timeMs
    const loop = () => {
      const solveElapsed = Math.min(
        playStartOffsetRef.current + (performance.now() - playStartWallRef.current) * speed,
        totalMs,
      )
      setIndicatorMs(solveElapsed)
      if (gyroEnabledRef.current && snapshots.length >= 2) {
        const isAnim = rendererRef.current?.isAnimating ?? false
        const now = performance.now()
        if (wasAnimatingRef.current && !isAnim) {
          // Animation just finished — smoothly settle to correct orientation
          const q = findSlerpedQuaternion(snapshots, solveElapsed)
          if (q) {
            rendererRef.current?.animateQuaternionTo(q, 120)
            settleUntilRef.current = now + 120
          }
        } else if (!isAnim && now >= settleUntilRef.current) {
          // Normal gyro update
          const q = findSlerpedQuaternion(snapshots, solveElapsed)
          if (q) rendererRef.current?.setQuaternion(q)
        }
        wasAnimatingRef.current = isAnim
      }
      if (solveElapsed < totalMs) {
        gyroRafRef.current = requestAnimationFrame(loop)
      } else {
        gyroRafRef.current = null
      }
    }
    gyroRafRef.current = requestAnimationFrame(loop)
  }, [cancelScheduled, solve.moves, solve.quaternionSnapshots, solve.timeMs, speed, rendererRef])

  const play = useCallback(
    () => playFrom(currentIndexRef.current >= solve.moves.length ? 0 : currentIndexRef.current),
    [playFrom, solve.moves.length],
  )

  const pause = useCallback(() => {
    cancelScheduled()
    setIsPlaying(false)
  }, [cancelScheduled])

  const seekTo = useCallback((idx: number, quatAnimMs = 0) => {
    cancelScheduled()
    setIsPlaying(false)
    const clamped = Math.max(0, Math.min(solve.moves.length, idx))
    setCurrentIndex(clamped)
    const ms = clamped > 0
      ? Math.max(0, solve.moves[clamped - 1].cubeTimestamp - solve.moves[0].cubeTimestamp)
      : 0
    setIndicatorMs(ms)
    const snapshots = solve.quaternionSnapshots ?? []
    if (gyroEnabledRef.current && snapshots.length >= 2) {
      const q = findSlerpedQuaternion(snapshots, ms)
      if (q) {
        if (quatAnimMs > 0) rendererRef.current?.animateQuaternionTo(q, quatAnimMs)
        else rendererRef.current?.setQuaternion(q)
      }
    }
  }, [cancelScheduled, solve.moves, solve.quaternionSnapshots, rendererRef])

  const stepForward = useCallback(() => {
    if (currentIndex >= solve.moves.length) return
    rendererRef.current?.animateMove(solve.moves[currentIndex].face, solve.moves[currentIndex].direction, 150)
    seekTo(currentIndex + 1, 150)
  }, [seekTo, currentIndex, solve.moves, rendererRef])

  const stepBackward = useCallback(() => {
    if (currentIndex <= 0) return
    const move = solve.moves[currentIndex - 1]
    rendererRef.current?.animateMove(move.face, move.direction === 'CW' ? 'CCW' : 'CW', 150)
    seekTo(currentIndex - 1, 150)
  }, [seekTo, currentIndex, solve.moves, rendererRef])

  const phaseStarts = useMemo(() => {
    const starts: number[] = []
    let cum = 0
    for (const p of solve.phases) {
      starts.push(cum)
      cum += p.turns
    }
    return starts
  }, [solve.phases])

  const fastForward = useCallback(() => {
    const next = phaseStarts.find(s => s > currentIndex) ?? solve.moves.length
    seekTo(next)
  }, [seekTo, phaseStarts, currentIndex, solve.moves.length])

  const fastBackward = useCallback(() => {
    const now = Date.now()
    const currentPhaseStart = [...phaseStarts].reverse().find(s => s <= currentIndex) ?? 0
    const atStart = currentIndex === currentPhaseStart
    const quickRepeat = now - lastFastBackwardMs.current < 500
    if (atStart || quickRepeat) {
      const prevStart = [...phaseStarts].reverse().find(s => s < currentPhaseStart) ?? 0
      seekTo(prevStart)
    } else {
      seekTo(currentPhaseStart)
    }
    lastFastBackwardMs.current = now
  }, [seekTo, phaseStarts, currentIndex])

  useEffect(() => {
    if (isPlaying) { cancelScheduled(); setIsPlaying(false) }
  }, [speed]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentIndex,
    indicatorMs,
    isPlaying,
    speed,
    setSpeed,
    gyroEnabled,
    setGyroEnabled,
    playFrom,
    play,
    pause,
    seekTo,
    stepForward,
    stepBackward,
    fastForward,
    fastBackward,
  }
}

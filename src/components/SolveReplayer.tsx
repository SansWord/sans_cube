import { useState, useRef, useCallback, useEffect } from 'react'
import type { SolveSession } from '../types/cube'
import type { CubeRenderer } from '../rendering/CubeRenderer'

interface Props {
  session: SolveSession
  renderer: CubeRenderer | null
  onClose: () => void
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2]

export function SolveReplayer({ session, renderer, onClose }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const totalMs = session.endTimestamp - session.startTimestamp
  const elapsedMs = currentIndex > 0
    ? session.moves[currentIndex - 1].cubeTimestamp - session.startTimestamp
    : 0

  const cancelScheduled = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const play = useCallback(() => {
    if (!renderer) return
    setIsPlaying(true)
    const startIdx = currentIndex
    const moves = session.moves

    moves.slice(startIdx).forEach((entry, i) => {
      const globalIdx = startIdx + i
      const prevTs = globalIdx === 0
        ? session.startTimestamp
        : moves[globalIdx - 1].cubeTimestamp
      const delay = (entry.cubeTimestamp - prevTs) / speed

      const t = setTimeout(() => {
        renderer.animateMove(entry.move.face, entry.move.direction, Math.max(80, delay * 0.8))
        setCurrentIndex(globalIdx + 1)
        if (globalIdx + 1 >= moves.length) setIsPlaying(false)
      }, delay)
      timeoutsRef.current.push(t)
    })
  }, [renderer, session, currentIndex, speed])

  const pause = useCallback(() => {
    cancelScheduled()
    setIsPlaying(false)
  }, [cancelScheduled])

  const scrub = useCallback((idx: number) => {
    cancelScheduled()
    setIsPlaying(false)
    setCurrentIndex(idx)
  }, [cancelScheduled])

  // Pause if speed changes while playing — user must press play again at new speed
  useEffect(() => {
    if (isPlaying) {
      cancelScheduled()
      setIsPlaying(false)
    }
  }, [speed]) // eslint-disable-line react-hooks/exhaustive-deps

  const solveSeconds = (totalMs / 1000).toFixed(1)

  return (
    <div style={{ padding: '12px 16px', background: '#16213e', borderTop: '1px solid #333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '13px' }}>
          Replay: {solveSeconds}s solve, {session.moves.length} moves
        </span>
        <button onClick={onClose} style={{ fontSize: '12px', padding: '2px 8px' }}>✕</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={isPlaying ? pause : play} style={{ padding: '6px 14px', minWidth: '60px' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={session.moves.length}
          value={currentIndex}
          onChange={(e) => scrub(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ padding: '4px' }}
        >
          {SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
        {(elapsedMs / 1000).toFixed(1)}s / {solveSeconds}s
      </div>
    </div>
  )
}

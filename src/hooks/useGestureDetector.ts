import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, GesturePattern } from '../types/cube'

export function matchGesture(recentMoves: Move[], pattern: GesturePattern): boolean {
  if (recentMoves.length < pattern.count) return false
  const last = recentMoves.slice(-pattern.count)
  const allMatch = last.every(m => m.face === pattern.face && (pattern.direction == null || m.direction === pattern.direction))
  if (!allMatch) return false
  return last[last.length - 1].cubeTimestamp - last[0].cubeTimestamp <= pattern.windowMs
}

const DEFAULT_PATTERNS: Array<{ pattern: GesturePattern; action: string }> = [
  { pattern: { face: 'U', direction: 'CW', count: 4, windowMs: 3000 }, action: 'resetGyro' },
  { pattern: { face: 'U', direction: 'CCW', count: 4, windowMs: 3000 }, action: 'resetGyro' },
  { pattern: { face: 'D', direction: 'CW', count: 4, windowMs: 3000 }, action: 'resetState' },
  { pattern: { face: 'D', direction: 'CCW', count: 4, windowMs: 3000 }, action: 'resetState' },

]

interface GestureHandlers {
  resetGyro: () => void
  resetState: () => void
}

export function useGestureDetector(
  driver: MutableRefObject<CubeDriver | null>,
  handlers: GestureHandlers,
  isSolvedRef: MutableRefObject<boolean>,
  blockedRef?: MutableRefObject<boolean>,
  driverVersion = 0,
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const d = driver.current
    if (!d) return

    const history: Move[] = []

    const onMove = (move: Move) => {
      history.push(move)
      if (history.length > 20) history.shift()

      if (blockedRef?.current) return

      for (const { pattern, action } of DEFAULT_PATTERNS) {
        if (matchGesture(history, pattern)) {
          if (action === 'resetGyro' && isSolvedRef.current) handlersRef.current.resetGyro()
          if (action === 'resetState') handlersRef.current.resetState()
          history.length = 0
        }
      }
    }

    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, driverVersion]) // handlers removed from deps — accessed via ref
}

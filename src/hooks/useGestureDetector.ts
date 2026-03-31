import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, GesturePattern } from '../types/cube'

export function matchGesture(recentMoves: Move[], pattern: GesturePattern): boolean {
  const matching = recentMoves.filter(
    (m) => m.face === pattern.face && m.direction === pattern.direction
  )
  if (matching.length < pattern.count) return false
  const last = matching.slice(-pattern.count)
  return last[last.length - 1].cubeTimestamp - last[0].cubeTimestamp <= pattern.windowMs
}

const DEFAULT_PATTERNS: Array<{ pattern: GesturePattern; action: string }> = [
  { pattern: { face: 'U', direction: 'CW', count: 4, windowMs: 2000 }, action: 'resetGyro' },
  { pattern: { face: 'D', direction: 'CW', count: 4, windowMs: 2000 }, action: 'resetState' },
]

interface GestureHandlers {
  resetGyro: () => void
  resetState: () => void
}

export function useGestureDetector(
  driver: MutableRefObject<CubeDriver | null>,
  handlers: GestureHandlers
) {
  useEffect(() => {
    const d = driver.current
    if (!d) return

    const history: Move[] = []

    const onMove = (move: Move) => {
      history.push(move)
      // Keep only last 20 moves to bound memory
      if (history.length > 20) history.shift()

      for (const { pattern, action } of DEFAULT_PATTERNS) {
        if (matchGesture(history, pattern)) {
          if (action === 'resetGyro') handlers.resetGyro()
          if (action === 'resetState') handlers.resetState()
          history.length = 0 // clear after gesture fires
        }
      }
    }

    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, handlers])
}

import { describe, it, expect } from 'vitest'
import { matchGesture } from '../../src/hooks/useGestureDetector'
import type { Move, GesturePattern } from '../../src/types/cube'

function makeMove(face: Move['face'], dir: Move['direction'], ts: number): Move {
  return { face, direction: dir, cubeTimestamp: ts, serial: 0 }
}

describe('matchGesture', () => {
  const pattern: GesturePattern = { face: 'U', direction: 'CW', count: 4, windowMs: 2000 }

  it('returns true when 4 matching moves are within window', () => {
    const moves = [
      makeMove('U', 'CW', 0),
      makeMove('U', 'CW', 300),
      makeMove('U', 'CW', 600),
      makeMove('U', 'CW', 900),
    ]
    expect(matchGesture(moves, pattern)).toBe(true)
  })

  it('returns false when moves span beyond windowMs', () => {
    const moves = [
      makeMove('U', 'CW', 0),
      makeMove('U', 'CW', 300),
      makeMove('U', 'CW', 600),
      makeMove('U', 'CW', 2100), // 2100ms gap from first
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })

  it('returns false when wrong face', () => {
    const moves = [
      makeMove('R', 'CW', 0),
      makeMove('R', 'CW', 300),
      makeMove('R', 'CW', 600),
      makeMove('R', 'CW', 900),
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })

  it('returns false when wrong direction', () => {
    const moves = [
      makeMove('U', 'CCW', 0),
      makeMove('U', 'CCW', 300),
      makeMove('U', 'CCW', 600),
      makeMove('U', 'CCW', 900),
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })

  it('returns false when fewer than count moves', () => {
    const moves = [
      makeMove('U', 'CW', 0),
      makeMove('U', 'CW', 300),
      makeMove('U', 'CW', 600),
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import type { PositionMove, SolveSession, GesturePattern } from '../../src/types/cube'

describe('cube types', () => {
  it('PositionMove has required fields', () => {
    const move: PositionMove = {
      face: 'U',
      direction: 'CW',
      cubeTimestamp: 1000,
      serial: 42,
    }
    expect(move.face).toBe('U')
    expect(move.direction).toBe('CW')
    expect(move.cubeTimestamp).toBe(1000)
    expect(move.serial).toBe(42)
  })

  it('SolveSession has moves and timestamps', () => {
    const session: SolveSession = {
      moves: [{ move: { face: 'R', direction: 'CW', cubeTimestamp: 100, serial: 1 }, cubeTimestamp: 100 }],
      startTimestamp: 100,
      endTimestamp: 5000,
    }
    expect(session.moves).toHaveLength(1)
    expect(session.endTimestamp - session.startTimestamp).toBe(4900)
  })

  it('GesturePattern has face, direction, count, and windowMs', () => {
    const pattern: GesturePattern = {
      face: 'U',
      direction: 'CW',
      count: 4,
      windowMs: 2000,
    }
    expect(pattern.count).toBe(4)
    expect(pattern.windowMs).toBe(2000)
  })
})

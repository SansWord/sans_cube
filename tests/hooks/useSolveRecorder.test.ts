import { describe, it, expect } from 'vitest'
import { buildSolveSession } from '../../src/hooks/useSolveRecorder'
import type { Move } from '../../src/types/cube'

function makeMove(face: Move['face'], ts: number): { move: Move; cubeTimestamp: number } {
  return { move: { face, direction: 'CW', cubeTimestamp: ts, serial: 0 }, cubeTimestamp: ts }
}

describe('buildSolveSession', () => {
  it('builds a SolveSession from recorded entries', () => {
    const entries = [makeMove('U', 100), makeMove('R', 500), makeMove('F', 1200)]
    const session = buildSolveSession(entries)
    expect(session).not.toBeNull()
    expect(session!.moves).toHaveLength(3)
    expect(session!.startTimestamp).toBe(100)
    expect(session!.endTimestamp).toBe(1200)
  })

  it('returns null for empty entries', () => {
    expect(buildSolveSession([])).toBeNull()
  })
})

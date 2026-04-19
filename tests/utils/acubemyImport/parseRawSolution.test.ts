import { describe, it, expect } from 'vitest'
import { parseRawSolution } from '../../../src/utils/acubemyImport/parseRawSolution'

describe('parseRawSolution', () => {
  it('maps U/D/F/B/L/R to Western colors', () => {
    const moves = parseRawSolution('U D F B L R', [0, 10, 20, 30, 40, 50])
    expect(moves.map(m => m.face)).toEqual(['W', 'Y', 'G', 'B', 'O', 'R'])
    expect(moves.every(m => m.direction === 'CW')).toBe(true)
  })

  it("handles prime (CCW) tokens", () => {
    const moves = parseRawSolution("U' R'", [0, 10])
    expect(moves[0].direction).toBe('CCW')
    expect(moves[1].direction).toBe('CCW')
  })

  it('zips tokens with timestamps and assigns serial numbers', () => {
    const moves = parseRawSolution('U R', [0, 200])
    expect(moves[0].cubeTimestamp).toBe(0)
    expect(moves[1].cubeTimestamp).toBe(200)
    expect(moves[0].serial).toBe(0)
    expect(moves[1].serial).toBe(1)
  })

  it('throws on invalid token with position', () => {
    expect(() => parseRawSolution('U R Q L', [0, 10, 20, 30]))
      .toThrow(/Invalid token "Q" at position 2/)
  })

  it('rejects length mismatch between tokens and timestamps', () => {
    expect(() => parseRawSolution('U R L', [0, 10]))
      .toThrow(/raw_timestamps length \(2\) ≠ raw_solution length \(3\)/)
  })

  it('throws on empty raw_solution', () => {
    expect(() => parseRawSolution('', [])).toThrow(/empty/i)
  })

  it('tolerates extra whitespace between tokens', () => {
    const moves = parseRawSolution('  U   R  ', [0, 10])
    expect(moves).toHaveLength(2)
  })
})

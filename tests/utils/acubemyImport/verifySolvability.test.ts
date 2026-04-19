import { describe, it, expect } from 'vitest'
import { verifySolvability } from '../../../src/utils/acubemyImport/verifySolvability'
import type { PositionMove } from '../../../src/types/cube'

function move(face: PositionMove['face'], direction: PositionMove['direction']): PositionMove {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

describe('verifySolvability', () => {
  it('returns true when scramble is inverted by moves (R U followed by U\' R\')', () => {
    const moves: PositionMove[] = [move('U', 'CCW'), move('R', 'CCW')]
    expect(verifySolvability('R U', moves)).toBe(true)
  })

  it('returns false when final state is not solved', () => {
    const moves: PositionMove[] = [move('U', 'CCW')]  // misses R inverse
    expect(verifySolvability('R U', moves)).toBe(false)
  })

  it('returns false for scramble with no moves', () => {
    expect(verifySolvability('R U', [])).toBe(false)
  })

  it('supports double-turn scramble tokens', () => {
    const moves: PositionMove[] = [move('R', 'CW'), move('R', 'CW')]
    expect(verifySolvability('R2', moves)).toBe(true)
  })

  it('throws on unsupported scramble notation (e.g. wide move "Rw")', () => {
    expect(() => verifySolvability("Rw U", [])).toThrow(/Unsupported scramble token "Rw" at position 0/)
  })

  it('throws on rotation in scramble (e.g. "x")', () => {
    expect(() => verifySolvability('x U', [])).toThrow(/Unsupported scramble token "x" at position 0/)
  })
})

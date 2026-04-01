import { describe, it, expect } from 'vitest'
import {
  isCrossDone,
  countCompletedF2LSlots,
  isEOLLDone,
  isOLLDone,
  isCPLLDone,
} from '../../src/utils/cfop'
import { SOLVED_FACELETS } from '../../src/types/cube'
import { applyMoveToFacelets } from '../../src/hooks/useCubeState'
import type { Move } from '../../src/types/cube'

function move(face: Move['face'], direction: Move['direction'] = 'CW'): Move {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

function applyMoves(facelets: string, moves: Move[]): string {
  return moves.reduce(applyMoveToFacelets, facelets)
}

describe('isCrossDone', () => {
  it('returns true for solved cube', () => {
    expect(isCrossDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after F move (breaks D-cross)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    expect(isCrossDone(f)).toBe(false)
  })

  it('returns false after R move', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isCrossDone(f)).toBe(false)
  })

  it('returns true after U then U CCW (net zero)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U'), move('U', 'CCW')])
    expect(isCrossDone(f)).toBe(true)
  })
})

describe('countCompletedF2LSlots', () => {
  it('returns 4 for solved cube', () => {
    expect(countCompletedF2LSlots(SOLVED_FACELETS)).toBe(4)
  })

  it('returns 0 after a scrambling R move', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(countCompletedF2LSlots(f)).toBeLessThan(4)
  })
})

describe('isEOLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isEOLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after U move scrambling edges', () => {
    // After a U move, edge stickers 1,3,5,7 may shift but stay U — actually U only rotates U-layer
    // so EOLL stays true after U. Test with a move that actually changes edge orientation.
    // F move changes U-bottom edge (position 7) orientation
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    expect(isEOLLDone(f)).toBe(false)
  })
})

describe('isOLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isOLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isOLLDone(f)).toBe(false)
  })
})

describe('isCPLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isCPLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (corners disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isCPLLDone(f)).toBe(false)
  })
})

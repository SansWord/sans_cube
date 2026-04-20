import { describe, it, expect } from 'vitest'
import {
  isCrossDone,
  countCompletedF2LSlots,
  isEOLLDone,
  isOLLDone,
  isCPLLDone,
} from '../../src/utils/cfop'
import { SOLVED_FACELETS } from '../../src/types/cube'
import { applyMoveToFacelets } from '../../src/utils/applyMove'
import type { PositionMove, PositionalFace } from '../../src/types/cube'

function move(face: PositionMove['face'], direction: PositionMove['direction'] = 'CW'): PositionMove {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

function applyMoves(facelets: string, moves: PositionMove[]): string {
  return moves.reduce(applyMoveToFacelets, facelets)
}

// Rotate the whole cube by a sequence of rotations (x/y/z) to simulate
// center drift. The cube stays logically solved but centers land on
// non-standard faces.
function rotate(facelets: string, ...rotations: PositionalFace[]): string {
  return rotations.reduce((f, r) => applyMoveToFacelets(f, move(r)), facelets)
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

  it('returns true after y rotation (Y stays on D but adjacent centers drifted)', () => {
    const f = rotate(SOLVED_FACELETS, 'y')
    expect(isCrossDone(f)).toBe(true)
  })

  it('returns true after x rotation (Y center moved to F face)', () => {
    const f = rotate(SOLVED_FACELETS, 'x')
    expect(isCrossDone(f)).toBe(true)
  })

  it('returns true after z rotation (Y center moved to L face)', () => {
    const f = rotate(SOLVED_FACELETS, 'z')
    expect(isCrossDone(f)).toBe(true)
  })

  it('returns false after x rotation then F move', () => {
    const f = applyMoves(rotate(SOLVED_FACELETS, 'x'), [move('F')])
    expect(isCrossDone(f)).toBe(false)
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

  it('returns 4 after y rotation (adjacent centers drifted)', () => {
    const f = rotate(SOLVED_FACELETS, 'y')
    expect(countCompletedF2LSlots(f)).toBe(4)
  })

  it('returns 4 after x rotation (Y center moved to F face)', () => {
    const f = rotate(SOLVED_FACELETS, 'x')
    expect(countCompletedF2LSlots(f)).toBe(4)
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

  it('returns true after x rotation (W center moved to B face)', () => {
    const f = rotate(SOLVED_FACELETS, 'x')
    expect(isEOLLDone(f)).toBe(true)
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

  it('returns true after x rotation (W center moved to B face)', () => {
    const f = rotate(SOLVED_FACELETS, 'x')
    expect(isOLLDone(f)).toBe(true)
  })

  it('returns true after z rotation (W center moved to R face)', () => {
    const f = rotate(SOLVED_FACELETS, 'z')
    expect(isOLLDone(f)).toBe(true)
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

  it('returns true after x rotation (W center moved to B face)', () => {
    const f = rotate(SOLVED_FACELETS, 'x')
    expect(isCPLLDone(f)).toBe(true)
  })
})

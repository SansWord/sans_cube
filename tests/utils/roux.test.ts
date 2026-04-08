import { describe, it, expect } from 'vitest'
import {
  isLDBlockDone,
  isLBBlockDone,
  isRDBlockDone,
  isRFBlockDone,
  isFirstBlockDone,
  isSecondBlockDone,
  isCMLLDone,
  isEODone,
  isULURDone,
} from '../../src/utils/roux'
import { SOLVED_FACELETS } from '../../src/types/cube'
import { applyMoveToFacelets } from '../../src/hooks/useCubeState'
import type { Move } from '../../src/types/cube'

function move(face: Move['face'], direction: Move['direction'] = 'CW'): Move {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

function applyMoves(facelets: string, moves: Move[]): string {
  return moves.reduce(applyMoveToFacelets, facelets)
}

describe('isLDBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isLDBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns true after L move (becomes LB block)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isLBBlockDone(f)).toBe(true)
  })

  it('returns true after R move (right side unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isLDBlockDone(f)).toBe(true)
  })

  it('returns true after U move (DL block unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isLDBlockDone(f)).toBe(true)
  })

  it('returns false after D move (base pieces disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    expect(isLDBlockDone(f)).toBe(false)
  })
})

describe('isRDBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isRDBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns true after R move (becomes RF block)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isRFBlockDone(f)).toBe(true)
  })

  it('returns true after L move (left side unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isRDBlockDone(f)).toBe(true)
  })

  it('returns false after D move (base pieces disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    expect(isRDBlockDone(f)).toBe(false)
  })
})

describe('isFirstBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isFirstBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns true after R move (L block still intact)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isFirstBlockDone(f)).toBe(true)
  })

  it('returns true after L move (R block still intact)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isFirstBlockDone(f)).toBe(true)
  })

  it('returns false after D move (both blocks disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    expect(isFirstBlockDone(f)).toBe(false)
  })
})

describe('isSecondBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isSecondBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (R block broken)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isSecondBlockDone(f)).toBe(false)
  })

  it('returns false after L move (L block broken)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isSecondBlockDone(f)).toBe(false)
  })
})

describe('isCMLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isCMLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (U-layer corners disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isCMLLDone(f)).toBe(false)
  })

  it('returns false after F move (U-layer corners disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    expect(isCMLLDone(f)).toBe(false)
  })

  it('returns false after U move (corners leave home faces)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isCMLLDone(f)).toBe(false)
  })
})

describe('isEODone', () => {
  it('returns true for solved cube', () => {
    expect(isEODone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after F move (flips UF edge)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    expect(isEODone(f)).toBe(false)
  })

  it('returns false after B move (flips UB edge)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('B')])
    expect(isEODone(f)).toBe(false)
  })

  it('returns true after U move (breaks CMLL)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isEODone(f)).toBe(false)
  })
})

describe('isULURDone', () => {
  it('returns true for solved cube', () => {
    expect(isULURDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after U move (UL and UR edges cycle away)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isULURDone(f)).toBe(false)
  })

  it('returns false after L move (UL edge displaced)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isULURDone(f)).toBe(false)
  })

  it('returns false after R move (UR edge displaced)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isULURDone(f)).toBe(false)
  })
})

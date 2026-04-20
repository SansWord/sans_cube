import { describe, it, expect } from 'vitest'
import {
  isFirstBlockDone,
  isSecondBlockDone,
  isCMLLDone,
  isEODone,
  isULURDone,
} from '../../src/utils/roux'
import { SOLVED_FACELETS } from '../../src/types/cube'
import { applyMoveToFacelets } from '../../src/utils/applyMove'
import type { PositionMove, PositionalFace } from '../../src/types/cube'

function move(face: PositionMove['face'], direction: PositionMove['direction'] = 'CW'): PositionMove {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

function applyMoves(facelets: string, moves: PositionMove[]): string {
  return moves.reduce(applyMoveToFacelets, facelets)
}

// Rotate by a sequence of whole-cube rotations (x/y/z) to simulate center drift.
// The cube's logical state is unchanged — only centers land on non-standard faces.
function rotate(facelets: string, ...rotations: PositionalFace[]): string {
  return rotations.reduce((f, r) => applyMoveToFacelets(f, move(r)), facelets)
}

// Every combination of whole-cube rotations of length ≤ 3, including empty.
// Captures the full 24-orientation group plus redundancies, which keeps the
// test spec compact while exercising every possible center drift.
const ROTATION_SEQS: PositionalFace[][] = [
  [],
  ['x'], ['y'], ['z'],
  ['x', 'x'], ['y', 'y'], ['z', 'z'],
  ['x', 'y'], ['x', 'z'], ['y', 'x'], ['y', 'z'], ['z', 'x'], ['z', 'y'],
  ['x', 'x', 'y'], ['x', 'y', 'x'], ['y', 'x', 'y'],
]

function rotLabel(seq: PositionalFace[]): string {
  return seq.length === 0 ? 'identity' : seq.join('·')
}

// Property: for any predicate that asks "is this phase done?", whole-cube
// rotations must not change the answer. A rotated solved cube is still
// solved; a rotated broken cube is still broken.
function checkRotationInvariant(
  fn: (f: string) => boolean,
  baseState: string,
  expected: boolean,
) {
  for (const seq of ROTATION_SEQS) {
    const rotated = rotate(baseState, ...seq)
    expect(fn(rotated), `rotation ${rotLabel(seq)}`).toBe(expected)
  }
}

describe('isFirstBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isFirstBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns true after R move (O-block still intact)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isFirstBlockDone(f)).toBe(true)
  })

  it('returns true after L move (R-block still intact)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isFirstBlockDone(f)).toBe(true)
  })

  it('returns false after D move (bottom row of both blocks disturbed, no Y edge at long position)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    expect(isFirstBlockDone(f)).toBe(false)
  })

  it('is invariant under any whole-cube rotation: solved → true', () => {
    checkRotationInvariant(isFirstBlockDone, SOLVED_FACELETS, true)
  })

  it('is invariant under any whole-cube rotation: after R → true', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    checkRotationInvariant(isFirstBlockDone, f, true)
  })

  it('is invariant under any whole-cube rotation: after L → true', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    checkRotationInvariant(isFirstBlockDone, f, true)
  })

  it('is invariant under any whole-cube rotation: after D → false', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    checkRotationInvariant(isFirstBlockDone, f, false)
  })

  it('stays true after M move (centers drift but block pieces unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('M')])
    expect(isFirstBlockDone(f)).toBe(true)
  })

  it('stays true after M2 (centers drift twice, block pieces unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('M'), move('M')])
    expect(isFirstBlockDone(f)).toBe(true)
  })
})

describe('isSecondBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isSecondBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (R-block broken)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isSecondBlockDone(f)).toBe(false)
  })

  it('returns false after L move (L-block broken)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isSecondBlockDone(f)).toBe(false)
  })

  it('is invariant under any whole-cube rotation: solved → true', () => {
    checkRotationInvariant(isSecondBlockDone, SOLVED_FACELETS, true)
  })

  it('is invariant under any whole-cube rotation: after R → false', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    checkRotationInvariant(isSecondBlockDone, f, false)
  })

  it('is invariant under any whole-cube rotation: after L → false', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    checkRotationInvariant(isSecondBlockDone, f, false)
  })

  it('stays true after M move (both blocks drift together, still aligned)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('M')])
    expect(isSecondBlockDone(f)).toBe(true)
  })

  it('stays true after M2 (both blocks drift together, still aligned)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('M'), move('M')])
    expect(isSecondBlockDone(f)).toBe(true)
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

  it('returns true after U move (corners is allowed to leave home faces)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isCMLLDone(f)).toBe(true)
  })

  // Regression guard for false-positive: blocks complete + U-layer scrambled.
  // Sune (R U R' U R U2 R') is a block-preserving CMLL alg — it scrambles the
  // 4 U-layer corners while leaving FB and SB fully intact. We assert the
  // blocks-complete precondition explicitly so this test can't silently regress
  // by short-circuiting through isSecondBlockDone === false.
  it('returns false when blocks are complete but U-layer corners are scrambled (Sune)', () => {
    const f = applyMoves(SOLVED_FACELETS, [
      move('R'), move('U'), move('R', 'CCW'), move('U'),
      move('R'), move('U'), move('U'), move('R', 'CCW'),
    ])
    expect(isSecondBlockDone(f)).toBe(true)
    expect(isCMLLDone(f)).toBe(false)
  })

  it('stays true after M move (centers drift but CMLL corners unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('M')])
    expect(isCMLLDone(f)).toBe(true)
  })

  it('is invariant under any whole-cube rotation: solved → true', () => {
    checkRotationInvariant(isCMLLDone, SOLVED_FACELETS, true)
  })

  it('is invariant under any whole-cube rotation: after R → false', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    checkRotationInvariant(isCMLLDone, f, false)
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

  it('returns false after U move (breaks CMLL)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isEODone(f)).toBe(false)
  })

  it('is invariant under any whole-cube rotation: solved → true', () => {
    checkRotationInvariant(isEODone, SOLVED_FACELETS, true)
  })

  it('is invariant under any whole-cube rotation: after F → false', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    checkRotationInvariant(isEODone, f, false)
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

  it('is invariant under any whole-cube rotation: solved → true', () => {
    checkRotationInvariant(isULURDone, SOLVED_FACELETS, true)
  })

  it('is invariant under any whole-cube rotation: after U → false', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    checkRotationInvariant(isULURDone, f, false)
  })
})

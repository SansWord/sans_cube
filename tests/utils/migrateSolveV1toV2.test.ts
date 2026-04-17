import { describe, it, expect } from 'vitest'
import { migrateSolveV1toV2, correctMovesV1toV2 } from '../../src/utils/migrateSolveV1toV2'
import { CFOP_SOLVE_1, ROUX_SOLVE_WITH_M } from '../fixtures/solveFixtures'
import type { SolveRecord } from '../../src/types/solve'
import type { Move } from '../../src/types/cube'

// Minimal SolveRecord stub for correctMovesV1toV2 unit tests
function stubSolve(moves: Pick<Move, 'face' | 'direction'>[]): SolveRecord {
  return {
    id: 0, scramble: '', timeMs: 0, date: 0,
    phases: [], method: 'roux',
    moves: moves.map((m, i) => ({ ...m, cubeTimestamp: i, serial: i })),
  }
}

describe('correctMovesV1toV2 — slice direction correction', () => {
  // After M' (CCW): green moves U→F→... wait, M' = U→B, B→D, D→F, F→U
  // Centers after M': U=G(green), F=Y(yellow), D=B(blue), B=W(white)
  // S anchor color = green (G). Green is now at U.
  // E anchor face = D. Opposite of D = U. Green at U → flip direction.

  it('S CW → E CCW after M′ (anchor color on opposite side of new anchor)', () => {
    const result = correctMovesV1toV2(stubSolve([
      { face: 'M', direction: 'CCW' },
      { face: 'S', direction: 'CW' },
    ]))
    expect(result[1].face).toBe('E')
    expect(result[1].direction).toBe('CCW')
  })

  it('S CCW → E CW after M′ (direction flips both ways)', () => {
    const result = correctMovesV1toV2(stubSolve([
      { face: 'M', direction: 'CCW' },
      { face: 'S', direction: 'CCW' },
    ]))
    expect(result[1].face).toBe('E')
    expect(result[1].direction).toBe('CW')
  })

  it('S CW → E CW after M (anchor color lands on same side as new anchor)', () => {
    // After M (CW): U→F, F→D, D→B, B→U for centers
    // Centers: U=B(blue), F=W(white), D=G(green), B=Y(yellow)
    // Green is now at D. E anchor face = D. Same side → keep direction.
    const result = correctMovesV1toV2(stubSolve([
      { face: 'M', direction: 'CW' },
      { face: 'S', direction: 'CW' },
    ]))
    expect(result[1].face).toBe('E')
    expect(result[1].direction).toBe('CW')
  })

  it('S CW stays S CW with no prior M/E/S (no center drift)', () => {
    const result = correctMovesV1toV2(stubSolve([
      { face: 'S', direction: 'CW' },
    ]))
    expect(result[0].face).toBe('S')
    expect(result[0].direction).toBe('CW')
  })

  it('face moves (U/L/R/F/D/B) preserve direction after M′', () => {
    // After M', white is at B. U CW → B CW (direction kept).
    const result = correctMovesV1toV2(stubSolve([
      { face: 'M', direction: 'CCW' },
      { face: 'U', direction: 'CW' },
    ]))
    expect(result[1].face).toBe('B')
    expect(result[1].direction).toBe('CW')
  })
})

describe('migrateSolveV1toV2 — fast path (no M/E/S)', () => {
  it('bumps schemaVersion to 2', () => {
    const result = migrateSolveV1toV2(CFOP_SOLVE_1)
    expect(result.schemaVersion).toBe(2)
  })

  it('does not reallocate moves array (reference equality)', () => {
    const result = migrateSolveV1toV2(CFOP_SOLVE_1)
    expect(result.moves).toBe(CFOP_SOLVE_1.moves)
  })

  it('does not add movesV1', () => {
    const result = migrateSolveV1toV2(CFOP_SOLVE_1)
    expect(result.movesV1).toBeUndefined()
  })

  it('is idempotent: migrating a v2 record returns the same shape', () => {
    const once = migrateSolveV1toV2(CFOP_SOLVE_1)
    const twice = migrateSolveV1toV2(once)
    expect(twice.schemaVersion).toBe(2)
    expect(twice.moves).toBe(once.moves)
  })
})

describe('migrateSolveV1toV2 — full path (has M/E/S), graceful fallback', () => {
  // ROUX_SOLVE_WITH_M is a v2 fixture (corrected moves + correct phases).
  // Migration is a one-way v1→v2 transform: it re-derives faces using the ORIGINAL GAN color map
  // (FACE_TO_COLOR: U→W, F→G, etc.), which is NOT idempotent on v2 moves.
  // After the first M move, center-tracked v2 labels no longer match color-map lookups,
  // so computePhases on the re-derived moves returns null → graceful fallback.
  // These tests verify the fallback produces no data corruption.

  it('does not corrupt data: total move count is unchanged', () => {
    const result = migrateSolveV1toV2(ROUX_SOLVE_WITH_M)
    expect(result.moves.length).toBe(ROUX_SOLVE_WITH_M.moves.length)
  })

  it('does not corrupt data: timeMs is unchanged', () => {
    const result = migrateSolveV1toV2(ROUX_SOLVE_WITH_M)
    expect(result.timeMs).toBe(ROUX_SOLVE_WITH_M.timeMs)
  })

  it('does not corrupt data: phase count is unchanged', () => {
    const result = migrateSolveV1toV2(ROUX_SOLVE_WITH_M)
    expect(result.phases.length).toBe(ROUX_SOLVE_WITH_M.phases.length)
  })

  it('does not corrupt data: phase turn counts are unchanged', () => {
    const result = migrateSolveV1toV2(ROUX_SOLVE_WITH_M)
    for (let i = 0; i < result.phases.length; i++) {
      expect(result.phases[i].turns).toBe(ROUX_SOLVE_WITH_M.phases[i].turns)
    }
  })
})

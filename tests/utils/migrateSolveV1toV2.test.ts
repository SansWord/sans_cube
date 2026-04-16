import { describe, it, expect } from 'vitest'
import { migrateSolveV1toV2 } from '../../src/utils/migrateSolveV1toV2'
import { CFOP_SOLVE_1, ROUX_SOLVE_WITH_M } from '../fixtures/solveFixtures'

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

describe('migrateSolveV1toV2 — full path (has M/E/S)', () => {
  // ROUX_SOLVE_WITH_M has M moves with phases computed under the old (wrong) M cycle.
  // The phase invariant check detects this mismatch and returns the solve unchanged (graceful fallback).
  // These tests verify the fallback behavior: no data corruption, all original fields preserved.

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

  // Note: after ROUX_SOLVE_1 fixture is updated in Task 4, these tests can be revisited.
  // Once the fixture has correct phases (computed with new M cycle), migration should succeed
  // and produce schemaVersion=2 + movesV1 + corrected moves.
})

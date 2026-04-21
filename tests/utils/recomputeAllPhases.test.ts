import { describe, it, expect } from 'vitest'
import { recomputeAllPhases } from '../../src/utils/recomputeAllPhases'
import { recomputePhases } from '../../src/utils/recomputePhases'
import { ROUX } from '../../src/methods/roux'
import { ROUX_SOLVE_1 } from '../fixtures/solveFixtures'
import type { SolveRecord } from '../../src/types/solve'

describe('recomputeAllPhases', () => {
  it('returns empty buckets for empty input', () => {
    const result = recomputeAllPhases([])
    expect(result.unchanged).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual([])
  })

  it('skips isExample solves', () => {
    const example: SolveRecord = {
      id: 1, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, isExample: true,
    }
    const result = recomputeAllPhases([example])
    expect(result.skipped).toEqual([example])
    expect(result.unchanged).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('skips freeform solves', () => {
    const freeform: SolveRecord = {
      id: 2, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'freeform',
    }
    const result = recomputeAllPhases([freeform])
    expect(result.skipped).toEqual([freeform])
  })

  it('buckets a solve with no moves into failed', () => {
    const noMoves: SolveRecord = {
      id: 3, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop',
    }
    const result = recomputeAllPhases([noMoves])
    expect(result.failed).toEqual([noMoves])
    expect(result.changed).toEqual([])
    expect(result.unchanged).toEqual([])
  })

  it('unchanged when stored phases exactly match a fresh recompute', () => {
    const solve = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(solve, ROUX)!
    const withFreshPhases: SolveRecord = { ...solve, phases: fresh }
    const result = recomputeAllPhases([withFreshPhases])
    expect(result.unchanged).toHaveLength(1)
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('changed when stored phases differ from a fresh recompute', () => {
    const solve = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(solve, ROUX)!
    const stalePhases = fresh.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p)
    const withStale: SolveRecord = { ...solve, phases: stalePhases }
    const result = recomputeAllPhases([withStale])
    expect(result.changed).toHaveLength(1)
    expect(result.changed[0].solve).toBe(withStale)
    expect(result.changed[0].oldPhases).toBe(stalePhases)
    expect(result.changed[0].newPhases).toEqual(fresh)
    expect(result.unchanged).toEqual([])
  })

  it('partitions a mixed list', () => {
    const example: SolveRecord = { id: 10, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, isExample: true }
    const noMoves: SolveRecord = { id: 11, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }
    const freeform: SolveRecord = { id: 12, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'freeform' }

    const roux = { ...ROUX_SOLVE_1, id: 13, method: 'roux' as const, isExample: false }
    const freshRoux = recomputePhases(roux, ROUX)!
    const unchangedSolve: SolveRecord = { ...roux, phases: freshRoux }
    const changedSolve: SolveRecord = { ...roux, id: 14, phases: freshRoux.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p) }

    const result = recomputeAllPhases([example, noMoves, freeform, unchangedSolve, changedSolve])
    expect(result.skipped).toHaveLength(2)
    expect(result.failed).toEqual([noMoves])
    expect(result.unchanged).toEqual([unchangedSolve])
    expect(result.changed).toHaveLength(1)
    expect(result.changed[0].solve).toBe(changedSolve)
  })
})

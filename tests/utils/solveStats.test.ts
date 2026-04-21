import { describe, it, expect } from 'vitest'
import { computeAo, computeStats, filterSolves } from '../../src/utils/solveStats'
import type { SolveRecord, SolveFilter } from '../../src/types/solve'

function makeSolve(id: number, timeMs: number): SolveRecord {
  return { id, scramble: '', timeMs, moves: [], phases: [], date: 0 }
}

describe('computeAo', () => {
  it('returns null when not enough solves', () => {
    expect(computeAo([makeSolve(1, 20000), makeSolve(2, 22000)], 5)).toBeNull()
  })

  it('computes ao5 dropping best and worst', () => {
    const solves = [10000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    expect(computeAo(solves, 5)).toBeCloseTo(30000)
  })

  it('ao5 uses last 5 solves', () => {
    const solves = [10000, 99000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    expect(computeAo(solves, 5)).toBeCloseTo(40000)
  })

  it('computes ao1 (single) without dropping', () => {
    expect(computeAo([makeSolve(1, 23000)], 1)).toBeCloseTo(23000)
  })
})

describe('computeStats', () => {
  it('returns null stats when no solves', () => {
    const stats = computeStats([])
    expect(stats.single.current).toBeNull()
    expect(stats.single.best).toBeNull()
  })

  it('returns single time when one solve', () => {
    const stats = computeStats([makeSolve(1, 23000)])
    expect(stats.single.current).toBeCloseTo(23000)
    expect(stats.single.best).toBeCloseTo(23000)
  })

  it('best single is the lowest time', () => {
    const solves = [makeSolve(1, 30000), makeSolve(2, 20000), makeSolve(3, 25000)]
    const stats = computeStats(solves)
    expect(stats.single.best).toBeCloseTo(20000)
    expect(stats.single.current).toBeCloseTo(25000)
  })
})

describe('filterSolves (smoke)', () => {
  it('all+all returns every solve', () => {
    const s1 = { ...makeSolve(1, 10000), method: 'cfop', driver: 'cube' as const }
    const s2 = { ...makeSolve(2, 12000), method: 'roux', driver: 'mouse' as const }
    const f: SolveFilter = { method: 'all', driver: 'all' }
    expect(filterSolves([s1, s2], f)).toEqual([s1, s2])
  })
})

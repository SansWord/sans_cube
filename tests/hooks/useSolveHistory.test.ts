import { describe, it, expect } from 'vitest'
import { computeStats, computeAo } from '../../src/hooks/useSolveHistory'
import type { SolveRecord } from '../../src/types/solve'

function makeSolve(id: number, timeMs: number): SolveRecord {
  return { id, scramble: '', timeMs, moves: [], phases: [], date: 0 }
}

describe('computeAo', () => {
  it('returns null when not enough solves', () => {
    const solves = [makeSolve(1, 20000), makeSolve(2, 22000)]
    expect(computeAo(solves, 5)).toBeNull()
  })

  it('computes ao5 dropping best and worst', () => {
    // times: 10, 20, 30, 40, 50 → drop 10 and 50 → avg(20,30,40) = 30
    const solves = [10000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    const ao5 = computeAo(solves, 5)
    expect(ao5).toBeCloseTo(30000)
  })

  it('ao5 uses last 5 solves', () => {
    const solves = [10000, 99000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    // last 5: 99000,20000,30000,40000,50000 → drop 99000 and 20000 → avg(30000,40000,50000) = 40000
    const ao5 = computeAo(solves, 5)
    expect(ao5).toBeCloseTo(40000)
  })

  it('computes ao1 (single) without dropping', () => {
    const solves = [makeSolve(1, 23000)]
    expect(computeAo(solves, 1)).toBeCloseTo(23000)
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
    expect(stats.single.current).toBeCloseTo(25000) // latest
  })
})

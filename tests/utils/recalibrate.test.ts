import { describe, it, expect } from 'vitest'
import { recalibrateSolveTimes } from '../../src/utils/recalibrate'
import type { SolveRecord } from '../../src/types/solve'

function makeSolve(timeMs: number, cubeTsSpan: number, overrides?: Partial<SolveRecord>): SolveRecord {
  const base = 1_000_000
  return {
    id: 1, seq: 1, scramble: '', timeMs, date: 0,
    moves: [
      { face: 'U', direction: 'CW', cubeTimestamp: base, serial: 0 },
      { face: 'U', direction: 'CCW', cubeTimestamp: base + cubeTsSpan, serial: 1 },
    ],
    phases: [],
    ...overrides,
  }
}

describe('recalibrateSolveTimes', () => {
  it('corrects timeMs when stored time is inflated vs hardware span', () => {
    const solve = makeSolve(1500, 1000)  // stored 1500ms, hardware says 1000ms
    const [result] = recalibrateSolveTimes([solve])
    expect(result.timeMs).toBe(1000)
  })

  it('does not change timeMs when stored time matches hardware span', () => {
    const solve = makeSolve(1000, 1000)
    const [result] = recalibrateSolveTimes([solve])
    expect(result.timeMs).toBe(1000)
  })

  it('does not inflate timeMs when hardware span is larger than stored time', () => {
    // Shouldn't happen in practice, but guard against it
    const solve = makeSolve(900, 1000)
    const [result] = recalibrateSolveTimes([solve])
    expect(result.timeMs).toBe(900)
  })

  it('skips solves with fewer than 2 moves', () => {
    const solve: SolveRecord = {
      id: 1, seq: 1, scramble: '', timeMs: 500, date: 0,
      moves: [{ face: 'U', direction: 'CW', cubeTimestamp: 1000, serial: 0 }],
      phases: [],
    }
    const [result] = recalibrateSolveTimes([solve])
    expect(result.timeMs).toBe(500)
  })

  it('skips example solves (negative id)', () => {
    const solve = makeSolve(1500, 1000, { id: -1 })
    const [result] = recalibrateSolveTimes([solve])
    expect(result.timeMs).toBe(1500)
  })

  it('processes multiple solves independently', () => {
    const solves = [makeSolve(1500, 1000), makeSolve(800, 800)]
    const results = recalibrateSolveTimes(solves)
    expect(results[0].timeMs).toBe(1000)
    expect(results[1].timeMs).toBe(800)
  })
})

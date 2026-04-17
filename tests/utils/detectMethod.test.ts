import { describe, it, expect } from 'vitest'
import { detectMethodMismatches } from '../../src/utils/detectMethod'
import { CFOP_SOLVE_1 } from '../fixtures/solveFixtures'
import type { SolveRecord } from '../../src/types/solve'

describe('detectMethodMismatches', () => {
  it('does not flag solves with method=freeform even if moves look like CFOP', () => {
    const freeformSolve: SolveRecord = { ...CFOP_SOLVE_1, id: 999, method: 'freeform', isExample: false }
    const mismatches = detectMethodMismatches([freeformSolve])
    expect(mismatches).toEqual([])
  })

  it('does not suggest freeform as a replacement method', () => {
    const solves: SolveRecord[] = [{ ...CFOP_SOLVE_1, id: 1000, method: 'roux', isExample: false }]
    const mismatches = detectMethodMismatches(solves)
    for (const m of mismatches) {
      expect(m.suggestedMethod).not.toBe('freeform')
    }
  })
})

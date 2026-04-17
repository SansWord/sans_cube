import { describe, it, expect } from 'vitest'
import { detectMethodMismatches } from '../../src/utils/detectMethod'
import { CFOP_SOLVE_1 } from '../fixtures/solveFixtures'
import type { SolveRecord } from '../../src/types/solve'

describe('detectMethodMismatches', () => {
  it('skips freeform solves — they are never flagged as mismatches', () => {
    const freeformSolve: SolveRecord = { ...CFOP_SOLVE_1, id: 999, method: 'freeform', isExample: false }
    const mismatches = detectMethodMismatches([freeformSolve])
    expect(mismatches).toHaveLength(0)
  })
})

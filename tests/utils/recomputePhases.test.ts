// tests/utils/recomputePhases.test.ts
import { describe, it, expect } from 'vitest'
import { recomputePhases } from '../../src/utils/recomputePhases'
import { isSolvedFacelets } from '../../src/hooks/useCubeState'
import { CFOP } from '../../src/methods/cfop'
import { ROUX } from '../../src/methods/roux'
import { EXAMPLE_SOLVES } from '../../src/data/exampleSolves'
import type { SolveRecord, SolveMethod } from '../../src/types/solve'
import type { Move } from '../../src/types/cube'

function makeMove(face: Move['face'], dir: Move['direction'], ts: number): Move {
  return { face, direction: dir, cubeTimestamp: ts, serial: 0 }
}

function makeSolve(scramble: string, moves: Move[]): SolveRecord {
  return { id: 1, seq: 1, scramble, timeMs: 0, moves, phases: [], date: 0 }
}

// Single phase that completes when cube is solved — simplest testable method
const SINGLE_PHASE_METHOD: SolveMethod = {
  id: 'test', label: 'Test',
  phases: [{ label: 'Solve', color: '#fff', isComplete: isSolvedFacelets }],
}

describe('recomputePhases', () => {
  // Scramble "U" = one U CW applied to solved cube.
  // Three more U CW moves = four U CW total = identity = solved.

  it('returns null when moves do not solve the cube', () => {
    // U scramble + one more U CW = two U CW total = U2, not solved
    const solve = makeSolve('U', [makeMove('U', 'CW', 1000)])
    expect(recomputePhases(solve, SINGLE_PHASE_METHOD)).toBeNull()
  })

  it('returns null when moves array is empty', () => {
    const solve = makeSolve('U', [])
    expect(recomputePhases(solve, SINGLE_PHASE_METHOD)).toBeNull()
  })

  it('returns phases with correct label', () => {
    // U scramble + 3× U CW = 4× U CW = solved
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)
    expect(phases).not.toBeNull()
    expect(phases).toHaveLength(1)
    expect(phases![0].label).toBe('Solve')
  })

  it('turns count equals total move count', () => {
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)!
    const totalTurns = phases.reduce((sum, p) => sum + p.turns, 0)
    expect(totalTurns).toBe(3)
  })

  it('first phase has recognitionMs = 0 (phase starts at first move)', () => {
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)!
    expect(phases[0].recognitionMs).toBe(0)
  })

  it('executionMs reflects cubeTimestamp span from first to last move', () => {
    const solve = makeSolve('U', [
      makeMove('U', 'CW', 1000),
      makeMove('U', 'CW', 2000),
      makeMove('U', 'CW', 3000),
    ])
    const phases = recomputePhases(solve, SINGLE_PHASE_METHOD)!
    // first move ts = 1000, last move ts = 3000, so executionMs = 2000
    expect(phases[0].executionMs).toBe(2000)
  })

  it('total turns across phases equals move count for a real CFOP example solve', () => {
    const cfopSolve = EXAMPLE_SOLVES.find((s) => (s.method ?? 'cfop') === 'cfop' && s.moves.length > 0)
    if (!cfopSolve) throw new Error('No CFOP example solve found')
    const phases = recomputePhases(cfopSolve, CFOP)
    expect(phases).not.toBeNull()
    const totalTurns = phases!.reduce((sum, p) => sum + p.turns, 0)
    expect(totalTurns).toBe(cfopSolve.moves.length)
  })

  it('total turns across phases equals move count for a real Roux example solve', () => {
    const rouxSolve = EXAMPLE_SOLVES.find((s) => s.method === 'roux' && s.moves.length > 0)
    if (!rouxSolve) throw new Error('No Roux example solve found')
    const phases = recomputePhases(rouxSolve, ROUX)
    expect(phases).not.toBeNull()
    const totalTurns = phases!.reduce((sum, p) => sum + p.turns, 0)
    expect(totalTurns).toBe(rouxSolve.moves.length)
  })

  it('all phases have non-negative recognitionMs and executionMs', () => {
    const cfopSolve = EXAMPLE_SOLVES.find((s) => (s.method ?? 'cfop') === 'cfop' && s.moves.length > 0)
    if (!cfopSolve) throw new Error('No CFOP example solve found')
    const phases = recomputePhases(cfopSolve, CFOP)
    expect(phases).not.toBeNull()
    for (const p of phases!) {
      expect(p.recognitionMs).toBeGreaterThanOrEqual(0)
      expect(p.executionMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('CFOP recompute produces phases whose labels are all from the CFOP phase list', () => {
    const cfopSolve = EXAMPLE_SOLVES.find((s) => (s.method ?? 'cfop') === 'cfop' && s.moves.length > 0)
    if (!cfopSolve) throw new Error('No CFOP example solve found')
    const phases = recomputePhases(cfopSolve, CFOP)
    expect(phases).not.toBeNull()
    const validLabels = new Set(CFOP.phases.map((p) => p.label))
    for (const p of phases!) {
      expect(validLabels.has(p.label)).toBe(true)
    }
  })

  it('CFOP merge rules: if CPLL phase has 0 turns it is absorbed (turns=0 and EPLL gets the timing)', () => {
    // Use real CFOP example solve — if it contains a CPLL with 0 turns, verify the merge ran correctly.
    // If the example solve does not trigger this case, this test still validates phase count is <= CFOP.phases.length.
    const cfopSolve = EXAMPLE_SOLVES.find((s) => (s.method ?? 'cfop') === 'cfop' && s.moves.length > 0)
    if (!cfopSolve) throw new Error('No CFOP example solve found')
    const phases = recomputePhases(cfopSolve, CFOP)
    expect(phases).not.toBeNull()
    // After merge rules, phase count should be <= number of CFOP phases (never more)
    expect(phases!.length).toBeLessThanOrEqual(CFOP.phases.length)
    // If CPLL has 0 turns, the merged CPLL should carry 0 turns and EPLL should carry the timing
    const cpll = phases!.find((p) => p.label === 'CPLL')
    const epll = phases!.find((p) => p.label === 'EPLL')
    if (cpll && epll && cpll.turns === 0) {
      // Merge rule ran: CPLL has 0 recognition and execution, EPLL has the combined timing
      expect(cpll.recognitionMs).toBe(0)
      expect(cpll.executionMs).toBe(0)
      expect(epll.recognitionMs).toBeGreaterThanOrEqual(0)
      expect(epll.executionMs).toBeGreaterThanOrEqual(0)
    }
  })
})

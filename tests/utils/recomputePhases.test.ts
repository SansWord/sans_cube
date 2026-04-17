// tests/utils/recomputePhases.test.ts
import { describe, it, expect } from 'vitest'
import { recomputePhases } from '../../src/utils/recomputePhases'
import { isSolvedFacelets } from '../../src/utils/applyMove'
import { CFOP } from '../../src/methods/cfop'
import { ROUX } from '../../src/methods/roux'
import { CFOP_SOLVES, ROUX_SOLVES } from '../fixtures/solveFixtures'
import type { SolveRecord, SolveMethod } from '../../src/types/solve'
import type { PositionMove } from '../../src/types/cube'

function makeMove(face: PositionMove['face'], dir: PositionMove['direction'], ts: number): PositionMove {
  return { face, direction: dir, cubeTimestamp: ts, serial: 0 }
}

function makeSolve(scramble: string, moves: PositionMove[]): SolveRecord {
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

  it.each(CFOP_SOLVES.map((s, i) => ({ label: `CFOP solve ${i + 1}`, solve: s })))(
    'total turns across phases equals move count ($label)',
    ({ solve }) => {
      const phases = recomputePhases(solve, CFOP)
      expect(phases).not.toBeNull()
      expect(phases!.reduce((sum, p) => sum + p.turns, 0)).toBe(solve.moves.length)
    }
  )

  it.each(ROUX_SOLVES.map((s, i) => ({ label: `Roux solve ${i + 1}`, solve: s })))(
    'total turns across phases equals move count ($label)',
    ({ solve }) => {
      const phases = recomputePhases(solve, ROUX)
      expect(phases).not.toBeNull()
      expect(phases!.reduce((sum, p) => sum + p.turns, 0)).toBe(solve.moves.length)
    }
  )

  it.each(CFOP_SOLVES.map((s, i) => ({ label: `CFOP solve ${i + 1}`, solve: s })))(
    'all phases have non-negative recognitionMs and executionMs ($label)',
    ({ solve }) => {
      const phases = recomputePhases(solve, CFOP)
      expect(phases).not.toBeNull()
      for (const p of phases!) {
        expect(p.recognitionMs).toBeGreaterThanOrEqual(0)
        expect(p.executionMs).toBeGreaterThanOrEqual(0)
      }
    }
  )

  it.each(CFOP_SOLVES.map((s, i) => ({ label: `CFOP solve ${i + 1}`, solve: s })))(
    'phase labels are all from the CFOP phase list ($label)',
    ({ solve }) => {
      const phases = recomputePhases(solve, CFOP)
      expect(phases).not.toBeNull()
      const validLabels = new Set(CFOP.phases.map((p) => p.label))
      for (const p of phases!) {
        expect(validLabels.has(p.label)).toBe(true)
      }
    }
  )

  // ── Round-trip tests ──────────────────────────────────────────────────────
  // Each case: solve with startMethod → recompute to midMethod → recompute back → compare with original.
  // turns, recognitionMs, and executionMs must be exactly equal after a full round-trip.
  // To add a new case: add a solve to CFOP_SOLVES or ROUX_SOLVES in tests/fixtures/solveFixtures.ts.

  type RoundTripCase = { label: string; solve: SolveRecord; startMethod: SolveMethod; midMethod: SolveMethod }
  const CFOP_ROUND_TRIP_CASES: RoundTripCase[] = [
    ...CFOP_SOLVES.map((s, i) => ({ label: `CFOP solve ${i + 1}: CFOP→Roux→CFOP`, solve: s, startMethod: CFOP, midMethod: ROUX })),
  ]
  const ROUX_ROUND_TRIP_CASES: RoundTripCase[] = [
    ...ROUX_SOLVES.map((s, i) => ({ label: `Roux solve ${i + 1}: Roux→CFOP→Roux`, solve: s, startMethod: ROUX, midMethod: CFOP })),
  ]

  it.each(CFOP_ROUND_TRIP_CASES)('round-trip turns: $label', ({ solve, startMethod, midMethod }) => {
    const original = recomputePhases(solve, startMethod)
    expect(original).not.toBeNull()

    const mid = recomputePhases(solve, midMethod)
    expect(mid).not.toBeNull()

    const withMidMethod: SolveRecord = { ...solve, method: midMethod.id, phases: mid! }
    const roundTrip = recomputePhases(withMidMethod, startMethod)
    expect(roundTrip).not.toBeNull()

    // same moves → same cube states → same phase boundaries → identical turn counts
    expect(roundTrip!.map((p) => p.turns)).toEqual(original!.map((p) => p.turns))
  })

  it.each(ROUX_ROUND_TRIP_CASES)('round-trip turns: $label', ({ solve, startMethod, midMethod }) => {
    const original = recomputePhases(solve, startMethod)
    expect(original).not.toBeNull()
    const mid = recomputePhases(solve, midMethod)
    expect(mid).not.toBeNull()
    const withMidMethod: SolveRecord = { ...solve, method: midMethod.id, phases: mid! }
    const roundTrip = recomputePhases(withMidMethod, startMethod)
    expect(roundTrip).not.toBeNull()
    expect(roundTrip!.map((p) => p.turns)).toEqual(original!.map((p) => p.turns))
  })

  it.each(CFOP_ROUND_TRIP_CASES)('round-trip timing: $label', ({ solve, startMethod, midMethod }) => {
    const original = recomputePhases(solve, startMethod)
    expect(original).not.toBeNull()

    const mid = recomputePhases(solve, midMethod)
    expect(mid).not.toBeNull()

    const withMidMethod: SolveRecord = { ...solve, method: midMethod.id, phases: mid! }
    const roundTrip = recomputePhases(withMidMethod, startMethod)
    expect(roundTrip).not.toBeNull()

    // cubeTimestamps are immutable → timing is exactly equal, not just approximately
    for (let i = 0; i < original!.length; i++) {
      expect(roundTrip![i].recognitionMs).toBe(original![i].recognitionMs)
      expect(roundTrip![i].executionMs).toBe(original![i].executionMs)
    }
  })

  it.each(ROUX_ROUND_TRIP_CASES)('round-trip timing: $label', ({ solve, startMethod, midMethod }) => {
    const original = recomputePhases(solve, startMethod)
    expect(original).not.toBeNull()
    const mid = recomputePhases(solve, midMethod)
    expect(mid).not.toBeNull()
    const withMidMethod: SolveRecord = { ...solve, method: midMethod.id, phases: mid! }
    const roundTrip = recomputePhases(withMidMethod, startMethod)
    expect(roundTrip).not.toBeNull()
    for (let i = 0; i < original!.length; i++) {
      expect(roundTrip![i].recognitionMs).toBe(original![i].recognitionMs)
      expect(roundTrip![i].executionMs).toBe(original![i].executionMs)
    }
  })

  it.each(CFOP_SOLVES.map((s, i) => ({ label: `CFOP solve ${i + 1}`, solve: s })))(
    'CFOP merge rules: phase count <= CFOP phases, CPLL absorbed when 0 turns ($label)',
    ({ solve }) => {
      // If the solve contains a CPLL with 0 turns, verify the merge ran correctly.
      // If it does not trigger this case, this test still validates phase count is <= CFOP.phases.length.
      const phases = recomputePhases(solve, CFOP)
      expect(phases).not.toBeNull()
      expect(phases!.length).toBeLessThanOrEqual(CFOP.phases.length)
      const cpll = phases!.find((p) => p.label === 'CPLL')
      const epll = phases!.find((p) => p.label === 'EPLL')
      if (cpll && epll && cpll.turns === 0) {
        expect(cpll.recognitionMs).toBe(0)
        expect(cpll.executionMs).toBe(0)
        expect(epll.recognitionMs).toBeGreaterThanOrEqual(0)
        expect(epll.executionMs).toBeGreaterThanOrEqual(0)
      }
    }
  )
})

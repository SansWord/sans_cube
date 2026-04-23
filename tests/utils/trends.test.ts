import { describe, it, expect } from 'vitest'
import { buildTotalData, buildPhaseData, buildStatsData, windowStats } from '../../src/utils/trends'
import type { SolveRecord, PhaseRecord } from '../../src/types/solve'
import type { StatsSolvePoint, SortMode } from '../../src/utils/trends'

// ─── helpers ────────────────────────────────────────────────────────────────

function makePhase(
  label: string,
  execMs: number,
  recogMs: number,
  group?: string,
): PhaseRecord {
  return { label, group, executionMs: execMs, recognitionMs: recogMs, turns: 0 }
}

function makeSolve(
  id: number,
  phases: PhaseRecord[],
  opts: { method?: string; isExample?: boolean; date?: number } = {},
): SolveRecord {
  return {
    id,
    seq: id,
    scramble: '',
    timeMs: phases.reduce((s, p) => s + p.executionMs + p.recognitionMs, 0),
    moves: [],
    phases,
    date: opts.date ?? 0,
    method: opts.method ?? 'cfop',
    isExample: opts.isExample,
  }
}

/** Shortcut: build a StatsSolvePoint[] from SolveRecord[] via the new pipeline. */
function statsOf(solves: SolveRecord[], sortMode: SortMode = 'seq', window: number | 'all' = 'all'): StatsSolvePoint[] {
  return windowStats(buildStatsData(solves, sortMode), window)
}

// ─── buildStatsData ──────────────────────────────────────────────────────────

describe('buildStatsData', () => {
  it('seq mode: assigns xIndex in seq order', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)]),
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 750, 0)]),
    ]
    const result = buildStatsData(solves, 'seq')
    expect(result).toHaveLength(3)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].id).toBe(1)   // seq=1 → first
    expect(result[1].xIndex).toBe(2)
    expect(result[1].id).toBe(2)
    expect(result[2].xIndex).toBe(3)
    expect(result[2].id).toBe(3)
  })

  it('date mode: assigns xIndex in date order', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),
    ]
    const result = buildStatsData(solves, 'date')
    expect(result[0].xIndex).toBe(1)
    expect(result[0].id).toBe(3)   // date=1000 → oldest → xIndex 1
    expect(result[2].xIndex).toBe(3)
    expect(result[2].id).toBe(1)   // date=3000 → newest → xIndex 3
  })

  it('strips example solves from output', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    const result = buildStatsData(solves, 'seq')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(2)
    expect(result[0].xIndex).toBe(1)
  })

  it('output points do not contain moves, scramble, or seq', () => {
    const solves = [makeSolve(1, [makePhase('A', 1000, 0)])]
    const result = buildStatsData(solves, 'seq')
    expect('moves' in result[0]).toBe(false)
    expect('scramble' in result[0]).toBe(false)
    expect('seq' in result[0]).toBe(false)
  })

  it('applies cfop/cube defaults for missing method/driver', () => {
    const solve: SolveRecord = {
      id: 1, scramble: '', timeMs: 5000, moves: [], phases: [], date: 0,
      // method and driver intentionally absent
    }
    const result = buildStatsData([solve], 'seq')
    expect(result[0].method).toBe('cfop')
    expect(result[0].driver).toBe('cube')
  })
})

// ─── windowStats ─────────────────────────────────────────────────────────────

describe('windowStats', () => {
  it('last-N: returns the last N entries with original xIndex values preserved', () => {
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 10 },
      { id: 2, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 20 },
      { id: 3, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 30 },
    ]
    const result = windowStats(points, 2)
    expect(result).toHaveLength(2)
    expect(result[0].xIndex).toBe(20)   // not renumbered
    expect(result[1].xIndex).toBe(30)
  })

  it('returns all entries unchanged when windowSize is all', () => {
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 5 },
      { id: 2, date: 0, timeMs: 0, phases: [], method: 'cfop', driver: 'cube', xIndex: 10 },
    ]
    const result = windowStats(points, 'all')
    expect(result).toHaveLength(2)
    expect(result[0].xIndex).toBe(5)
    expect(result[1].xIndex).toBe(10)
  })
})

// ─── buildTotalData ──────────────────────────────────────────────────────────

describe('buildTotalData', () => {
  it('returns one entry per solve with exec = sum(executionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
      makeSolve(2, [makePhase('Cross', 1200, 600), makePhase('F2L', 2800, 300)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(4000)  // 1000 + 3000
    expect(result[1].exec).toBe(4000)  // 1200 + 2800
  })

  it('returns recog = sum(recognitionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result[0].recog).toBe(900)  // 500 + 400
  })

  it('returns total = exec + recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result[0].total).toBe(4900)  // 4000 + 900
  })

  it('xIndex comes from input StatsSolvePoint, not position', () => {
    // Directly construct StatsSolvePoint[] with non-sequential xIndex values.
    // buildTotalData must pass them through unchanged.
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [makePhase('A', 1000, 0)], method: 'cfop', driver: 'cube', xIndex: 100 },
      { id: 2, date: 0, timeMs: 0, phases: [makePhase('A', 2000, 0)], method: 'cfop', driver: 'cube', xIndex: 200 },
      { id: 3, date: 0, timeMs: 0, phases: [makePhase('A', 3000, 0)], method: 'cfop', driver: 'cube', xIndex: 350 },
    ]
    const result = buildTotalData(points)
    expect(result[0].xIndex).toBe(100)
    expect(result[1].xIndex).toBe(200)
    expect(result[2].xIndex).toBe(350)
  })

  it('stores the solve id in solveId', () => {
    const solves = [makeSolve(42, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(statsOf(solves))
    expect(result[0].solveId).toBe(42)
  })

  it('slices to last N solves when window is a number', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(statsOf(solves, 'seq', 2))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(2000)
    expect(result[1].exec).toBe(3000)
  })

  it('excludes example solves from data and from window count', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(statsOf(solves))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(2000)
  })

  it('excludes example solves when applying window slice', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)], { isExample: true }),
      makeSolve(3, [makePhase('A', 3000, 0)]),
      makeSolve(4, [makePhase('A', 4000, 0)]),
    ]
    // 3 real solves (1, 3, 4), window=2 → last 2 real = solves 3 and 4
    const result = buildTotalData(statsOf(solves, 'seq', 2))
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(3000)
    expect(result[1].exec).toBe(4000)
  })

  it('execAo5 is null when fewer than 5 solves are in the window', () => {
    const solves = Array.from({ length: 4 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(statsOf(solves))
    expect(result.every(p => p.execAo5 === null)).toBe(true)
  })

  it('execAo5 is computed (trimmed mean) once 5+ solves available', () => {
    // exec values: 1000, 2000, 3000, 4000, 5000 → trim 1000 and 5000 → mean(2000,3000,4000) = 3000
    const values = [1000, 2000, 3000, 4000, 5000]
    const solves = values.map((v, i) => makeSolve(i + 1, [makePhase('A', v, 0)]))
    const result = buildTotalData(statsOf(solves))
    expect(result[4].execAo5).toBeCloseTo(3000)
  })

  it('execAo12 is null when fewer than 12 solves', () => {
    const solves = Array.from({ length: 11 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(statsOf(solves))
    expect(result.every(p => p.execAo12 === null)).toBe(true)
  })

  it('execAo12 is non-null once 12+ solves available', () => {
    const solves = Array.from({ length: 12 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000 * (i + 1), 0)])
    )
    const result = buildTotalData(statsOf(solves))
    expect(result[11].execAo12).not.toBeNull()
  })

  it('ao5/ao12 are computed independently per type', () => {
    // exec=2000, recog=9999 for all 5 solves
    const solves = Array.from({ length: 5 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 2000, 9999)])
    )
    const result = buildTotalData(statsOf(solves))
    // execAo5 of five 2000s → 2000
    expect(result[4].execAo5).toBeCloseTo(2000)
    // recogAo5 of five 9999s → 9999
    expect(result[4].recogAo5).toBeCloseTo(9999)
    // totalAo5 of five 11999s → 11999
    expect(result[4].totalAo5).toBeCloseTo(11999)
  })

  it('date-sorted input: xIndex reflects position in date order, not seq order', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),  // oldest by date
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),  // newest by date
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
    ]
    const result = buildTotalData(statsOf(solves, 'date'))
    // Should be ordered: seq3(date1000), seq2(date2000), seq1(date3000)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(3)
    expect(result[1].xIndex).toBe(2)
    expect(result[1].solveId).toBe(2)
    expect(result[2].xIndex).toBe(3)
    expect(result[2].solveId).toBe(1)
  })

  it('date-sorted input: Ao5 reflects date-ordered rolling window', () => {
    // 5 solves with known exec times in date order: 1000, 2000, 3000, 4000, 5000
    const solves = [
      makeSolve(5, [makePhase('A', 1000, 0)], { date: 100 }),
      makeSolve(4, [makePhase('A', 2000, 0)], { date: 200 }),
      makeSolve(3, [makePhase('A', 3000, 0)], { date: 300 }),
      makeSolve(2, [makePhase('A', 4000, 0)], { date: 400 }),
      makeSolve(1, [makePhase('A', 5000, 0)], { date: 500 }),
    ]
    const result = buildTotalData(statsOf(solves, 'date'))
    // Date-ordered execs: [1000, 2000, 3000, 4000, 5000]
    // Ao5 at index 4 = trimmed mean([1000,2000,3000,4000,5000]) = mean(2000,3000,4000) = 3000
    expect(result[4].execAo5).toBeCloseTo(3000)
  })
})

// ─── buildPhaseData ──────────────────────────────────────────────────────────

describe('buildPhaseData', () => {
  it('ungrouped: uses phase labels as keys', () => {
    const solves = [
      makeSolve(1, [
        makePhase('Cross', 1000, 0),
        makePhase('F2L Slot 1', 2000, 0, 'F2L'),
      ]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', false)
    expect(result[0]['Cross']).toBe(1000)
    expect(result[0]['F2L Slot 1']).toBe(2000)
    expect('F2L' in result[0]).toBe(false)
  })

  it('grouped: sums phases with the same group into one key', () => {
    const solves = [
      makeSolve(1, [
        makePhase('Cross', 1000, 0),
        makePhase('F2L Slot 1', 2000, 0, 'F2L'),
        makePhase('F2L Slot 2', 1500, 0, 'F2L'),
      ]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', true)
    expect(result[0]['Cross']).toBe(1000)    // no group → use label
    expect(result[0]['F2L']).toBe(3500)       // 2000 + 1500
    expect('F2L Slot 1' in result[0]).toBe(false)
  })

  it('grouped: ungrouped phases still use their label', () => {
    const solves = [
      makeSolve(1, [
        makePhase('Cross', 800, 0),           // no group
        makePhase('EOLL', 1200, 0, 'OLL'),
      ]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', true)
    expect(result[0]['Cross']).toBe(800)
    expect(result[0]['OLL']).toBe(1200)
  })

  it('uses recognitionMs when timeType is recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500)]),
    ]
    const result = buildPhaseData(statsOf(solves), 'recog', false)
    expect(result[0]['Cross']).toBe(500)
  })

  it('uses exec+recog when timeType is total', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 2000, 300)]),
    ]
    const result = buildPhaseData(statsOf(solves), 'total', false)
    expect(result[0]['Cross']).toBe(1500)  // 1000 + 500
    expect(result[0]['F2L']).toBe(2300)    // 2000 + 300
  })

  it('slices to last N non-example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildPhaseData(statsOf(solves, 'seq', 2), 'exec', false)
    expect(result).toHaveLength(2)
    expect(result[0]['A']).toBe(2000)
  })

  it('excludes example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    const result = buildPhaseData(statsOf(solves), 'exec', false)
    expect(result).toHaveLength(1)
    expect(result[0]['A']).toBe(2000)
  })

  it('xIndex comes from input StatsSolvePoint, not position', () => {
    // Directly construct StatsSolvePoint[] with non-sequential xIndex values.
    const points: StatsSolvePoint[] = [
      { id: 1, date: 0, timeMs: 0, phases: [makePhase('A', 1000, 0)], method: 'cfop', driver: 'cube', xIndex: 100 },
      { id: 2, date: 0, timeMs: 0, phases: [makePhase('A', 2000, 0)], method: 'cfop', driver: 'cube', xIndex: 200 },
      { id: 3, date: 0, timeMs: 0, phases: [makePhase('A', 3000, 0)], method: 'cfop', driver: 'cube', xIndex: 350 },
    ]
    const result = buildPhaseData(points, 'exec', false)
    expect(result[0].xIndex).toBe(100)
    expect(result[1].xIndex).toBe(200)
    expect(result[2].xIndex).toBe(350)
  })

  it('includes solveId', () => {
    const solves = [makeSolve(99, [makePhase('A', 1000, 0)])]
    const result = buildPhaseData(statsOf(solves), 'exec', false)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(99)
  })

  it('date-sorted input: xIndex reflects date order position', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 500, 0)],  { date: 1000 }),
      makeSolve(1, [makePhase('A', 1000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 750, 0)],  { date: 2000 }),
    ]
    const result = buildPhaseData(statsOf(solves, 'date'), 'exec', false)
    expect(result[0].xIndex).toBe(1)
    expect(result[0].solveId).toBe(3)  // seq=3 but date=1000 (oldest) → xIndex=1
    expect(result[2].xIndex).toBe(3)
    expect(result[2].solveId).toBe(1)  // seq=1 but date=3000 (newest) → xIndex=3
  })
})

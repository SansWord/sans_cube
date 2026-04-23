import { describe, it, expect } from 'vitest'
import { buildTotalData, buildPhaseData, sortAndSliceWindow } from '../../src/utils/trends'
import type { SolveRecord, PhaseRecord } from '../../src/types/solve'

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

// ─── buildTotalData ──────────────────────────────────────────────────────────

describe('buildTotalData', () => {
  it('returns one entry per solve with exec = sum(executionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
      makeSolve(2, [makePhase('Cross', 1200, 600), makePhase('F2L', 2800, 300)]),
    ]
    const result = buildTotalData(solves, 'all')
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(4000)  // 1000 + 3000
    expect(result[1].exec).toBe(4000)  // 1200 + 2800
  })

  it('returns recog = sum(recognitionMs)', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(solves, 'all')
    expect(result[0].recog).toBe(900)  // 500 + 400
  })

  it('returns total = exec + recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 3000, 400)]),
    ]
    const result = buildTotalData(solves, 'all')
    expect(result[0].total).toBe(4900)  // 4000 + 900
  })

  it('assigns sequential seq numbers starting from 1', () => {
    const solves = [makeSolve(10, [makePhase('A', 1000, 0)]), makeSolve(11, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(solves, 'all')
    expect(result[0].seq).toBe(1)
    expect(result[1].seq).toBe(2)
  })

  it('stores the solve id in solveId', () => {
    const solves = [makeSolve(42, [makePhase('A', 1000, 0)])]
    const result = buildTotalData(solves, 'all')
    expect(result[0].solveId).toBe(42)
  })

  it('slices to last N solves when window is a number', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildTotalData(solves, 2)
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
    const result = buildTotalData(solves, 'all')
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
    const result = buildTotalData(solves, 2)
    expect(result).toHaveLength(2)
    expect(result[0].exec).toBe(3000)
    expect(result[1].exec).toBe(4000)
  })

  it('execAo5 is null when fewer than 5 solves are in the window', () => {
    const solves = Array.from({ length: 4 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(solves, 'all')
    expect(result.every(p => p.execAo5 === null)).toBe(true)
  })

  it('execAo5 is computed (trimmed mean) once 5+ solves available', () => {
    // exec values: 1000, 2000, 3000, 4000, 5000 → trim 1000 and 5000 → mean(2000,3000,4000) = 3000
    const values = [1000, 2000, 3000, 4000, 5000]
    const solves = values.map((v, i) => makeSolve(i + 1, [makePhase('A', v, 0)]))
    const result = buildTotalData(solves, 'all')
    expect(result[4].execAo5).toBeCloseTo(3000)
  })

  it('execAo12 is null when fewer than 12 solves', () => {
    const solves = Array.from({ length: 11 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000, 0)])
    )
    const result = buildTotalData(solves, 'all')
    expect(result.every(p => p.execAo12 === null)).toBe(true)
  })

  it('execAo12 is non-null once 12+ solves available', () => {
    const solves = Array.from({ length: 12 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 1000 * (i + 1), 0)])
    )
    const result = buildTotalData(solves, 'all')
    expect(result[11].execAo12).not.toBeNull()
  })

  it('ao5/ao12 are computed independently per type', () => {
    // exec=2000, recog=9999 for all 5 solves
    const solves = Array.from({ length: 5 }, (_, i) =>
      makeSolve(i + 1, [makePhase('A', 2000, 9999)])
    )
    const result = buildTotalData(solves, 'all')
    // execAo5 of five 2000s → 2000
    expect(result[4].execAo5).toBeCloseTo(2000)
    // recogAo5 of five 9999s → 9999
    expect(result[4].recogAo5).toBeCloseTo(9999)
    // totalAo5 of five 11999s → 11999
    expect(result[4].totalAo5).toBeCloseTo(11999)
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
    const result = buildPhaseData(solves, 'all', 'exec', false)
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
    const result = buildPhaseData(solves, 'all', 'exec', true)
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
    const result = buildPhaseData(solves, 'all', 'exec', true)
    expect(result[0]['Cross']).toBe(800)
    expect(result[0]['OLL']).toBe(1200)
  })

  it('uses recognitionMs when timeType is recog', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500)]),
    ]
    const result = buildPhaseData(solves, 'all', 'recog', false)
    expect(result[0]['Cross']).toBe(500)
  })

  it('uses exec+recog when timeType is total', () => {
    const solves = [
      makeSolve(1, [makePhase('Cross', 1000, 500), makePhase('F2L', 2000, 300)]),
    ]
    const result = buildPhaseData(solves, 'all', 'total', false)
    expect(result[0]['Cross']).toBe(1500)  // 1000 + 500
    expect(result[0]['F2L']).toBe(2300)    // 2000 + 300
  })

  it('slices to last N non-example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = buildPhaseData(solves, 2, 'exec', false)
    expect(result).toHaveLength(2)
    expect(result[0]['A']).toBe(2000)
  })

  it('excludes example solves', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    const result = buildPhaseData(solves, 'all', 'exec', false)
    expect(result).toHaveLength(1)
    expect(result[0]['A']).toBe(2000)
  })

  it('includes seq (1-indexed) and solveId', () => {
    const solves = [makeSolve(99, [makePhase('A', 1000, 0)])]
    const result = buildPhaseData(solves, 'all', 'exec', false)
    expect(result[0].seq).toBe(1)
    expect(result[0].solveId).toBe(99)
  })
})

// ─── sortAndSliceWindow ──────────────────────────────────────────────────────

describe('sortAndSliceWindow', () => {
  it('seq mode: returns solves ordered by solve seq', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 'all', 'seq')
    expect(result.map(s => s.seq)).toEqual([1, 2, 3])
  })

  it('date mode: returns solves ordered by date even when seq disagrees', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 'all', 'date')
    expect(result.map(s => s.date)).toEqual([1000, 2000, 3000])
  })

  it('excludes example solves in both modes', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)], { isExample: true }),
      makeSolve(2, [makePhase('A', 2000, 0)]),
    ]
    expect(sortAndSliceWindow(solves, 'all', 'seq')).toHaveLength(1)
    expect(sortAndSliceWindow(solves, 'all', 'date')).toHaveLength(1)
  })

  it('seq mode: window slices the last N after sorting by seq', () => {
    const solves = [
      makeSolve(1, [makePhase('A', 1000, 0)]),
      makeSolve(2, [makePhase('A', 2000, 0)]),
      makeSolve(3, [makePhase('A', 3000, 0)]),
    ]
    const result = sortAndSliceWindow(solves, 2, 'seq')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.seq)).toEqual([2, 3])
  })

  it('date mode: window slices the last N after sorting by date', () => {
    const solves = [
      makeSolve(3, [makePhase('A', 1000, 0)], { date: 1000 }),
      makeSolve(1, [makePhase('A', 2000, 0)], { date: 3000 }),
      makeSolve(2, [makePhase('A', 3000, 0)], { date: 2000 }),
    ]
    const result = sortAndSliceWindow(solves, 2, 'date')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.date)).toEqual([2000, 3000])
  })
})

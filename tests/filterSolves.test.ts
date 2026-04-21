import { describe, it, expect } from 'vitest'
import { filterSolves } from '../src/utils/solveStats'
import type { SolveRecord, SolveFilter } from '../src/types/solve'

function makeSolve(overrides: Partial<SolveRecord>): SolveRecord {
  return {
    id: 1, seq: 1, scramble: '', timeMs: 10000, moves: [], phases: [], date: 0,
    ...overrides,
  }
}

const cfopCube  = makeSolve({ id: 1, method: 'cfop', driver: 'cube' })
const cfopMouse = makeSolve({ id: 2, method: 'cfop', driver: 'mouse' })
const rouxCube  = makeSolve({ id: 3, method: 'roux', driver: 'cube' })
const example   = makeSolve({ id: 4, method: 'cfop', driver: 'mouse', isExample: true })
const legacy    = makeSolve({ id: 5 }) // no method, no driver
const freeform  = makeSolve({ id: 6, method: 'freeform', driver: 'cube' })

const ALL: SolveRecord[] = [cfopCube, cfopMouse, rouxCube, example, legacy, freeform]

describe('filterSolves', () => {
  it('all+all returns every solve', () => {
    const f: SolveFilter = { method: 'all', driver: 'all' }
    expect(filterSolves(ALL, f)).toEqual(ALL)
  })

  it('cfop+all returns cfop solves and examples', () => {
    const f: SolveFilter = { method: 'cfop', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 2, 4, 5]) // legacy defaults to cfop
  })

  it('roux+all returns roux solves and examples', () => {
    const f: SolveFilter = { method: 'roux', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([3, 4])
  })

  it('all+cube returns cube solves and examples', () => {
    const f: SolveFilter = { method: 'all', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 3, 4, 5, 6]) // legacy defaults to cube, example bypasses, freeform is cube
  })

  it('all+mouse returns mouse solves and examples', () => {
    const f: SolveFilter = { method: 'all', driver: 'mouse' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([2, 4])
  })

  it('cfop+cube returns cfop+cube solves and examples', () => {
    const f: SolveFilter = { method: 'cfop', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([1, 4, 5]) // legacy: cfop+cube, example bypasses
  })

  it('roux+mouse returns no solves (only example)', () => {
    const f: SolveFilter = { method: 'roux', driver: 'mouse' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([4]) // only example bypasses both
  })

  it('example solves always pass through regardless of both filters', () => {
    const f: SolveFilter = { method: 'roux', driver: 'mouse' }
    const result = filterSolves([example], f)
    expect(result).toEqual([example])
  })

  it('legacy solve (no driver) defaults to cube', () => {
    const f: SolveFilter = { method: 'all', driver: 'cube' }
    expect(filterSolves([legacy], f)).toEqual([legacy])
  })

  it('legacy solve (no driver) excluded by mouse filter', () => {
    const f: SolveFilter = { method: 'all', driver: 'mouse' }
    expect(filterSolves([legacy], f)).toEqual([])
  })

  it('freeform+all returns freeform solves and examples', () => {
    const f: SolveFilter = { method: 'freeform', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([4, 6]) // example bypasses
  })

  it('freeform+cube returns freeform+cube solves and examples', () => {
    const f: SolveFilter = { method: 'freeform', driver: 'cube' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).toEqual([4, 6])
  })

  it('cfop+all excludes freeform solves', () => {
    const f: SolveFilter = { method: 'cfop', driver: 'all' }
    const result = filterSolves(ALL, f)
    expect(result.map(s => s.id)).not.toContain(6)
  })
})

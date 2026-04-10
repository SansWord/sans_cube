import { describe, it, expect } from 'vitest'
import { buildCopySolveList } from '../../src/utils/copySolveList'
import type { SolveRecord } from '../../src/types/solve'

function makeSolve(overrides: Partial<SolveRecord> & { id: number; timeMs: number }): SolveRecord {
  return {
    seq: overrides.id,
    scramble: '',
    date: 0,
    phases: [],
    moves: Array(10).fill({ face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 }),
    ...overrides,
  }
}

describe('buildCopySolveList', () => {
  it('produces a tab-separated header row', () => {
    const lines = buildCopySolveList([]).split('\n')
    expect(lines[0]).toBe('#\tTime\tTPS\tMethod')
  })

  it('formats a real solve row correctly', () => {
    const solve = makeSolve({ id: 3, seq: 3, timeMs: 10_230 })
    const lines = buildCopySolveList([solve]).split('\n')
    expect(lines[1]).toBe('3\t10.23\t0.98\tCFOP')
  })

  it('uses ★ for example solves', () => {
    const solve = makeSolve({ id: -1, timeMs: 28_672, isExample: true })
    const lines = buildCopySolveList([solve]).split('\n')
    expect(lines[1].startsWith('★')).toBe(true)
  })

  it('uses seq over id for the # column', () => {
    const solve = makeSolve({ id: 999, seq: 5, timeMs: 12_000 })
    const lines = buildCopySolveList([solve]).split('\n')
    expect(lines[1].startsWith('5\t')).toBe(true)
  })

  it('outputs one row per solve plus the header', () => {
    const solves = [makeSolve({ id: 1, timeMs: 10_000 }), makeSolve({ id: 2, timeMs: 11_000 })]
    const lines = buildCopySolveList(solves).split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })

  it('labels method correctly for roux', () => {
    const solve = makeSolve({ id: 1, timeMs: 9_000, method: 'roux' })
    const lines = buildCopySolveList([solve]).split('\n')
    expect(lines[1].endsWith('Roux')).toBe(true)
  })
})

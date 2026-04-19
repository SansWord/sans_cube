import { describe, it, expect, vi } from 'vitest'
import { parseExport, __testing } from '../../../src/utils/acubemyImport/parseExport'
import type { SolveRecord } from '../../../src/types/solve'

// Minimal valid record — used as a starting point for most tests.
const BASE_RECORD = {
  solve_id: 100,
  date: '2026-04-18T10:09:22.202Z',
  scramble: 'R',
  raw_solution: "R'",
  raw_timestamps: [0],
  analysis_type: 'cfop',
}

function existing(externalId: number): SolveRecord {
  return {
    id: 1, seq: 1, schemaVersion: 2,
    scramble: 'x', timeMs: 0, moves: [], phases: [], date: 1,
    importedFrom: { source: 'acubemy', externalId },
  }
}

describe('parseExport — file-level errors', () => {
  it('returns file-level error when JSON is not an array', () => {
    const result = parseExport({}, [])
    expect(result.fileError).toMatch(/Expected a JSON array/)
  })

  it('returns file-level error when array is empty', () => {
    const result = parseExport([], [])
    expect(result.fileError).toMatch(/No solves found/)
  })

  it('returns file-level error when no record has acubemy fields', () => {
    const result = parseExport([{ foo: 1 }, { bar: 2 }], [])
    expect(result.fileError).toMatch(/doesn't look like an acubemy export/)
  })
})

describe('parseExport — per-record classification', () => {
  it('classifies a valid record as new', () => {
    const result = parseExport([BASE_RECORD], [])
    expect(result.summary?.rows[0].status).toBe('new')
    expect(result.summary?.counts.new).toBe(1)
  })

  it('classifies duplicate by externalId', () => {
    const result = parseExport([BASE_RECORD], [existing(100)])
    expect(result.summary?.rows[0].status).toBe('duplicate')
  })

  it('skips expensive parse work for duplicates', () => {
    const spy = vi.spyOn(__testing, 'parseRawSolution')
    parseExport([BASE_RECORD], [existing(100)])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('classifies missing raw_solution as parse-error', () => {
    const r = { ...BASE_RECORD, raw_solution: undefined }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('parse-error')
    expect(result.summary?.rows[0].reason).toMatch(/Missing field: raw_solution/)
  })

  it('classifies unknown analysis_type by mapping to freeform (not error)', () => {
    const r = { ...BASE_RECORD, analysis_type: 'yau' }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('new')
    expect(result.summary?.rows[0].method).toBe('freeform')
  })

  it('maps analysis_type case-insensitively (CFOP → cfop, Roux → roux)', () => {
    const r1 = { ...BASE_RECORD, analysis_type: 'CFOP', solve_id: 101 }
    const r2 = { ...BASE_RECORD, analysis_type: 'Roux', solve_id: 102 }
    const result = parseExport([r1, r2], [])
    expect(result.summary?.rows[0].method).toBe('cfop')
    expect(result.summary?.rows[1].method).toBe('roux')
  })

  it('classifies invalid date as parse-error', () => {
    const r = { ...BASE_RECORD, date: 'not-a-date' }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('parse-error')
    expect(result.summary?.rows[0].reason).toMatch(/date/i)
  })

  it('rows are sorted by date ascending', () => {
    const r1 = { ...BASE_RECORD, solve_id: 1, date: '2026-02-02T00:00:00Z' }
    const r2 = { ...BASE_RECORD, solve_id: 2, date: '2026-01-01T00:00:00Z' }
    const result = parseExport([r1, r2], [])
    expect(result.summary?.rows.map(r => r.index)).toEqual([1, 2])
    expect(result.summary?.rows[0].date).toBeLessThan(result.summary!.rows[1].date!)
  })

  it('classifies non-number/non-string solve_id as parse-error', () => {
    const r = { ...BASE_RECORD, solve_id: { nested: 'object' } }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('parse-error')
    expect(result.summary?.rows[0].reason).toMatch(/Invalid field: solve_id/)
  })

  it('accepts string solve_id as valid', () => {
    const r = { ...BASE_RECORD, solve_id: 'abc-123' }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('new')
  })

  it('classifies raw_timestamps with non-numeric elements as parse-error', () => {
    const r = { ...BASE_RECORD, raw_timestamps: ['0', 100] }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('parse-error')
    expect(result.summary?.rows[0].reason).toMatch(/Invalid field: raw_timestamps/)
  })
})

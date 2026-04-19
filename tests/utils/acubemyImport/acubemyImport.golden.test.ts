// tests/utils/acubemyImport/acubemyImport.golden.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseExport } from '../../../src/utils/acubemyImport/parseExport'

describe('acubemy import — golden', () => {
  const json = JSON.parse(
    readFileSync(join(__dirname, '../../fixtures/acubemy_example.json'), 'utf-8')
  )

  it('imports the 2 records in example.json as new', () => {
    const result = parseExport(json, [])
    expect(result.fileError).toBeUndefined()
    expect(result.summary?.counts).toEqual(
      expect.objectContaining({ new: 2, duplicate: 0, parseError: 0, unsolved: 0 })
    )
  })

  it('CFOP record yields expected shape', () => {
    const result = parseExport(json, [])
    const cfop = result.summary!.rows.find(r => r.method === 'cfop')!
    expect(cfop.status).toBe('new')
    expect(cfop.draft?.schemaVersion).toBe(2)
    expect(cfop.draft?.method).toBe('cfop')
    expect(cfop.draft?.timeMs).toBe(28833)
    expect(cfop.draft?.moves.length).toBeGreaterThan(0)
    expect(cfop.draft?.phases.length).toBeGreaterThan(0)
    expect(cfop.draft?.importedFrom).toEqual({ source: 'acubemy', externalId: 388217 })
  })

  it('Roux record contains at least one slice move (M/E/S) — proves pairing worked', () => {
    const result = parseExport(json, [])
    const roux = result.summary!.rows.find(r => r.method === 'roux')!
    expect(roux.status).toBe('new')
    expect(roux.draft?.importedFrom?.externalId).toBe(376615)
    const sliceFaces = new Set(['M', 'E', 'S'])
    const hasSlice = roux.draft!.moves.some(m => sliceFaces.has(m.face as string))
    expect(hasSlice).toBe(true)
  })
})

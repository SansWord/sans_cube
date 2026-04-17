import { describe, it, expect } from 'vitest'
import { parseHash } from '../../src/hooks/useHashRouter'

describe('parseHash', () => {
  it('parses #debug', () => {
    expect(parseHash('#debug')).toEqual({ type: 'debug' })
  })

  it('parses #solve-{id}', () => {
    expect(parseHash('#solve-42')).toEqual({ type: 'solve', id: 42 })
  })

  it('returns none for non-numeric #solve', () => {
    expect(parseHash('#solve-abc')).toEqual({ type: 'none' })
  })

  it('returns none for empty #solve', () => {
    expect(parseHash('#solve-')).toEqual({ type: 'none' })
  })

  it('parses #shared-{shareId}', () => {
    expect(parseHash('#shared-abc123xyz')).toEqual({ type: 'shared', shareId: 'abc123xyz' })
  })

  it('returns none for empty #shared', () => {
    expect(parseHash('#shared-')).toEqual({ type: 'none' })
  })

  it('parses #trends with no params', () => {
    const route = parseHash('#trends')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.tab).toBe('total')
    expect(route.params.windowSize).toBeNull()
    expect(route.params.grouped).toBe(true)
    expect(route.params.method).toBeNull()
    expect(route.params.driver).toBeNull()
  })

  it('parses #trends with all params', () => {
    const route = parseHash('#trends?tab=phases&window=50&group=split&ttotal=exec,recog&tphase=total&method=cfop&driver=cube')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.tab).toBe('phases')
    expect(route.params.windowSize).toBe(50)
    expect(route.params.grouped).toBe(false)
    expect(route.params.totalToggle).toEqual({ exec: true, recog: true, total: false })
    expect(route.params.phaseToggle).toEqual({ exec: false, recog: false, total: true })
    expect(route.params.method).toBe('cfop')
    expect(route.params.driver).toBe('cube')
  })

  it('falls back totalToggle to total:true when all false', () => {
    const route = parseHash('#trends?ttotal=')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.totalToggle.total).toBe(true)
  })

  it('parses #trends with method=freeform', () => {
    const route = parseHash('#trends?method=freeform')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.method).toBe('freeform')
  })

  it('returns none for invalid method', () => {
    const route = parseHash('#trends?method=invalid')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.method).toBeNull()
  })

  it('returns none for empty hash', () => {
    expect(parseHash('')).toEqual({ type: 'none' })
  })

  it('returns none for unknown hash', () => {
    expect(parseHash('#unknown')).toEqual({ type: 'none' })
  })
})

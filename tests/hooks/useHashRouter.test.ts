import { describe, it, expect } from 'vitest'
import { parseHash, decideSelectedSolveUrlAction, decideSharedSolveUrlAction } from '../../src/hooks/useHashRouter'

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

describe('decideSelectedSolveUrlAction', () => {
  // Regression: booting with `#solve-{id}` and cloud sync disabled previously
  // wiped the hash and bounced the modal in an infinite loop.
  it('returns noop when no previous and no current solve (initial mount)', () => {
    expect(decideSelectedSolveUrlAction(null, null, '', false)).toEqual({ kind: 'noop' })
  })

  it('opens with pushState when a solve is newly selected (no prev)', () => {
    expect(decideSelectedSolveUrlAction(null, -3, '', false)).toEqual({
      kind: 'open-push', id: -3, saveTrendsHash: false,
    })
  })

  it('saves trends hash when opening a solve on top of an open trends modal', () => {
    expect(decideSelectedSolveUrlAction(null, -3, '', true)).toEqual({
      kind: 'open-push', id: -3, saveTrendsHash: true,
    })
  })

  it('opens with replaceState when switching between solves', () => {
    expect(decideSelectedSolveUrlAction(7, -3, '', false)).toEqual({
      kind: 'open-replace', id: -3,
    })
  })

  it('restores the saved trends hash when closing a solve that was opened over trends', () => {
    expect(decideSelectedSolveUrlAction(7, null, '#trends?tab=phases', false)).toEqual({
      kind: 'restore-trends', hash: '#trends?tab=phases',
    })
  })

  it('clears the URL when closing a solve with no saved trends hash', () => {
    expect(decideSelectedSolveUrlAction(7, null, '', false)).toEqual({ kind: 'clear' })
  })
})

describe('decideSharedSolveUrlAction', () => {
  it('returns noop when no previous and no current shared solve', () => {
    expect(decideSharedSolveUrlAction(null, null, '', false)).toEqual({ kind: 'noop' })
  })

  // Regression: arriving via `#shared-abc` then loading the solve used to pushState
  // the same URL, creating a duplicate history entry that required an extra back press.
  it('uses replace when opening a shared solve and the URL already matches', () => {
    expect(decideSharedSolveUrlAction(null, 'abc', '#shared-abc', false)).toEqual({
      kind: 'open-replace', shareId: 'abc',
    })
  })

  it('uses push when opening a shared solve and the URL does not match', () => {
    expect(decideSharedSolveUrlAction(null, 'abc', '', false)).toEqual({
      kind: 'open-push', shareId: 'abc',
    })
  })

  it('returns noop when the same shared solve stays loaded', () => {
    expect(decideSharedSolveUrlAction('abc', 'abc', '#shared-abc', false)).toEqual({ kind: 'noop' })
  })

  it('returns clear when a previously loaded shared solve is closed', () => {
    expect(decideSharedSolveUrlAction('abc', null, '', false)).toEqual({ kind: 'clear' })
  })

  it('returns noop when sharedSolve is null but still loading (no prior solve)', () => {
    expect(decideSharedSolveUrlAction(null, null, '#shared-abc', true)).toEqual({ kind: 'noop' })
  })
})

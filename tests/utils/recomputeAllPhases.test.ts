import { describe, it, expect } from 'vitest'
import { recomputeAllPhases } from '../../src/utils/recomputeAllPhases'
import type { SolveRecord } from '../../src/types/solve'

describe('recomputeAllPhases', () => {
  it('returns empty buckets for empty input', () => {
    const result = recomputeAllPhases([])
    expect(result.unchanged).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual([])
  })

  it('skips isExample solves', () => {
    const example: SolveRecord = {
      id: 1, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, isExample: true,
    }
    const result = recomputeAllPhases([example])
    expect(result.skipped).toEqual([example])
    expect(result.unchanged).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('skips freeform solves', () => {
    const freeform: SolveRecord = {
      id: 2, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'freeform',
    }
    const result = recomputeAllPhases([freeform])
    expect(result.skipped).toEqual([freeform])
  })
})

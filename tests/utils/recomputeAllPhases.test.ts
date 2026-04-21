import { describe, it, expect } from 'vitest'
import { recomputeAllPhases } from '../../src/utils/recomputeAllPhases'

describe('recomputeAllPhases', () => {
  it('returns empty buckets for empty input', () => {
    const result = recomputeAllPhases([])
    expect(result.unchanged).toEqual([])
    expect(result.changed).toEqual([])
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual([])
  })
})

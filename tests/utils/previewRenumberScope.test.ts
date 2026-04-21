import { describe, it, expect } from 'vitest'
import { previewRenumberScope } from '../../src/utils/previewRenumberScope'
import type { SolveRecord } from '../../src/types/solve'

function makeSolve(id: number, seq: number, date: number): SolveRecord {
  return { id, seq, date, scramble: '', timeMs: 0, moves: [], phases: [] }
}

describe('previewRenumberScope', () => {
  it('empty solves → totalCount 0, no mismatch, renumberedCount 0', () => {
    const result = previewRenumberScope([])
    expect(result).toEqual({
      totalCount: 0,
      firstMismatchIndex: -1,
      firstMismatchSolve: null,
      renumberedCount: 0,
    })
  })

  it('all seq already 1..n → no mismatch, renumberedCount 0', () => {
    const solves = [makeSolve(1, 1, 1000), makeSolve(2, 2, 2000), makeSolve(3, 3, 3000)]
    const result = previewRenumberScope(solves)
    expect(result).toEqual({
      totalCount: 3,
      firstMismatchIndex: -1,
      firstMismatchSolve: null,
      renumberedCount: 0,
    })
  })

  it('all seq wrong from index 0 → firstMismatchIndex 0, renumberedCount = full length', () => {
    const solves = [makeSolve(1, 5, 1000), makeSolve(2, 6, 2000), makeSolve(3, 7, 3000)]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(0)
    expect(result.firstMismatchSolve).toEqual(solves[0])
    expect(result.renumberedCount).toBe(3)
    expect(result.totalCount).toBe(3)
  })

  it('tail-mismatch: first two correct, rest wrong → firstMismatchIndex 2', () => {
    const solves = [
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
      makeSolve(3, 9, 3000),
      makeSolve(4, 10, 4000),
    ]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(2)
    expect(result.firstMismatchSolve).toEqual(solves[2])
    expect(result.renumberedCount).toBe(2)
  })

  it('mixed-skip: tail row coincidentally matches target → skipped in renumberedCount', () => {
    // stored: [1, 2, 4, 4, 5] — target: [1, 2, 3, 4, 5]
    // firstMismatch at index 2 (seq=4, target=3)
    // index 3: seq=4, target=4 → already correct → skipped
    // index 4: seq=5, target=5 → already correct → skipped
    const solves = [
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
      makeSolve(3, 4, 3000),
      makeSolve(4, 4, 4000),
      makeSolve(5, 5, 5000),
    ]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(2)
    expect(result.renumberedCount).toBe(1)
  })

  it('unsorted input → sorts by date before scanning, same result as sorted', () => {
    // Same solves in wrong order: dates 3000, 1000, 2000 → should sort to 1000, 2000, 3000
    const unsorted = [
      makeSolve(3, 3, 3000),
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
    ]
    const sorted = [
      makeSolve(1, 1, 1000),
      makeSolve(2, 2, 2000),
      makeSolve(3, 3, 3000),
    ]
    expect(previewRenumberScope(unsorted)).toEqual(previewRenumberScope(sorted))
  })

  it('unsorted input with mismatch → correct firstMismatchSolve after sort', () => {
    // After sorting by date: [seq=1 date=1000, seq=5 date=2000, seq=3 date=3000]
    // First mismatch at index 1 (seq=5, target=2)
    const solves = [
      makeSolve(3, 3, 3000),
      makeSolve(1, 1, 1000),
      makeSolve(2, 5, 2000),
    ]
    const result = previewRenumberScope(solves)
    expect(result.firstMismatchIndex).toBe(1)
    expect(result.firstMismatchSolve?.id).toBe(2) // the solve with date=2000
  })
})

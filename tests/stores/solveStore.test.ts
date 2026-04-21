import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/services/firestoreSolves', () => ({
  loadSolvesFromFirestore: vi.fn(),
  addSolveToFirestore: vi.fn(),
  updateSolveInFirestore: vi.fn(),
  deleteSolveFromFirestore: vi.fn(),
  loadNextSeqFromFirestore: vi.fn(),
  updateCounterInFirestore: vi.fn(),
  migrateLocalSolvesToFirestore: vi.fn(),
  bulkUpdateSolvesInFirestore: vi.fn(),
  renumberSolvesInFirestore: vi.fn(),
  recalibrateSolvesInFirestore: vi.fn(),
  migrateSolvesToV2InFirestore: vi.fn(),
}))

import { solveStore, __resetForTests } from '../../src/stores/solveStore'

describe('solveStore — initial snapshot', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
  })

  it('getSnapshot returns a default StoreState before configure() is called', () => {
    const s = solveStore.getSnapshot()
    expect(s.solves).toEqual([])
    expect(s.dismissedExamples).toBeInstanceOf(Set)
    expect(s.dismissedExamples.size).toBe(0)
    expect(s.status).toBe('idle')
    expect(s.error).toBeNull()
    expect(s.cloudReady).toBe(false)
  })

  it('subscribe returns an unsubscribe function', () => {
    const listener = vi.fn()
    const unsub = solveStore.subscribe(listener)
    expect(typeof unsub).toBe('function')
    unsub()
  })
})

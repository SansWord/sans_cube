import { describe, it, expect, beforeEach, vi } from 'vitest'
import { STORAGE_KEYS } from '../../src/utils/storageKeys'
import type { SolveRecord } from '../../src/types/solve'

function localSolve(id: number): SolveRecord {
  return { id, seq: id, scramble: '', timeMs: 1000 * id, moves: [], phases: [], date: id, schemaVersion: 2 }
}

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

import { solveStore, __resetForTests, _internal } from '../../src/stores/solveStore'

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

  it('subscribe returns an unsubscribe function that removes the listener', () => {
    const listener = vi.fn()
    const unsub = solveStore.subscribe(listener)
    expect(typeof unsub).toBe('function')
    unsub()
    _internal.setState({ error: 'test' })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('solveStore — configure (local)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
  })

  it('loads solves from localStorage synchronously when cloud is off', () => {
    const solves = [localSolve(1), localSolve(2)]
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify(solves))
    solveStore.configure({ enabled: false, user: null })
    const s = solveStore.getSnapshot()
    expect(s.solves).toHaveLength(2)
    expect(s.status).toBe('idle')
    expect(s.cloudReady).toBe(false)
  })

  it('loads dismissedExamples from localStorage', () => {
    localStorage.setItem(STORAGE_KEYS.DISMISSED_EXAMPLES, JSON.stringify([-1, -2]))
    solveStore.configure({ enabled: false, user: null })
    const s = solveStore.getSnapshot()
    expect([...s.dismissedExamples].sort((a, b) => a - b)).toEqual([-2, -1])
  })

  it('second call with the same tuple is a no-op (solves reference is stable)', () => {
    solveStore.configure({ enabled: false, user: null })
    const before = solveStore.getSnapshot()
    solveStore.configure({ enabled: false, user: null })
    const after = solveStore.getSnapshot()
    expect(after.solves).toBe(before.solves)
  })
})

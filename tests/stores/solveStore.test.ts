import { describe, it, expect, beforeEach, vi } from 'vitest'
import { STORAGE_KEYS } from '../../src/utils/storageKeys'
import type { SolveRecord } from '../../src/types/solve'
import * as firestoreMock from '../../src/services/firestoreSolves'
import type { User } from 'firebase/auth'

const U1 = { uid: 'u1', email: 'u1@x.co' } as unknown as User
const U2 = { uid: 'u2', email: 'u2@x.co' } as unknown as User

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

describe('solveStore — configure (cloud)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([])
    vi.mocked(firestoreMock.loadNextSeqFromFirestore).mockResolvedValue(1)
    vi.mocked(firestoreMock.migrateLocalSolvesToFirestore).mockResolvedValue(undefined)
  })

  it('cloud-enabled first call enters loading, then idle + cloudReady after fetch', async () => {
    const remote = [localSolve(10), localSolve(11)]
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue(remote)
    solveStore.configure({ enabled: true, user: U1 })
    expect(solveStore.getSnapshot().status).toBe('loading')
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    const s = solveStore.getSnapshot()
    expect(s.cloudReady).toBe(true)
    expect(s.solves.map(x => x.id).sort()).toEqual([10, 11])
  })

  it('runs one-time localStorage→Firestore migration when local solves exist', async () => {
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify([localSolve(1)]))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    expect(firestoreMock.migrateLocalSolvesToFirestore).toHaveBeenCalledTimes(1)
  })

  it('does not re-run migration for the same uid on repeat configure()', async () => {
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify([localSolve(1)]))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('idle'))
    expect(firestoreMock.migrateLocalSolvesToFirestore).toHaveBeenCalledTimes(1)
  })

  it('uid change re-fetches', async () => {
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockClear()
    solveStore.configure({ enabled: true, user: U2 })
    expect(solveStore.getSnapshot().cloudReady).toBe(false)
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    expect(firestoreMock.loadSolvesFromFirestore).toHaveBeenCalledWith('u2')
  })

  it('cloud fetch failure sets status=error and records error message', async () => {
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockRejectedValue(new Error('network'))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().status).toBe('error'))
    expect(solveStore.getSnapshot().error).toMatch(/network/)
  })

  it('cloud-on → cloud-off reverts to localStorage view with status=idle', async () => {
    localStorage.setItem(STORAGE_KEYS.SOLVES, JSON.stringify([localSolve(5)]))
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
    solveStore.configure({ enabled: false, user: null })
    const s = solveStore.getSnapshot()
    expect(s.status).toBe('idle')
    expect(s.cloudReady).toBe(false)
    expect(s.solves.map(x => x.id)).toEqual([5])
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

describe('solveStore — CRUD (local mode)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    solveStore.configure({ enabled: false, user: null })
  })

  it('addSolve appends and persists to localStorage', async () => {
    await solveStore.addSolve(localSolve(1))
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([1])
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.SOLVES) ?? '[]') as SolveRecord[]
    expect(raw.map(s => s.id)).toEqual([1])
  })

  it('updateSolve replaces by id', async () => {
    await solveStore.addSolve({ ...localSolve(1), method: 'cfop' })
    await solveStore.updateSolve({ ...localSolve(1), method: 'roux' })
    expect(solveStore.getSnapshot().solves[0].method).toBe('roux')
  })

  it('deleteSolve removes by id', async () => {
    await solveStore.addSolve(localSolve(1))
    await solveStore.addSolve(localSolve(2))
    await solveStore.deleteSolve(1)
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([2])
  })

  it('deleteSolve(-1) routes to dismissExample', async () => {
    await solveStore.deleteSolve(-1)
    expect(solveStore.getSnapshot().dismissedExamples.has(-1)).toBe(true)
  })

  it('addSolve({ isExample: true }) is a no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await solveStore.addSolve({ ...localSolve(99), isExample: true })
    expect(solveStore.getSnapshot().solves).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('nextSolveIds increments seq and persists', () => {
    const a = solveStore.nextSolveIds()
    const b = solveStore.nextSolveIds()
    expect(b.seq).toBe(a.seq + 1)
    expect(localStorage.getItem(STORAGE_KEYS.NEXT_ID)).toBe(String(b.seq + 1))
  })
})

describe('solveStore — CRUD (cloud mode, optimistic + rollback)', () => {
  beforeEach(async () => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    vi.mocked(firestoreMock.loadSolvesFromFirestore).mockResolvedValue([])
    vi.mocked(firestoreMock.loadNextSeqFromFirestore).mockResolvedValue(1)
    solveStore.configure({ enabled: true, user: U1 })
    await vi.waitFor(() => expect(solveStore.getSnapshot().cloudReady).toBe(true))
  })

  it('addSolve success — record stays in state, Firestore add called', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await solveStore.addSolve(localSolve(1))
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([1])
    expect(firestoreMock.addSolveToFirestore).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 1 }))
  })

  it('addSolve failure — state rolled back, error set, original thrown', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockRejectedValue(new Error('boom'))
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await expect(solveStore.addSolve(localSolve(1))).rejects.toThrow('boom')
    const s = solveStore.getSnapshot()
    expect(s.solves).toEqual([])
    expect(s.error).toMatch(/boom/)
  })

  it('updateSolve failure rolls back', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await solveStore.addSolve({ ...localSolve(1), method: 'cfop' })
    vi.mocked(firestoreMock.updateSolveInFirestore).mockRejectedValue(new Error('write failed'))
    await expect(solveStore.updateSolve({ ...localSolve(1), method: 'roux' })).rejects.toThrow('write failed')
    expect(solveStore.getSnapshot().solves[0].method).toBe('cfop')
  })

  it('deleteSolve failure rolls back', async () => {
    vi.mocked(firestoreMock.addSolveToFirestore).mockResolvedValue(undefined)
    vi.mocked(firestoreMock.updateCounterInFirestore).mockResolvedValue(undefined)
    await solveStore.addSolve(localSolve(1))
    vi.mocked(firestoreMock.deleteSolveFromFirestore).mockRejectedValue(new Error('nope'))
    await expect(solveStore.deleteSolve(1)).rejects.toThrow('nope')
    expect(solveStore.getSnapshot().solves.map(s => s.id)).toEqual([1])
  })
})

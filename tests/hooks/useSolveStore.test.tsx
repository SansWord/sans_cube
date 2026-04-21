import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

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

import { useSolveStore } from '../../src/hooks/useSolveStore'
import { solveStore, __resetForTests } from '../../src/stores/solveStore'
import type { SolveRecord } from '../../src/types/solve'

function Viewer() {
  const { solves, cloudLoading } = useSolveStore()
  return (
    <div>
      <div data-testid="count">{solves.length}</div>
      <div data-testid="loading">{String(cloudLoading)}</div>
    </div>
  )
}

function makeSolve(id: number): SolveRecord {
  return { id, seq: id, scramble: '', timeMs: 1000, moves: [], phases: [], date: id, schemaVersion: 2 }
}

describe('useSolveStore', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
    vi.clearAllMocks()
    solveStore.configure({ enabled: false, user: null })
  })

  it('mounts and reflects current state including examples', () => {
    render(<Viewer />)
    // At minimum, examples are present.
    expect(parseInt(screen.getByTestId('count').textContent!, 10)).toBeGreaterThan(0)
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('re-renders when store state changes', async () => {
    render(<Viewer />)
    const initial = parseInt(screen.getByTestId('count').textContent!, 10)
    await act(async () => { await solveStore.addSolve(makeSolve(1)) })
    expect(parseInt(screen.getByTestId('count').textContent!, 10)).toBe(initial + 1)
  })
})

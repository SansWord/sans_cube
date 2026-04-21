import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecomputePhasesPanel } from '../../src/components/RecomputePhasesPanel'
import type { SolveRecord } from '../../src/types/solve'
import { ROUX_SOLVE_1 } from '../fixtures/solveFixtures'
import { recomputePhases } from '../../src/utils/recomputePhases'
import { ROUX } from '../../src/methods/roux'

describe('RecomputePhasesPanel — initial state', () => {
  it('renders target label, backup warning, and Scan button', () => {
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => []}
        commitChanges={vi.fn()}
      />
    )
    expect(screen.getByText(/Recompute phases/i)).toBeTruthy()
    expect(screen.getByText(/localStorage/)).toBeTruthy()
    expect(screen.getByText(/back up/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Scan/i })).toBeTruthy()
  })
})

describe('RecomputePhasesPanel — results', () => {
  it('shows counts for each bucket after Scan', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const unchangedSolve: SolveRecord = { ...roux, id: 100, phases: fresh }
    const changedSolve: SolveRecord = { ...roux, id: 101, phases: fresh.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p) }
    const failedSolve: SolveRecord = { id: 102, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }
    const exampleSolve: SolveRecord = { id: 103, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, isExample: true }

    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [unchangedSolve, changedSolve, failedSolve, exampleSolve]}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 1/)).toBeTruthy())
    expect(screen.getByText(/Unchanged: 1/)).toBeTruthy()
    expect(screen.getByText(/Failed: 1/)).toBeTruthy()
    expect(screen.getByText(/Skipped: 1/)).toBeTruthy()
  })

  it('lists up to 5 sample changed rows with solve id and method', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const changedSolves: SolveRecord[] = Array.from({ length: 7 }, (_, i) => ({
      ...roux, id: 200 + i,
      phases: fresh.map((p, j) => j === 0 ? { ...p, turns: p.turns + 1 } : p),
    }))
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => changedSolves}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 7/)).toBeTruthy())
    expect(screen.getByText(/#200/)).toBeTruthy()
    expect(screen.getByText(/#204/)).toBeTruthy()
    expect(screen.queryByText(/#205/)).toBeNull()
  })

  it('lists failed solve ids so the user can investigate', async () => {
    const failedSolve: SolveRecord = { id: 300, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [failedSolve]}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Failed: 1/)).toBeTruthy())
    expect(screen.getByText(/#300/)).toBeTruthy()
  })
})

describe('RecomputePhasesPanel — commit', () => {
  it('Commit button is hidden when no changes', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const unchangedSolve: SolveRecord = { ...roux, id: 400, phases: fresh }
    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [unchangedSolve]}
        commitChanges={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Unchanged: 1/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Commit/i })).toBeNull()
  })

  it('Commit button passes only changed solves to commitChanges and shows progress', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const changedSolve: SolveRecord = {
      ...roux, id: 500,
      phases: fresh.map((p, i) => i === 0 ? { ...p, turns: p.turns + 1 } : p),
    }
    const failedSolve: SolveRecord = { id: 501, scramble: 'U', timeMs: 0, moves: [], phases: [], date: 0, method: 'cfop' }

    const commitChanges = vi.fn(async (_changes, onProgress) => { onProgress(1, 1) })

    render(
      <RecomputePhasesPanel
        targetLabel="localStorage"
        loadSolves={async () => [changedSolve, failedSolve]}
        commitChanges={commitChanges}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 1/)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Commit 1 change/i }))
    await waitFor(() => expect(screen.getByText(/Committed 1 solve/i)).toBeTruthy())

    expect(commitChanges).toHaveBeenCalledTimes(1)
    const firstArg = commitChanges.mock.calls[0][0]
    expect(firstArg).toHaveLength(1)
    expect(firstArg[0].solve.id).toBe(500)
  })

  it('shows "batch X of Y" during commit', async () => {
    const roux = { ...ROUX_SOLVE_1, method: 'roux' as const, isExample: false }
    const fresh = recomputePhases(roux, ROUX)!
    const changedSolves: SolveRecord[] = Array.from({ length: 2 }, (_, i) => ({
      ...roux, id: 600 + i,
      phases: fresh.map((p, j) => j === 0 ? { ...p, turns: p.turns + 1 } : p),
    }))
    let resolveFirstBatch!: () => void
    const commitChanges = vi.fn(async (_changes, onProgress) => {
      onProgress(1, 2)
      await new Promise<void>((resolve) => { resolveFirstBatch = resolve })
      onProgress(2, 2)
    })

    render(
      <RecomputePhasesPanel
        targetLabel="Firestore"
        loadSolves={async () => changedSolves}
        commitChanges={commitChanges}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))
    await waitFor(() => expect(screen.getByText(/Changed: 2/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Commit 2 changes/i }))
    await waitFor(() => expect(screen.getByText(/batch 1 of 2/i)).toBeTruthy())
    resolveFirstBatch()
    await waitFor(() => expect(screen.getByText(/Committed 2 solves/i)).toBeTruthy())
  })
})

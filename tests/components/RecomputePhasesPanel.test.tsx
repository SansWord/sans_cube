import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecomputePhasesPanel } from '../../src/components/RecomputePhasesPanel'

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

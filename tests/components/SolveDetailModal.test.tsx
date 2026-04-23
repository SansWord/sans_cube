import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SolveDetailModal } from '../../src/components/SolveDetailModal'
import type { SolveRecord } from '../../src/types/solve'

// Three.js needs WebGL, which jsdom does not provide. Swap CubeCanvas for a stub.
vi.mock('../../src/components/CubeCanvas', () => ({
  CubeCanvas: () => <div data-testid="cube-canvas-stub" />,
}))

function makeSolve(overrides: Partial<SolveRecord> = {}): SolveRecord {
  return {
    id: 1,
    seq: 1,
    scramble: 'R U R\' U\'',
    timeMs: 12340,
    moves: [],
    phases: [],
    date: Date.now(),
    method: 'cfop',
    ...overrides,
  }
}

const baseProps = {
  onClose: vi.fn(),
  onDelete: vi.fn(),
  onUpdate: vi.fn().mockResolvedValue(undefined),
}

describe('SolveDetailModal — import source badge', () => {
  it('renders "Imported from {source}" pill when importedFrom is present', () => {
    const solve = makeSolve({
      importedFrom: { source: 'acubemy', externalId: 42 },
    })
    render(<SolveDetailModal solve={solve} {...baseProps} />)
    expect(screen.getByText(/Imported from acubemy/i)).toBeInTheDocument()
  })

  it('does not render the pill when importedFrom is absent', () => {
    const solve = makeSolve()
    render(<SolveDetailModal solve={solve} {...baseProps} />)
    expect(screen.queryByText(/Imported from/i)).toBeNull()
  })
})

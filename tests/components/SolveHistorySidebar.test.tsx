import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SolveHistorySidebar } from '../../src/components/SolveHistorySidebar'

const baseProps = {
  solves: [],
  stats: {
    single: { current: null, best: null },
    ao5: { current: null, best: null },
    ao12: { current: null, best: null },
    ao100: { current: null, best: null },
  },
  onSelectSolve: vi.fn(),
  width: 160,
  onWidthChange: vi.fn(),
}

describe('SolveHistorySidebar', () => {
  it('does not render a close button in sidebar mode', () => {
    render(<SolveHistorySidebar {...baseProps} />)
    expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument()
  })

  it('renders a close button when onClose is provided', () => {
    render(<SolveHistorySidebar {...baseProps} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<SolveHistorySidebar {...baseProps} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

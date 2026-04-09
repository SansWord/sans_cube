import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SolveHistorySidebar } from '../../src/components/SolveHistorySidebar'
import type { SolveRecord } from '../../src/types/solve'

function makeSolve(id: number, method?: string, isExample?: boolean): SolveRecord {
  return {
    id,
    scramble: '',
    timeMs: 10000 + id * 1000,
    moves: [],
    phases: [],
    date: 0,
    seq: id > 0 ? id : undefined,
    isExample,
    method,
  }
}

const baseProps = {
  solves: [],
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

  it('renders a method filter combobox defaulting to All', () => {
    render(<SolveHistorySidebar {...baseProps} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('all')
  })

  it('filter combobox has All, CFOP, and Roux options', () => {
    render(<SolveHistorySidebar {...baseProps} />)
    const select = screen.getByRole('combobox')
    const options = within(select).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['All', 'CFOP', 'Roux'])
  })

  it('shows all real solves when filter is All', () => {
    const solves = [
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
      makeSolve(3, undefined), // legacy — treated as cfop
    ]
    render(<SolveHistorySidebar {...baseProps} solves={solves} />)
    // All three rows appear: seq numbers 1, 2, 3
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides roux solves when CFOP filter is selected', async () => {
    const solves = [
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
      makeSolve(3, undefined), // legacy cfop
    ]
    render(<SolveHistorySidebar {...baseProps} solves={solves} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'cfop')
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides cfop solves when Roux filter is selected', async () => {
    const solves = [
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
      makeSolve(3, undefined), // legacy cfop
    ]
    render(<SolveHistorySidebar {...baseProps} solves={solves} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'roux')
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('always shows example solves regardless of filter', async () => {
    const solves = [
      makeSolve(-1, 'cfop', true),  // example
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
    ]
    render(<SolveHistorySidebar {...baseProps} solves={solves} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'roux')
    // example row shows ★ not a seq number
    expect(screen.getByText('★')).toBeInTheDocument()
    // cfop real solve is gone
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    // roux real solve is shown
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('also renders the filter in overlay (mobile) mode', () => {
    render(<SolveHistorySidebar {...baseProps} onClose={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})

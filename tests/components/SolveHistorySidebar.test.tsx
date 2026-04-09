import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { SolveHistorySidebar } from '../../src/components/SolveHistorySidebar'
import type { SolveRecord, MethodFilter } from '../../src/types/solve'

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

function SidebarWrapper(props: Omit<React.ComponentProps<typeof SolveHistorySidebar>, 'methodFilter' | 'setMethodFilter'>) {
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
  return <SolveHistorySidebar {...props} methodFilter={methodFilter} setMethodFilter={setMethodFilter} />
}

const baseProps = {
  solves: [],
  onSelectSolve: vi.fn(),
  width: 160,
  onWidthChange: vi.fn(),
}

describe('SolveHistorySidebar', () => {
  it('does not render a close button in sidebar mode', () => {
    render(<SidebarWrapper {...baseProps} />)
    expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument()
  })

  it('renders a close button when onClose is provided', () => {
    render(<SidebarWrapper {...baseProps} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<SidebarWrapper {...baseProps} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders a method filter combobox defaulting to All', () => {
    render(<SidebarWrapper {...baseProps} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('all')
  })

  it('filter combobox has All, CFOP, and Roux options', () => {
    render(<SidebarWrapper {...baseProps} />)
    const select = screen.getByRole('combobox')
    const options = within(select).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['All', 'CFOP', 'Roux'])
  })

  it('shows all real solves when filter is All', () => {
    const solves = [
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
      makeSolve(3, undefined),
    ]
    render(<SidebarWrapper {...baseProps} solves={solves} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides roux solves when CFOP filter is selected', async () => {
    const solves = [
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
      makeSolve(3, undefined),
    ]
    render(<SidebarWrapper {...baseProps} solves={solves} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'cfop')
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides cfop solves when Roux filter is selected', async () => {
    const solves = [
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
      makeSolve(3, undefined),
    ]
    render(<SidebarWrapper {...baseProps} solves={solves} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'roux')
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('always shows example solves regardless of filter', async () => {
    const solves = [
      makeSolve(-1, 'cfop', true),
      makeSolve(1, 'cfop'),
      makeSolve(2, 'roux'),
    ]
    render(<SidebarWrapper {...baseProps} solves={solves} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'roux')
    expect(screen.getByText('★')).toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('also renders the filter in overlay (mobile) mode', () => {
    render(<SidebarWrapper {...baseProps} onClose={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})

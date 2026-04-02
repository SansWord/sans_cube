import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PhaseBar } from '../../src/components/PhaseBar'
import { CFOP } from '../../src/methods/cfop'
import type { PhaseRecord } from '../../src/types/solve'

const phases: PhaseRecord[] = [
  { label: 'Cross', recognitionMs: 0, executionMs: 2000, turns: 5 },
  { label: 'F2L Slot 1', group: 'F2L', recognitionMs: 500, executionMs: 1500, turns: 8 },
]

function mockRect(el: HTMLElement) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0, width: 400, top: 0, right: 400, bottom: 24, height: 24, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

describe('PhaseBar hover indicator', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows indicator on mousemove and hides on mouseleave', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()

    fireEvent.mouseMove(bar, { clientX: 200 })
    const indicator = screen.getByTestId('hover-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator.style.left).toBe('50%')

    fireEvent.mouseLeave(bar)
    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()
  })

  it('shows indicator on touchmove and keeps it after touchend', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()

    fireEvent.touchMove(bar, { touches: [{ clientX: 100 }] })
    const indicator = screen.getByTestId('hover-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator.style.left).toBe('25%')

    // indicator stays at last touch position after lift
    fireEvent.touchEnd(bar)
    expect(screen.getByTestId('hover-indicator').style.left).toBe('25%')
  })

  it('does not show indicator when interactive is false', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} interactive={false} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    fireEvent.mouseMove(bar, { clientX: 200 })
    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()
  })

  it('clamps indicator to 0% at left edge', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    fireEvent.mouseMove(bar, { clientX: -50 })
    expect(screen.getByTestId('hover-indicator').style.left).toBe('0%')
  })

  it('clamps indicator to 100% at right edge', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    fireEvent.mouseMove(bar, { clientX: 500 })
    expect(screen.getByTestId('hover-indicator').style.left).toBe('100%')
  })
})

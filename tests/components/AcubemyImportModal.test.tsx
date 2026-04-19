import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AcubemyImportModal } from '../../src/components/AcubemyImportModal'

const noop = () => {}

describe('AcubemyImportModal — initial state', () => {
  it('renders file picker and help text', () => {
    render(
      <AcubemyImportModal
        open={true}
        onClose={noop}
        existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByText(/Select your acubemy JSON export/i)).toBeTruthy()
    expect(screen.getByLabelText(/Choose file/i)).toBeTruthy()
  })

  it('shows local storage label when cloud is disabled', () => {
    render(
      <AcubemyImportModal
        open={true}
        onClose={noop}
        existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByText(/Local browser storage/i)).toBeTruthy()
  })

  it('shows cloud label with email when cloud enabled', () => {
    render(
      <AcubemyImportModal
        open={true}
        onClose={noop}
        existingSolves={[]}
        cloudConfig={{ enabled: true, user: { email: 'a@b.com', uid: 'u1' } as any }}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByText(/Cloud \(Firestore\)/i)).toBeTruthy()
    expect(screen.getByText(/a@b.com/)).toBeTruthy()
  })

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(
      <AcubemyImportModal open={true} onClose={onClose} existingSolves={[]} cloudConfig={{ enabled: false, user: null }} onCommit={vi.fn()} />
    )
    fireEvent.click(screen.getByText(/Cancel/i))
    expect(onClose).toHaveBeenCalled()
  })
})

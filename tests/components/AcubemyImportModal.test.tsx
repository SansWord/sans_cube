import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AcubemyImportModal } from '../../src/components/AcubemyImportModal'
import type { User } from 'firebase/auth'
import type { CloudConfig } from '../../src/stores/solveStore'
import type { SolveRecord } from '../../src/types/solve'

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
        cloudConfig={{ enabled: true, user: { email: 'a@b.com', uid: 'u1' } as unknown as User }}
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

describe('AcubemyImportModal — parsed state', () => {
  it('shows import button with skip breakdown', async () => {
    const goodRecord = {
      solve_id: 1, date: '2026-04-18T10:09:22.202Z', scramble: 'R',
      raw_solution: "R'", raw_timestamps: [0], analysis_type: 'cfop',
    }
    const file = new File([JSON.stringify([goodRecord])], 'ex.json', { type: 'application/json' })
    const { container } = render(
      <AcubemyImportModal open={true} onClose={() => {}} existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }} onCommit={vi.fn()} />
    )
    const input = container.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await screen.findByRole('button', { name: /Import 1/i })
    expect(screen.getByText(/Import 1/)).toBeTruthy()
  })

  it('Import button disabled when 0 new rows', async () => {
    const badRecord = { solve_id: 1, date: '2026-04-18T10:09:22.202Z', scramble: 'R', raw_solution: '', raw_timestamps: [] }
    const f2 = new File([JSON.stringify([badRecord])], 'x.json', { type: 'application/json' })
    const { container } = render(
      <AcubemyImportModal open={true} onClose={() => {}} existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }} onCommit={vi.fn()} />
    )
    const input = container.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [f2] })
    fireEvent.change(input)
    const btn = await screen.findByRole('button', { name: /Import 0/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('AcubemyImportModal — commit', () => {
  const goodRecord = {
    solve_id: 42, date: '2026-04-18T10:09:22.202Z', scramble: 'R',
    raw_solution: "R'", raw_timestamps: [0], analysis_type: 'cfop',
  }

  async function openAndParse(onCommit: (drafts: SolveRecord[]) => Promise<void>, cloudConfig: CloudConfig = { enabled: false, user: null }) {
    const { container } = render(
      <AcubemyImportModal open={true} onClose={() => {}} existingSolves={[]}
        cloudConfig={cloudConfig} onCommit={onCommit} />
    )
    const file = new File([JSON.stringify([goodRecord])], 'ex.json', { type: 'application/json' })
    const input = container.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await screen.findByRole('button', { name: /Import 1/i })
  }

  it('calls onCommit with only the "new" drafts', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined)
    await openAndParse(onCommit)
    fireEvent.click(screen.getByRole('button', { name: /Import 1/i }))
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalled())
    const drafts = onCommit.mock.calls[0][0]
    expect(drafts).toHaveLength(1)
    expect(drafts[0].importedFrom).toEqual({ source: 'acubemy', externalId: 42 })
  })

  it('shows writing overlay during async commit', async () => {
    let resolve: () => void
    const pending = new Promise<void>(r => { resolve = r })
    const onCommit = vi.fn().mockReturnValue(pending)
    await openAndParse(onCommit)
    fireEvent.click(screen.getByRole('button', { name: /Import 1/i }))
    expect(screen.getByText(/Importing solves/i)).toBeTruthy()
    expect((screen.getByText(/Cancel/).closest('button') as HTMLButtonElement).disabled).toBe(true)
    resolve!()
    await vi.waitFor(() => expect(screen.queryByText(/Importing solves/i)).toBeNull())
  })
})

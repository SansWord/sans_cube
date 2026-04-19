import { useState } from 'react'
import type { SolveRecord } from '../types/solve'
import type { CloudConfig } from '../hooks/useSolveHistory'
import type { PreviewSummary } from '../utils/acubemyImport/types'
import { parseExport } from '../utils/acubemyImport/parseExport'

type ModalState =
  | { kind: 'initial' }
  | { kind: 'parsed'; summary: PreviewSummary; openedWithCloud: boolean }
  | { kind: 'writing' }
  | { kind: 'error'; message: string }

export interface AcubemyImportModalProps {
  open: boolean
  onClose: () => void
  existingSolves: SolveRecord[]
  cloudConfig: CloudConfig
  onCommit: (newDrafts: SolveRecord[]) => Promise<void>
}

export function AcubemyImportModal({ open, onClose, existingSolves, cloudConfig, onCommit }: AcubemyImportModalProps) {
  const [state, setState] = useState<ModalState>({ kind: 'initial' })

  if (!open) return null

  const label = cloudConfig.enabled && cloudConfig.user
    ? `Will import to: Cloud (Firestore) ☁️ — logged in as ${cloudConfig.user.email}`
    : `Will import to: Local browser storage 💾 — sign in to import to cloud`

  const handleFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = parseExport(parsed, existingSolves)
      if (result.fileError) {
        setState({ kind: 'error', message: result.fileError })
        return
      }
      setState({
        kind: 'parsed',
        summary: result.summary!,
        openedWithCloud: !!(cloudConfig.enabled && cloudConfig.user),
      })
    } catch {
      setState({ kind: 'error', message: 'File is not valid JSON.' })
    }
  }

  return (
    <div role="dialog" aria-modal="true" style={modalStyle}>
      <div style={modalContent}>
        <h2>Import from acubemy</h2>
        <div style={{ marginBottom: 12, color: '#888', fontSize: 12 }}>{label}</div>

        {state.kind === 'initial' && (
          <>
            <p>Select your acubemy JSON export.</p>
            <label htmlFor="acubemy-file-input">Choose file</label>
            <input id="acubemy-file-input" type="file" accept=".json,application/json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </>
        )}

        {state.kind === 'error' && (
          <>
            <div role="alert" style={{ color: '#e74c3c' }}>{state.message}</div>
            <button onClick={() => setState({ kind: 'initial' })}>Try another file</button>
          </>
        )}

        {state.kind === 'parsed' && (
          <>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>Method</th><th>Time</th><th>Moves</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.summary.rows.map((row) => (
                  <tr key={row.index}>
                    <td>{row.index}</td>
                    <td>{row.date ? new Date(row.date).toLocaleString() : '—'}</td>
                    <td>{row.method ?? '—'}</td>
                    <td>{row.timeMs !== undefined ? (row.timeMs / 1000).toFixed(2) + 's' : '—'}</td>
                    <td>{row.moveCount ?? '—'}</td>
                    <td title={row.reason || row.warnings.join(', ') || undefined}>
                      {row.status === 'new' && '✅ new'}
                      {row.status === 'duplicate' && '🔁 duplicate'}
                      {row.status === 'parse-error' && '⚠️ parse-error'}
                      {row.status === 'unsolved' && '❌ unsolved'}
                      {row.warnings.length > 0 && ' ⚠️'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {state.kind === 'writing' && (
          <div style={{ ...modalStyle, background: 'rgba(0,0,0,0.8)' }} role="status">
            <div style={{ color: '#fff' }}>Importing solves to {cloudConfig.enabled && cloudConfig.user ? 'cloud' : 'local storage'}…</div>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={state.kind === 'writing'}>Cancel</button>
          {state.kind === 'parsed' && (() => {
            const c = state.summary.counts
            const warnClause = c.warnings > 0 ? `; ⚠️ ${c.warnings} with warnings` : ''
            const label = `Import ${c.new} (skipping: ${c.duplicate} duplicate, ${c.parseError} parse-error, ${c.unsolved} unsolved${warnClause})`
            const parsedState = state
            return (
              <button
                disabled={c.new === 0}
                onClick={async () => {
                  const drafts = parsedState.summary.rows
                    .filter(r => r.status === 'new' && r.draft)
                    .map(r => r.draft!)
                  const nowCloud = !!(cloudConfig.enabled && cloudConfig.user)
                  if (parsedState.openedWithCloud && !nowCloud) {
                    console.warn('Target changed to Local — proceeding with current setting.')
                  }
                  setState({ kind: 'writing' })
                  try {
                    await onCommit(drafts)
                    setState({ kind: 'initial' })
                    window.alert(`Imported ${drafts.length} solves from acubemy.`)
                    onClose()
                  } catch (e) {
                    setState({
                      kind: 'error',
                      message: `Import failed after ${drafts.length} solves. Any solves already written remain. (${(e as Error).message})`,
                    })
                  }
                }}
              >{label}</button>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

const modalStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  paddingBottom: 60,
}
const modalContent: React.CSSProperties = {
  background: '#1a1a1a', color: '#ccc', padding: 20, borderRadius: 8,
  maxWidth: 900, width: '90%', maxHeight: '90vh', overflow: 'auto',
}

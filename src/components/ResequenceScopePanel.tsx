import { useState, useEffect } from 'react'
import type { SolveRecord } from '../types/solve'
import { DebugPanel, buttonStyle } from './DebugPanel'
import { previewRenumberScope } from '../utils/previewRenumberScope'
import type { RenumberScope } from '../utils/previewRenumberScope'

export interface ResequenceScopePanelProps {
  disabled: boolean
  loadSolves: () => SolveRecord[]
  commit: (onProgress: (batch: number, total: number) => void) => Promise<number>
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'ready'; scope: RenumberScope }
  | { kind: 'committing'; scope: RenumberScope; progress: { batch: number; total: number } }
  | { kind: 'committed'; count: number }

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

export function ResequenceScopePanel({ disabled, loadSolves, commit }: ResequenceScopePanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })

  useEffect(() => {
    if (state.kind !== 'committed') return
    const timer = setTimeout(() => setState({ kind: 'idle' }), 3000)
    return () => clearTimeout(timer)
  }, [state.kind])

  const handlePreview = () => {
    const scope = previewRenumberScope(loadSolves())
    setState({ kind: 'ready', scope })
  }

  const handleCommit = async (scope: RenumberScope) => {
    setState({ kind: 'committing', scope, progress: { batch: 0, total: 0 } })
    const count = await commit((batch, total) => {
      setState({ kind: 'committing', scope, progress: { batch, total } })
    })
    setState({ kind: 'committed', count })
  }

  const warning = (
    <>⚠️ Rewrites <code>seq</code> on Firestore solves starting at the first mismatch.
    Back up your data first (see <code>docs/data-backup.md</code>).</>
  )
  const disabledHint = (
    <>Requires cloud sync. Sign in and enable cloud sync in the Cloud Sync panel above.</>
  )

  return (
    <DebugPanel
      title="Resequence solves (Firestore)"
      warning={warning}
      disabled={disabled}
      disabledHint={disabledHint}
    >
      {state.kind === 'idle' && (
        <button onClick={handlePreview} style={buttonStyle('#3498db')}>
          Preview renumber scope
        </button>
      )}

      {state.kind === 'ready' && (
        <div>
          <div style={{ marginBottom: 6 }}>
            Total solves: {state.scope.totalCount}
          </div>
          {state.scope.firstMismatchIndex === -1 ? (
            <div style={{ color: '#4c4', marginBottom: 8 }}>
              ✓ All solves already sequential. Nothing to renumber.
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <div>
                First mismatch: #{state.scope.firstMismatchSolve!.id} ({formatDate(state.scope.firstMismatchSolve!.date)}) —
                stored seq {state.scope.firstMismatchSolve!.seq}, should be {state.scope.firstMismatchIndex + 1}
              </div>
              {state.scope.renumberedCount > 0 && (
                <div style={{ color: '#e8a020', marginTop: 4 }}>
                  Will renumber {state.scope.renumberedCount} solves.
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => void handleCommit(state.scope)}
              disabled={state.scope.renumberedCount === 0}
              style={buttonStyle('#e8a020', state.scope.renumberedCount === 0)}
            >
              Commit {state.scope.renumberedCount} change{state.scope.renumberedCount === 1 ? '' : 's'}
            </button>
            <button onClick={() => setState({ kind: 'idle' })} style={buttonStyle('#888')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.kind === 'committing' && (
        <div style={{ color: '#e8a020' }}>
          Renumbering... batch {state.progress.batch} of {state.progress.total}
        </div>
      )}

      {state.kind === 'committed' && (
        <div style={{ color: '#4c4' }}>
          ✓ Renumbered {state.count} solves.
        </div>
      )}
    </DebugPanel>
  )
}

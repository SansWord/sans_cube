import { useState } from 'react'
import { recomputeAllPhases } from '../utils/recomputeAllPhases'
import type { RecomputeResult, RecomputeChange } from '../utils/recomputeAllPhases'
import type { SolveRecord, PhaseRecord } from '../types/solve'

export interface RecomputePhasesPanelProps {
  /** Human-readable label for where writes go, e.g. 'Firestore' or 'localStorage'. */
  targetLabel: string
  /** Returns the solves to scan. Called fresh each time "Scan" is clicked. */
  loadSolves: () => Promise<SolveRecord[]> | SolveRecord[]
  /**
   * Writes the changed solves back to the target store. `onProgress(batchIndex, batchCount)`
   * is invoked during the write so the panel can render "batch X of Y".
   * For localStorage: one write, call onProgress(1, 1).
   */
  commitChanges: (
    changes: RecomputeChange[],
    onProgress: (batchIndex: number, batchCount: number) => void,
  ) => Promise<void>
  /** Optional: when provided, sample changed-row ids and failed ids render as clickable buttons. */
  onSolveClick?: (solve: SolveRecord) => void
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'results'; results: RecomputeResult }
  | { kind: 'committing'; results: RecomputeResult; progress: { batch: number; total: number } }
  | { kind: 'committed'; results: RecomputeResult; committedCount: number }

/** Cumulative end-of-phase time (s) + per-phase turns, formatted for display. */
function phaseRow(phases: PhaseRecord[]): string {
  let cum = 0
  return phases.map((p) => {
    cum += p.recognitionMs + p.executionMs
    return `${p.label} ${(cum / 1000).toFixed(1)}s ${p.turns} steps`
  }).join(' | ')
}

/**
 * Same as `phaseRow`, but each segment is annotated with the delta vs the matching old
 * phase (matched by index when labels agree). Example: "Cross 3.6s(-0.1s) 7 steps(-1)".
 */
function phaseRowWithDiff(newPhases: PhaseRecord[], oldPhases: PhaseRecord[]): string {
  const fmtSec = (delta: number) => `${delta >= 0 ? '+' : ''}${(delta / 1000).toFixed(1)}s`
  const fmtInt = (delta: number) => `${delta >= 0 ? '+' : ''}${delta}`
  let newCum = 0
  let oldCum = 0
  return newPhases.map((p, i) => {
    newCum += p.recognitionMs + p.executionMs
    const old = oldPhases[i]
    if (old && old.label === p.label) {
      oldCum += old.recognitionMs + old.executionMs
      const dt = newCum - oldCum
      const dn = p.turns - old.turns
      const dtPart = dt === 0 ? '' : `(${fmtSec(dt)})`
      const dnPart = dn === 0 ? '' : `(${fmtInt(dn)})`
      return `${p.label} ${(newCum / 1000).toFixed(1)}s${dtPart} ${p.turns} steps${dnPart}`
    }
    return `${p.label} ${(newCum / 1000).toFixed(1)}s ${p.turns} steps`
  }).join(' | ')
}

function SolveIdLink({ solve, onClick }: { solve: SolveRecord; onClick?: (s: SolveRecord) => void }) {
  if (!onClick) return <>#{solve.id}</>
  return (
    <button
      onClick={() => onClick(solve)}
      style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: 'monospace', textDecoration: 'underline' }}
    >
      #{solve.id}
    </button>
  )
}

export function RecomputePhasesPanel({ targetLabel, loadSolves, commitChanges, onSolveClick }: RecomputePhasesPanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })

  const runScan = async () => {
    setState({ kind: 'scanning' })
    const solves = await loadSolves()
    setState({ kind: 'results', results: recomputeAllPhases(solves) })
  }

  const runCommit = async () => {
    if (state.kind !== 'results') return
    const results = state.results
    setState({ kind: 'committing', results, progress: { batch: 0, total: 0 } })
    await commitChanges(results.changed, (batch, total) => {
      setState({ kind: 'committing', results, progress: { batch, total } })
    })
    setState({ kind: 'committed', results, committedCount: results.changed.length })
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#aaa' }}>
        Recompute phases ({targetLabel})
      </div>
      <div style={{ color: '#e8a020', marginBottom: 8 }}>
        ⚠️ This rewrites every solve's <code>phases</code> array. Back up your data first
        (see the Backup button in the maintenance toolbar, or <code>docs/data-backup.md</code>).
      </div>

      {(state.kind === 'idle' || state.kind === 'scanning') && (
        <button
          onClick={runScan}
          disabled={state.kind === 'scanning'}
          style={buttonStyle('#3498db', state.kind === 'scanning')}
        >
          {state.kind === 'scanning' ? 'Loading...' : 'Scan (dry run)'}
        </button>
      )}

      {(state.kind === 'results' || state.kind === 'committing' || state.kind === 'committed') && (
        <div>
          <div style={{ color: '#888', marginBottom: 4 }}>
            Total scanned: {state.results.unchanged.length + state.results.changed.length + state.results.failed.length + state.results.skipped.length}
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#4c4' }}>Unchanged: {state.results.unchanged.length}</span>
            {' · '}
            <span style={{ color: '#e8a020' }}>Changed: {state.results.changed.length}</span>
            {' · '}
            <span style={{ color: '#e74c3c' }}>Failed: {state.results.failed.length}</span>
            {' · '}
            <span style={{ color: '#888' }}>Skipped: {state.results.skipped.length}</span>
          </div>

          {state.results.changed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 4 }}>Sample changed (first 5):</div>
              {state.results.changed.slice(0, 5).map(({ solve, oldPhases, newPhases }) => (
                <div key={solve.id} style={{ borderTop: '1px solid #222', padding: '3px 0' }}>
                  <div><SolveIdLink solve={solve} onClick={onSolveClick} /> <span style={{ color: '#888' }}>{solve.method ?? 'cfop'}</span></div>
                  <div style={{ color: '#e74c3c' }}>old: {phaseRow(oldPhases)}</div>
                  <div style={{ color: '#4c4' }}>new: {phaseRowWithDiff(newPhases, oldPhases)}</div>
                </div>
              ))}
            </div>
          )}

          {state.results.failed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 4 }}>Failed solve ids (excluded from commit):</div>
              <div>
                {state.results.failed.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ', '}
                    <SolveIdLink solve={s} onClick={onSolveClick} />
                  </span>
                ))}
              </div>
            </div>
          )}

          {state.kind === 'results' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {state.results.changed.length > 0 && (
                <button onClick={runCommit} style={buttonStyle('#e8a020')}>
                  Commit {state.results.changed.length} change{state.results.changed.length === 1 ? '' : 's'}
                </button>
              )}
              <button onClick={() => setState({ kind: 'idle' })} style={buttonStyle('#888')}>
                Cancel
              </button>
            </div>
          )}

          {state.kind === 'committing' && (
            <div style={{ color: '#e8a020' }}>
              Committing batch {state.progress.batch} of {state.progress.total}...
            </div>
          )}

          {state.kind === 'committed' && (
            <div style={{ color: '#4c4' }}>
              Committed {state.committedCount} solve{state.committedCount === 1 ? '' : 's'}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const boxStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc',
  padding: '12px 16px', borderRadius: 6, marginTop: 8,
}

function buttonStyle(color: string, disabled = false): React.CSSProperties {
  return {
    alignSelf: 'flex-start', padding: '3px 10px', cursor: disabled ? 'default' : 'pointer',
    background: '#222', color, border: `1px solid ${color}`, borderRadius: 3, fontSize: 11,
    opacity: disabled ? 0.6 : 1,
  }
}

import { useState } from 'react'
import { recomputeAllPhases } from '../utils/recomputeAllPhases'
import type { RecomputeResult, RecomputeChange } from '../utils/recomputeAllPhases'
import type { SolveRecord } from '../types/solve'

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
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'results'; results: RecomputeResult }
  | { kind: 'committing'; results: RecomputeResult; progress: { batch: number; total: number } }
  | { kind: 'committed'; results: RecomputeResult; committedCount: number }

export function RecomputePhasesPanel({ targetLabel, loadSolves, commitChanges }: RecomputePhasesPanelProps) {
  void commitChanges // used in Task 7 commit flow
  const [state, setState] = useState<PanelState>({ kind: 'idle' })

  const runScan = async () => {
    setState({ kind: 'scanning' })
    const solves = await loadSolves()
    setState({ kind: 'results', results: recomputeAllPhases(solves) })
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
      {state.kind === 'idle' && (
        <button onClick={runScan} style={buttonStyle('#3498db')}>Scan (dry run)</button>
      )}
      {state.kind === 'scanning' && (
        <div style={{ color: '#888' }}>Scanning...</div>
      )}
    </div>
  )
}

const boxStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc',
  padding: '12px 16px', borderRadius: 6, marginTop: 8,
}

function buttonStyle(color: string): React.CSSProperties {
  return {
    alignSelf: 'flex-start', padding: '3px 10px', cursor: 'pointer',
    background: '#222', color, border: `1px solid ${color}`, borderRadius: 3, fontSize: 11,
  }
}

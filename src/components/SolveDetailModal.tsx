import { useState, useRef, useCallback, useEffect } from 'react'
import type { SolveRecord } from '../types/solve'
import { CFOP } from '../methods/cfop'
import { PhaseBar } from './PhaseBar'
import { CubeCanvas } from './CubeCanvas'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets } from '../hooks/useCubeState'
import type { Quaternion } from '../types/cube'

interface Props {
  solve: SolveRecord
  onClose: () => void
  onDelete: (id: number) => void
  onUseScramble: (scramble: string) => void
}

const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 }
const SPEED_OPTIONS = [0.5, 1, 2]

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2) + 's'
}

function computeFaceletsAtIndex(moves: SolveRecord['moves'], index: number): string {
  let f = SOLVED_FACELETS
  for (let i = 0; i < index; i++) {
    f = applyMoveToFacelets(f, moves[i])
  }
  return f
}

function getPhaseLabelAtIndex(solve: SolveRecord, moveIndex: number): string {
  let cumulative = 0
  for (const phase of solve.phases) {
    cumulative += phase.turns
    if (moveIndex < cumulative) return phase.label
  }
  return 'Solved'
}

export function SolveDetailModal({ solve, onClose, onDelete, onUseScramble }: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [gyroEnabled, setGyroEnabled] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Sync canvas to currentIndex
  useEffect(() => {
    const facelets = computeFaceletsAtIndex(solve.moves, currentIndex)
    rendererRef.current?.queueFaceletsUpdate(facelets)
  }, [currentIndex, solve.moves])

  const cancelScheduled = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const play = useCallback(() => {
    setIsPlaying(true)
    const startIdx = currentIndex
    const moves = solve.moves

    moves.slice(startIdx).forEach((m, i) => {
      const globalIdx = startIdx + i
      const prevTs = globalIdx === 0 ? moves[0].cubeTimestamp : moves[globalIdx - 1].cubeTimestamp
      const currTs = m.cubeTimestamp
      const delay = globalIdx === 0 ? 0 : (currTs - prevTs) / speed
      const t = setTimeout(() => {
        rendererRef.current?.animateMove(m.face, m.direction, Math.max(60, delay * 0.8))
        setCurrentIndex(globalIdx + 1)
        if (globalIdx + 1 >= moves.length) setIsPlaying(false)
      }, delay)
      timeoutsRef.current.push(t)
    })
  }, [currentIndex, solve.moves, speed])

  const pause = useCallback(() => {
    cancelScheduled()
    setIsPlaying(false)
  }, [cancelScheduled])

  const scrub = useCallback((idx: number) => {
    cancelScheduled()
    setIsPlaying(false)
    setCurrentIndex(idx)
  }, [cancelScheduled])

  useEffect(() => {
    if (isPlaying) { cancelScheduled(); setIsPlaying(false) }
  }, [speed]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalMs = solve.timeMs
  const elapsedMs = currentIndex > 0
    ? solve.moves[currentIndex - 1].cubeTimestamp - solve.moves[0].cubeTimestamp
    : 0

  const totalTurns = solve.moves.length
  const tps = totalTurns / (totalMs / 1000)
  const totalExecMs = solve.phases.reduce((s, p) => s + p.executionMs, 0)

  // Cumulative totals for analysis table
  let cumMs = 0
  const tableRows = solve.phases.map((p) => {
    const stepMs = p.recognitionMs + p.executionMs
    cumMs += stepMs
    return { ...p, stepMs, cumMs }
  })
  const totalRecMs = solve.phases.reduce((s, p) => s + p.recognitionMs, 0)
  const recPct = totalMs > 0 ? ((totalRecMs / totalMs) * 100).toFixed(0) : '0'
  const execPct = totalMs > 0 ? ((totalExecMs / totalMs) * 100).toFixed(0) : '0'

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#0f1020',
        border: '1px solid #333',
        borderRadius: 8,
        width: '90vw',
        maxWidth: 860,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 20,
        color: '#ccc',
        fontSize: 13,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 'bold', fontSize: 16 }}>Solve #{solve.id}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        {/* General statistics */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Time', value: formatTime(solve.timeMs) },
            { label: 'Turns', value: String(totalTurns) },
            { label: 'TPS', value: tps.toFixed(2) },
            { label: 'Date', value: formatDate(solve.date) },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, background: '#161626', borderRadius: 4, padding: '8px 12px' }}>
              <div style={{ color: '#666', fontSize: 11 }}>{label}</div>
              <div style={{ fontWeight: 'bold', fontSize: 15 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Scramble row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#161626', borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{solve.scramble}</span>
          <button
            onClick={() => navigator.clipboard.writeText(solve.scramble)}
            style={{ padding: '4px 8px', fontSize: 11 }}
            title="Copy scramble"
          >📋</button>
          <button
            onClick={() => onUseScramble(solve.scramble)}
            style={{ padding: '4px 10px', fontSize: 11, background: '#2ecc71', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Use this scramble
          </button>
        </div>

        {/* Body: Replay + Analysis */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {/* Replay */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Replay</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={gyroEnabled} onChange={(e) => setGyroEnabled(e.target.checked)} />
                {' '}Gyro
              </label>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ padding: '3px', fontSize: 12 }}
              >
                {SPEED_OPTIONS.map((s) => <option key={s} value={s}>×{s}</option>)}
              </select>
            </div>
            <CubeCanvas
              facelets={computeFaceletsAtIndex(solve.moves, currentIndex)}
              quaternion={IDENTITY_QUATERNION}
              onRendererReady={(r) => { rendererRef.current = r }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              <button onClick={() => scrub(0)}>«</button>
              <button onClick={() => scrub(Math.max(0, currentIndex - 1))}>‹</button>
              <button onClick={isPlaying ? pause : play}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={() => scrub(Math.min(solve.moves.length, currentIndex + 1))}>›</button>
              <button onClick={() => scrub(solve.moves.length)}>»</button>
            </div>
            <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 4 }}>
              {getPhaseLabelAtIndex(solve, currentIndex)} — {formatTime(elapsedMs)} / {formatTime(totalMs)}
            </div>
            <input
              type="range" min={0} max={solve.moves.length} value={currentIndex}
              onChange={(e) => scrub(Number(e.target.value))}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>

          {/* Detailed Analysis */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Detailed Analysis</span>
              <span style={{ color: '#888', fontSize: 12 }}>CFOP</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#555', borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '3px 4px' }}>Step</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Recog.</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Exec.</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Step</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Turns</td>
                </tr>
                <tr style={{ color: '#888', borderBottom: '1px solid #222', fontSize: 11 }}>
                  <td style={{ padding: '3px 4px' }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalRecMs)} ({recPct}%)</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalExecMs)} ({execPct}%)</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalMs)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalMs)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{totalTurns}</td>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a2e' }}>
                    <td style={{ padding: '4px 4px' }}>{row.label}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                      {row.label === 'Cross' ? '—' : formatTime(row.recognitionMs)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.executionMs)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.stepMs)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.cumMs)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{row.turns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time Distribution */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>Time Distribution</div>
          <PhaseBar phaseRecords={solve.phases} method={CFOP} interactive={false} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {confirmDelete ? (
            <>
              <span style={{ color: '#e74c3c', fontSize: 12, marginRight: 8, alignSelf: 'center' }}>
                Delete this solve?
              </span>
              <button onClick={() => onDelete(solve.id)} style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px' }}>
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

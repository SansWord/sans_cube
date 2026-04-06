import React, { useState, useRef, useEffect, useMemo } from 'react'
import type { SolveRecord } from '../types/solve'
import { CFOP } from '../methods/cfop'
import { PhaseBar } from './PhaseBar'
import { CubeCanvas } from './CubeCanvas'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets } from '../hooks/useCubeState'
import { parseScramble } from '../utils/scramble'
import { formatTime } from '../utils/formatting'
import { IDENTITY_QUATERNION } from '../utils/quaternion'
import { useReplayController, SPEED_OPTIONS } from '../hooks/useReplayController'

interface Props {
  solve: SolveRecord
  onClose: () => void
  onDelete: (id: number) => void
  onUseScramble: (scramble: string) => void
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

function computeScrambledFacelets(scramble: string): string {
  let f = SOLVED_FACELETS
  for (const step of parseScramble(scramble)) {
    const move = { face: step.face, direction: step.direction, cubeTimestamp: 0, serial: 0 }
    f = applyMoveToFacelets(f, move)
    if (step.double) f = applyMoveToFacelets(f, move)
  }
  return f
}

function computeFaceletsAtIndex(scrambledFacelets: string, moves: SolveRecord['moves'], index: number): string {
  let f = scrambledFacelets
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

const AUTO_PLAY_DELAY_MS = 2000

export function SolveDetailModal({ solve, onClose, onDelete, onUseScramble }: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const scrambledFacelets = computeScrambledFacelets(solve.scramble)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const modalRef = useRef<HTMLDivElement>(null)
  const phaseBarRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const justStartedPlayingRef = useRef(false)

  const {
    currentIndex, indicatorMs, isPlaying,
    speed, setSpeed, gyroEnabled, setGyroEnabled,
    playFrom, play, pause, seekTo,
    stepForward, stepBackward, fastForward, fastBackward,
  } = useReplayController(solve, rendererRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const t = setTimeout(() => play(), AUTO_PLAY_DELAY_MS)
    return () => clearTimeout(t)
  }, [play])

  const totalMs = solve.timeMs

  const totalTurns = solve.moves.length
  const tps = totalTurns / (totalMs / 1000)
  const totalExecMs = solve.phases.reduce((s, p) => s + p.executionMs, 0)

  // Indices of moves that cancel each other (same face, opposite direction, consecutive)
  const cancelledIndices = useMemo(() => {
    const set = new Set<number>()
    const moves = solve.moves
    for (let i = 0; i < moves.length - 1; i++) {
      if (moves[i].face === moves[i + 1].face && moves[i].direction !== moves[i + 1].direction) {
        set.add(i)
        set.add(i + 1)
        i++ // consume i+1 so it can't start another pair (e.g. U U' U: only first two marked)
      }
    }
    return set
  }, [solve.moves])

  // Cumulative totals for analysis table, with move slice per phase
  let cumMs = 0
  let cumTurns = 0
  const tableRows = solve.phases.map((p) => {
    const stepMs = p.recognitionMs + p.executionMs
    cumMs += stepMs
    const moveStart = cumTurns
    cumTurns += p.turns
    return { ...p, stepMs, cumMs, moveStart, moves: solve.moves.slice(moveStart, cumTurns) }
  })

  // Which phase and move-within-phase is currently active during replay
  // If currentIndex lands exactly on a phase boundary, highlight the upcoming phase.
  // Otherwise highlight the phase of the last played move (currentIndex - 1).
  const activePhaseIndex = currentIndex === 0 ? -1
    : (() => {
        const exactStart = tableRows.findIndex((r) => r.moveStart === currentIndex)
        if (exactStart >= 0) return exactStart
        return tableRows.findIndex((r) => currentIndex - 1 >= r.moveStart && currentIndex - 1 < r.moveStart + r.turns)
      })()
  const activeMoveInPhase = activePhaseIndex >= 0 ? (currentIndex - 1) - tableRows[activePhaseIndex].moveStart : -1
  // When play starts: scroll body to top so replay+phasebar become sticky
  useEffect(() => {
    if (!isPlaying || !bodyRef.current || !modalRef.current) return
    justStartedPlayingRef.current = true
    const modal = modalRef.current
    const body = bodyRef.current
    const modalRect = modal.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    modal.scrollTo({ top: bodyRect.top - modalRect.top + modal.scrollTop, behavior: 'smooth' })
    const timer = setTimeout(() => { justStartedPlayingRef.current = false }, 600)
    return () => clearTimeout(timer)
  }, [isPlaying])

  // As phases advance during playback: scroll active row to just below phasebar
  useEffect(() => {
    if (!isPlaying || justStartedPlayingRef.current) return
    const row = activePhaseIndex >= 0 ? rowRefs.current[activePhaseIndex] : null
    const modal = modalRef.current
    if (!row || !modal) return
    const modalRect = modal.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const phaseBarBottom = phaseBarRef.current
      ? phaseBarRef.current.getBoundingClientRect().bottom - modalRect.top
      : 0
    const rowTopInModal = rowRect.top - modalRect.top + modal.scrollTop
    modal.scrollTo({ top: rowTopInModal - phaseBarBottom, behavior: 'smooth' })
  }, [activePhaseIndex, isPlaying])

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
      <div ref={modalRef} className="solve-detail-modal" style={{
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
        <div className="solve-detail-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 'bold', fontSize: 16 }}>{solve.isExample ? 'Example Solve' : `Solve #${solve.id}`}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {solve.isExample && (
              <a
                href="https://www.linkedin.com/in/sansword/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#aaa', textDecoration: 'none', fontSize: 12 }}
              >
                Built by SansWord
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* General statistics */}
        <div className="solve-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Time', value: formatTime(solve.timeMs) },
            { label: 'Turns', value: String(totalTurns) },
            { label: 'TPS', value: tps.toFixed(2) },
            { label: 'Date', value: formatDate(solve.date) },
            { label: 'Driver', value: solve.driver === 'cube' ? 'Cube' : solve.driver === 'mouse' ? 'Mouse' : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, background: '#161626', borderRadius: 4, padding: '8px 12px' }}>
              <div className="stat-label" style={{ color: '#666', fontSize: 11 }}>{label}</div>
              <div className="stat-value" style={{ fontWeight: 'bold', fontSize: 15 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Scramble row */}
        <div className="solve-scramble" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#161626', borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{solve.scramble}</span>
          <button
            onClick={() => navigator.clipboard.writeText(solve.scramble)}
            style={{ padding: '4px 8px', fontSize: 11 }}
            title="Copy scramble"
          >📋</button>
          <button
            onClick={() => { onUseScramble(solve.scramble); onClose() }}
            style={{ padding: '4px 10px', fontSize: 11, background: '#2ecc71', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Use this scramble
          </button>
        </div>

        {/* Body: Replay + Analysis */}
        <div ref={bodyRef} className="solve-detail-body" style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {/* Replay */}
          <div className="replay-section" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Replay</span>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={gyroEnabled} onChange={(e) => setGyroEnabled(e.target.checked)} />
                {' '}Gyro
              </label>
              <label style={{ fontSize: 12, color: '#888' }}>Speed</label>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ padding: '3px', fontSize: 12 }}
              >
                {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            </div>
            <CubeCanvas
              facelets={computeFaceletsAtIndex(scrambledFacelets, solve.moves, currentIndex)}
              quaternion={IDENTITY_QUATERNION}
              onRendererReady={(r) => {
                rendererRef.current = r
                if (!solve.moves.some((m) => m.quaternion) || !gyroEnabled) {
                  r.setCameraPosition(4.5, 5, 5.5)
                }
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
              {[
                { label: '↺',  title: 'Restart',              onClick: () => seekTo(0) },
                { label: '⏮',  title: 'Fast backward',        onClick: fastBackward },
                { label: '◁',  title: 'Step back',            onClick: stepBackward },
                { label: isPlaying ? '⏸' : '▶', title: isPlaying ? 'Pause' : 'Play', onClick: isPlaying ? pause : play },
                { label: '▷',  title: 'Step forward',         onClick: stepForward },
                { label: '⏭',  title: 'Fast forward',         onClick: fastForward },
              ].map(({ label, title, onClick }) => (
                <button
                  key={title}
                  onClick={onClick}
                  title={title}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 4 }}>
              {getPhaseLabelAtIndex(solve, currentIndex)} — {formatTime(indicatorMs)} / {formatTime(totalMs)}
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="analysis-section" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Detailed Analysis</span>
              <span style={{ color: '#888', fontSize: 12 }}>CFOP</span>
            </div>
            <div ref={phaseBarRef} className="analysis-phasebar">
              <PhaseBar
                phaseRecords={solve.phases}
                method={CFOP}
                interactive={false}
                indicatorPct={totalMs > 0 ? Math.min(100, (indicatorMs / totalMs) * 100) : 0}
              />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
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
                {tableRows.map((row, i) => {
                  const isActive = i === activePhaseIndex
                  const isHovered = i === hoveredRowIndex
                  const rowBg = isActive ? 'rgba(46,204,113,0.1)' : isHovered ? '#161626' : 'transparent'
                  return (
                    <React.Fragment key={i}>
                      <tr
                        ref={(el) => { rowRefs.current[i] = el }}
                        style={{ background: rowBg, cursor: 'pointer' }}
                        onClick={() => playFrom(row.moveStart)}
                        onMouseEnter={() => setHoveredRowIndex(i)}
                        onMouseLeave={() => setHoveredRowIndex(null)}
                      >
                        <td style={{ padding: '4px 4px', color: isActive ? '#2ecc71' : undefined }}>
                          {row.label}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                          {row.label === 'Cross' ? '—' : formatTime(row.recognitionMs)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.executionMs)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.stepMs)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.cumMs)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>{row.turns}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #1a1a2e', background: isActive ? 'rgba(46,204,113,0.05)' : 'transparent' }}>
                          <td colSpan={6} style={{ padding: '4px 8px 8px 20px', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1 }}>
                            {row.moves.length > 0
                              ? row.moves.map((m, mi) => {
                                  const isCurrentMove = isActive && mi === activeMoveInPhase
                                  const isCancelled = cancelledIndices.has(row.moveStart + mi)
                                  return (
                                    <span
                                      key={mi}
                                      onClick={() => {
                                        const globalIdx = row.moveStart + mi
                                        rendererRef.current?.animateMove(solve.moves[globalIdx].face, solve.moves[globalIdx].direction, 150)
                                        playFrom(globalIdx + 1)
                                      }}
                                      style={{
                                        color: isCurrentMove ? '#2ecc71' : isCancelled ? '#e74c3c' : '#aaa',
                                        fontWeight: isCurrentMove ? 'bold' : 'normal',
                                        marginRight: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {m.face + (m.direction === 'CCW' ? "'" : '')}
                                    </span>
                                  )
                                })
                              : <span style={{ color: '#aaa' }}>—</span>}
                          </td>
                        </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="solve-detail-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

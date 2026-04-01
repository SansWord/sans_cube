import { useState, useRef, useCallback, useEffect } from 'react'
import type { SolveRecord } from '../types/solve'
import { CFOP } from '../methods/cfop'
import { PhaseBar } from './PhaseBar'
import { CubeCanvas } from './CubeCanvas'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets } from '../hooks/useCubeState'
import { parseScramble } from '../utils/scramble'
import type { Quaternion } from '../types/cube'

interface Props {
  solve: SolveRecord
  onClose: () => void
  onDelete: (id: number) => void
  onUseScramble: (scramble: string) => void
}

const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

function slerpQuaternion(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w
  let { x: bx, y: by, z: bz, w: bw } = b
  if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot }
  if (dot > 0.9995) {
    // Nearly identical — normalised lerp
    const rx = a.x + t*(bx-a.x), ry = a.y + t*(by-a.y)
    const rz = a.z + t*(bz-a.z), rw = a.w + t*(bw-a.w)
    const len = Math.hypot(rx, ry, rz, rw)
    return { x: rx/len, y: ry/len, z: rz/len, w: rw/len }
  }
  const theta0 = Math.acos(dot)
  const theta = theta0 * t
  const sinTheta = Math.sin(theta)
  const sinTheta0 = Math.sin(theta0)
  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0
  const s1 = sinTheta / sinTheta0
  return { x: s0*a.x + s1*bx, y: s0*a.y + s1*by, z: s0*a.z + s1*bz, w: s0*a.w + s1*bw }
}

function findSlerpedQuaternion(snapshots: { quaternion: Quaternion; relativeMs: number }[], solveElapsedMs: number): Quaternion | null {
  if (snapshots.length === 0) return null
  if (solveElapsedMs <= snapshots[0].relativeMs) return snapshots[0].quaternion
  const last = snapshots[snapshots.length - 1]
  if (solveElapsedMs >= last.relativeMs) return last.quaternion
  // Binary search for surrounding pair
  let lo = 0, hi = snapshots.length - 2
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (snapshots[mid + 1].relativeMs <= solveElapsedMs) lo = mid + 1
    else hi = mid
  }
  const prev = snapshots[lo], next = snapshots[lo + 1]
  const t = (solveElapsedMs - prev.relativeMs) / (next.relativeMs - prev.relativeMs)
  return slerpQuaternion(prev.quaternion, next.quaternion, t)
}
const SPEED_OPTIONS = [0.5, 1, 2]

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2) + 's'
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

export function SolveDetailModal({ solve, onClose, onDelete, onUseScramble }: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const scrambledFacelets = computeScrambledFacelets(solve.scramble)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [indicatorMs, setIndicatorMs] = useState(0)
  const [replayQuaternion] = useState<Quaternion>(IDENTITY_QUATERNION)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [gyroEnabled, setGyroEnabled] = useState(true)
  const gyroEnabledRef = useRef(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const gyroRafRef = useRef<number | null>(null)
  const playStartWallRef = useRef(0)
  const playStartOffsetRef = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    gyroEnabledRef.current = gyroEnabled
    if (!gyroEnabled) {
      rendererRef.current?.setQuaternion(IDENTITY_QUATERNION)
      rendererRef.current?.setCameraPosition(4.5, 5, 5.5)
    } else {
      rendererRef.current?.setCameraPosition(0, 6, 7)
      rendererRef.current?.setQuaternion(replayQuaternion)
    }
  }, [gyroEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const cancelScheduled = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (gyroRafRef.current !== null) {
      cancelAnimationFrame(gyroRafRef.current)
      gyroRafRef.current = null
    }
  }, [])

  const playFrom = useCallback((startIdx: number) => {
    cancelScheduled()
    setCurrentIndex(startIdx)
    setIsPlaying(true)
    const moves = solve.moves
    const snapshots = solve.quaternionSnapshots ?? []

    const startOffsetMs = startIdx > 0
      ? moves[startIdx - 1].cubeTimestamp - moves[0].cubeTimestamp
      : 0

    let cumulativeDelay = 0
    moves.slice(startIdx).forEach((m, i) => {
      const globalIdx = startIdx + i
      if (globalIdx > 0) {
        cumulativeDelay += (m.cubeTimestamp - moves[globalIdx - 1].cubeTimestamp) / speed
      }
      const t = setTimeout(() => {
        rendererRef.current?.animateMove(m.face, m.direction, 150)
        setCurrentIndex(globalIdx + 1)
        if (globalIdx + 1 >= moves.length) setIsPlaying(false)
      }, cumulativeDelay)
      timeoutsRef.current.push(t)
    })

    playStartWallRef.current = performance.now()
    playStartOffsetRef.current = startOffsetMs
    const loop = () => {
      const solveElapsed = playStartOffsetRef.current +
        (performance.now() - playStartWallRef.current) * speed
      setIndicatorMs(solveElapsed)
      if (gyroEnabledRef.current && snapshots.length >= 2) {
        const q = findSlerpedQuaternion(snapshots, solveElapsed)
        if (q) rendererRef.current?.setQuaternion(q)
      }
      gyroRafRef.current = requestAnimationFrame(loop)
    }
    gyroRafRef.current = requestAnimationFrame(loop)
  }, [cancelScheduled, solve.moves, solve.quaternionSnapshots, speed])

  const play = useCallback(() => playFrom(currentIndex), [playFrom, currentIndex])

  const pause = useCallback(() => {
    cancelScheduled()
    setIsPlaying(false)
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
  const activePhaseIndex = currentIndex === 0 ? -1
    : tableRows.findIndex((r) => currentIndex - 1 >= r.moveStart && currentIndex - 1 < r.moveStart + r.turns)
  const activeMoveInPhase = activePhaseIndex >= 0 ? (currentIndex - 1) - tableRows[activePhaseIndex].moveStart : -1
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
              facelets={computeFaceletsAtIndex(scrambledFacelets, solve.moves, currentIndex)}
              quaternion={replayQuaternion}
              onRendererReady={(r) => {
                rendererRef.current = r
                if (!solve.moves.some((m) => m.quaternion) || !gyroEnabledRef.current) {
                  r.setCameraPosition(4.5, 5, 5.5)
                }
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
              {[
                { label: isPlaying ? '⏸' : '▶', title: isPlaying ? 'Pause' : 'Play', onClick: isPlaying ? pause : play },
                { label: '↺', title: 'Replay from start', onClick: () => playFrom(0) },
              ].map(({ label, title, onClick }) => (
                <button
                  key={title}
                  onClick={onClick}
                  title={title}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: label === '↺' ? 22 : 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 4 }}>
              {getPhaseLabelAtIndex(solve, currentIndex)} — {formatTime(elapsedMs)} / {formatTime(totalMs)}
            </div>
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
                {tableRows.map((row, i) => {
                  const isActive = i === activePhaseIndex
                  const isHovered = i === hoveredRowIndex
                  const rowBg = isActive ? 'rgba(46,204,113,0.1)' : isHovered ? '#161626' : 'transparent'
                  return (
                    <>
                      <tr
                        key={i}
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
                      <tr key={`${i}-moves`} style={{ borderBottom: '1px solid #1a1a2e', background: isActive ? 'rgba(46,204,113,0.05)' : 'transparent' }}>
                          <td colSpan={6} style={{ padding: '4px 8px 8px 20px', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1 }}>
                            {row.moves.length > 0
                              ? row.moves.map((m, mi) => {
                                  const isCurrentMove = isActive && mi === activeMoveInPhase
                                  return (
                                    <span
                                      key={mi}
                                      style={{
                                        color: isCurrentMove ? '#2ecc71' : '#aaa',
                                        fontWeight: isCurrentMove ? 'bold' : 'normal',
                                        marginRight: 4,
                                      }}
                                    >
                                      {m.face + (m.direction === 'CCW' ? "'" : '')}
                                    </span>
                                  )
                                })
                              : <span style={{ color: '#aaa' }}>—</span>}
                          </td>
                        </tr>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time Distribution */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>Time Distribution</div>
          <PhaseBar
            phaseRecords={solve.phases}
            method={CFOP}
            interactive={false}
            indicatorPct={totalMs > 0 ? Math.min(100, (indicatorMs / totalMs) * 100) : 0}
          />
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

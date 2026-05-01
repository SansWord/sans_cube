import React, { useState, useRef, useEffect, useMemo } from 'react'
import type { SolveRecord } from '../types/solve'
import { getMethod } from '../methods/index'
import { PhaseBar } from './PhaseBar'
import { CubeCanvas } from './CubeCanvas'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import { SOLVED_FACELETS } from '../types/cube'
import type { PositionMove } from '../types/cube'
import { applyMoveToFacelets } from '../utils/applyMove'
import { parseScramble } from '../utils/scramble'
import { formatTime } from '../utils/formatting'
import { IDENTITY_QUATERNION } from '../utils/quaternion'
import { useReplayController, SPEED_OPTIONS } from '../hooks/useReplayController'
import { MethodSelector } from './MethodSelector'
import { recomputePhases } from '../utils/recomputePhases'
import type { SolveMethod } from '../types/solve'
import { logSolveShared } from '../services/analytics'
import { migrateSolveV1toV2, correctMovesV1toV2 } from '../utils/migrateSolveV1toV2'

interface Props {
  solve: SolveRecord
  onClose: () => void
  onDelete: (id: number) => void
  onUseScramble?: (scramble: string) => void
  onUpdate: (solve: SolveRecord) => Promise<void>
  onShare?: (solve: SolveRecord) => Promise<string>
  onUnshare?: (shareId: string) => Promise<void>
  readOnly?: boolean
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

const AUTO_PLAY_DELAY_MS = 500

type ShareState = 'idle' | 'sharing' | 'unsharing'

export function SolveDetailModal({ solve, onClose, onDelete, onUseScramble, onUpdate, onShare, onUnshare, readOnly }: Props) {
  const [localSolve, setLocalSolve] = useState(solve)
  const [saving, setSaving] = useState(false)
  const [reviewingMigration, setReviewingMigration] = useState(false)
  const [migratingToV2, setMigratingToV2] = useState(false)
  const [migrateToV2Error, setMigrateToV2Error] = useState<string | null>(null)
  const [methodError, setMethodError] = useState<string | null>(null)
  const [savedConfirmation, setSavedConfirmation] = useState(false)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const [orbitChanged, setOrbitChanged] = useState(false)
  const scrambledFacelets = computeScrambledFacelets(localSolve.scramble)
  const method = getMethod(localSolve.method)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copiedSteps, setCopiedSteps] = useState(false)
  const [copiedExample, setCopiedExample] = useState(false)
  const [shareState, setShareState] = useState<ShareState>('idle')
  const [shareCopied, setShareCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [migrationDebugLog, setMigrationDebugLog] = useState<string[] | null>(null)
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
  } = useReplayController(localSolve, rendererRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const t = setTimeout(() => play(), AUTO_PLAY_DELAY_MS)
    return () => clearTimeout(t)
  }, [play])

  const totalMs = localSolve.timeMs

  const totalTurns = localSolve.moves.length
  const tps = totalTurns / (totalMs / 1000)
  const isV1 = (localSolve.schemaVersion ?? 1) < 2
  const hasSliceMoves = localSolve.moves.some(m => m.face === 'M' || m.face === 'E' || m.face === 'S')
  const showMigrationWarning = isV1 && hasSliceMoves
  const showSchemaVersionBump = isV1 && !hasSliceMoves
  const totalExecMs = localSolve.phases.reduce((s, p) => s + p.executionMs, 0)

  // Indices of moves that cancel each other (same face, opposite direction, consecutive)
  const cancelledIndices = useMemo(() => {
    const set = new Set<number>()
    const moves = localSolve.moves
    for (let i = 0; i < moves.length - 1; i++) {
      if (moves[i].face === moves[i + 1].face && moves[i].direction !== moves[i + 1].direction) {
        set.add(i)
        set.add(i + 1)
        i++ // consume i+1 so it can't start another pair (e.g. U U' U: only first two marked)
      }
    }
    return set
  }, [localSolve.moves])

  // Cumulative totals for analysis table, with move slice per phase
  let cumMs = 0
  let cumTurns = 0
  const tableRows = localSolve.phases.map((p) => {
    const stepMs = p.recognitionMs + p.executionMs
    cumMs += stepMs
    const moveStart = cumTurns
    cumTurns += p.turns
    return { ...p, stepMs, cumMs, moveStart, moves: localSolve.moves.slice(moveStart, cumTurns) }
  })

  function copySteps() {
    const moveStr = (m: PositionMove) => m.face + (m.direction === 'CCW' ? "'" : '')
    const lines = [`Scramble: ${localSolve.scramble}`, '']
    for (const row of tableRows) {
      const moves = row.moves.length > 0 ? row.moves.map(moveStr).join(' ') : '—'
      lines.push(`${row.label}: ${moves}`)
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedSteps(true)
    setTimeout(() => setCopiedSteps(false), 1500)
  }

  function copyAsExample() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, isExample: _ie, ...data } = localSolve
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopiedExample(true)
    setTimeout(() => setCopiedExample(false), 1500)
  }

  async function handleShare() {
    if (!onShare || shareState !== 'idle') return
    setShareState('sharing')
    let shareId: string | undefined
    try {
      shareId = await onShare(localSolve)
      logSolveShared(localSolve.method ?? 'cfop')
    } catch (e) {
      console.error('[share] onShare failed:', e)
      setShareState('idle')
      setShareError('Share failed — please try again.')
      setTimeout(() => setShareError(null), 4000)
      return
    }
    const updated = { ...localSolve, shareId }
    setLocalSolve(updated)
    try {
      await onUpdate(updated)
    } catch (e) {
      console.error('[share] onUpdate failed:', e)
    } finally {
      setShareState('idle')
    }
  }

  async function handleUnshare() {
    if (!onUnshare || !localSolve.shareId || shareState !== 'idle') return
    setShareState('unsharing')
    try {
      await onUnshare(localSolve.shareId)
      const updated = { ...localSolve, shareId: undefined }
      setLocalSolve(updated)
      await onUpdate(updated)
    } catch {
      setShareError('Could not remove share — please try again.')
      setTimeout(() => setShareError(null), 4000)
    } finally {
      setShareState('idle')
    }
  }

  async function handleMethodChange(newMethod: SolveMethod) {
    if (saving) return
    const newPhases = recomputePhases(localSolve, newMethod)
    if (newPhases === null) {
      setMethodError('Could not recompute phases — solve record appears incomplete.')
      setTimeout(() => setMethodError(null), 4000)
      return
    }
    const previousSolve = localSolve
    const updated = { ...localSolve, method: newMethod.id, phases: newPhases }
    setLocalSolve(updated)
    setSaving(true)
    try {
      const saveTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([onUpdate(updated), saveTimeout])
      setSavedConfirmation(true)
      setTimeout(() => setSavedConfirmation(false), 2000)
    } catch {
      setMethodError('Failed to save — please try again.')
      setTimeout(() => setMethodError(null), 4000)
      setLocalSolve(previousSolve)
    } finally {
      setSaving(false)
    }
  }

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

  const totalRecMs = localSolve.phases.reduce((s, p) => s + p.recognitionMs, 0)
  const recPct = totalMs > 0 ? ((totalRecMs / totalMs) * 100).toFixed(0) : '0'
  const execPct = totalMs > 0 ? ((totalExecMs / totalMs) * 100).toFixed(0) : '0'

  const shareUrl = localSolve.shareId
    ? `${window.location.origin}${window.location.pathname}#shared-${localSolve.shareId}`
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 'bold', fontSize: 16 }}>
              {localSolve.isExample ? 'Example Solve' : `Solve #${localSolve?.seq ?? localSolve.id}`}
            </span>
            {localSolve.importedFrom && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                background: '#1a2a3a',
                border: '1px solid #2a4a6a',
                borderRadius: 10,
                color: '#6ab0e8',
                fontSize: 10,
                fontWeight: 'normal',
              }}>
                Imported from {localSolve.importedFrom.source}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {localSolve.isExample && (
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

        {showMigrationWarning && !readOnly && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#2a1a00', border: '1px solid #e8a02066', borderRadius: 4, fontSize: 11, color: '#e8a020' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>Phase analysis may be inaccurate — this solve was recorded before M/E/S tracking was fixed.</span>
              <div style={{ display: 'flex', gap: 6 }}>
              {!readOnly && (
                <button
                  disabled={migratingToV2}
                  onClick={async () => {
                    setMigratingToV2(true)
                    setMigrateToV2Error(null)
                    try {
                      const result = migrateSolveV1toV2(localSolve)
                      if ((result.schemaVersion ?? 1) >= 2) {
                        setLocalSolve(result)
                        await onUpdate(result)
                      } else {
                        setMigrateToV2Error('Migration failed — cube not solved after correction.')
                      }
                    } catch (e) {
                      setMigrateToV2Error(e instanceof Error ? e.message : 'Unknown error')
                    } finally {
                      setMigratingToV2(false)
                    }
                  }}
                  style={{ flexShrink: 0, background: '#3a2a00', border: '1px solid #e8a02066', borderRadius: 3, color: '#e8a020', fontSize: 10, padding: '2px 8px', cursor: migratingToV2 ? 'default' : 'pointer' }}
                >
                  {migratingToV2 ? 'Migrating...' : 'Migrate to v2'}
                </button>
              )}
              <button
                onClick={() => {
                  const wca = (face: string, dir: string) => dir === 'CCW' ? `${face}'` : face
                  const logs: string[] = []
                  const origWarn = console.warn
                  console.warn = (...args: unknown[]) => {
                    logs.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
                    origWarn(...args)
                  }
                  let result: ReturnType<typeof migrateSolveV1toV2>
                  try { result = migrateSolveV1toV2(localSolve) } finally { console.warn = origWarn }
                  const migrationSucceeded = (result!.schemaVersion ?? 1) >= 2
                  const phaseStatus = migrationSucceeded
                    ? (result!.migrationNote
                        ? `⚠ Phase differences after migration:\n${result!.migrationNote}`
                        : '✓ No phase differences — phases match exactly after correction.')
                    : null
                  logs.unshift([
                    migrationSucceeded
                      ? '✓ Migration would SUCCEED — cube solved after correction.'
                      : '✗ Migration would FAIL — corrected moves do not solve the cube.',
                    phaseStatus,
                  ].filter(Boolean).join('\n'))

                  const corrected = correctMovesV1toV2(localSolve)
                  const changedCount = corrected.filter((m, i) => m.face !== localSolve.moves[i].face).length
                  logs.push(`\nFull move list (${localSolve.moves.length} moves, ${changedCount} labels changed — * marks changes):`)
                  logs.push(`${'#'.padStart(4)}  ${'serial'.padEnd(7)}  ${'v1'.padEnd(4)}  ${'v2'.padEnd(4)}`)
                  logs.push('─'.repeat(28))

                  // Build phase boundary map: move index → phase label
                  const phaseStarts = new Map<number, string>()
                  let cum = 0
                  for (const ph of localSolve.phases) {
                    phaseStarts.set(cum, ph.label)
                    cum += ph.turns
                  }

                  localSolve.moves.forEach((orig, i) => {
                    if (phaseStarts.has(i)) {
                      const label = phaseStarts.get(i)!
                      logs.push(`====== ${label} ${'='.repeat(Math.max(0, 20 - label.length))}`)
                    }
                    const corr = corrected[i]
                    const changed = corr.face !== orig.face
                    const v1 = wca(orig.face, orig.direction)
                    const v2 = wca(corr.face, corr.direction)
                    const marker = changed ? '*' : ' '
                    logs.push(`${marker}${String(i).padStart(3)}  ${String(orig.serial).padEnd(7)}  ${v1.padEnd(4)}  ${v2.padEnd(4)}`)
                  })

                  setMigrationDebugLog(logs.length > 0 ? logs : ['(no warnings — migration may have succeeded or fast-pathed)'])
                }}
                style={{ flexShrink: 0, background: '#3a2a00', border: '1px solid #e8a02066', borderRadius: 3, color: '#e8a020', fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}
              >
                Debug migration
              </button>
              </div>
            </div>
            {migrateToV2Error && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#e94560' }}>{migrateToV2Error}</div>
            )}
            {migrationDebugLog && (
              <pre style={{ marginTop: 8, marginBottom: 0, fontSize: 10, color: '#ffcc66', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#1a1000', padding: 6, borderRadius: 3 }}>
                {migrationDebugLog.join('\n')}
              </pre>
            )}
          </div>
        )}

        {showMigrationWarning && readOnly && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#2a1a00', border: '1px solid #e8a02066', borderRadius: 4, fontSize: 11, color: '#e8a020' }}>
            Phase analysis may be inaccurate — this solve was recorded before M/E/S move tracking was introduced.
          </div>
        )}

        {showSchemaVersionBump && !readOnly && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#001a2a', border: '1px solid #2080e066', borderRadius: 4, fontSize: 11, color: '#60b8ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>This solve predates schema versioning. No move corrections needed — just a version stamp.</span>
              <button
                onClick={async () => {
                  const updated = { ...localSolve, schemaVersion: 2 }
                  setLocalSolve(updated)
                  await onUpdate(updated)
                }}
                style={{ flexShrink: 0, background: '#002040', border: '1px solid #2080e066', borderRadius: 3, color: '#60b8ff', fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}
              >
                Stamp v2
              </button>
            </div>
          </div>
        )}

        {localSolve.migrationNote && !readOnly && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#001a2a', border: '1px solid #2080e066', borderRadius: 4, fontSize: 11, color: '#60b8ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Migration note — phases changed during v1→v2 migration:</span>
              <button
                onClick={async () => {
                  const { movesV1: _, migrationNote: __, ...rest } = localSolve
                  const updated = rest as typeof localSolve
                  setLocalSolve(updated)
                  await onUpdate(updated)
                }}
                style={{ flexShrink: 0, background: '#002040', border: '1px solid #2080e066', borderRadius: 3, color: '#60b8ff', fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}
              >
                Mark reviewed
              </button>
            </div>
            <pre style={{ margin: 0, fontSize: 10, color: '#a0d4ff', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#001020', padding: 6, borderRadius: 3 }}>
              {localSolve.migrationNote}
            </pre>
          </div>
        )}

        {/* General statistics */}
        <div className="solve-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Time', value: formatTime(localSolve.timeMs) },
            { label: 'Turns', value: String(totalTurns) },
            { label: 'TPS', value: tps.toFixed(2) },
            { label: 'Date', value: formatDate(localSolve.date) },
            { label: 'Driver', value: localSolve.driver === 'cube' ? 'Cube' : localSolve.driver === 'mouse' ? 'Mouse' : '—' },
            { label: 'Method', value: method.label },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, background: '#161626', borderRadius: 4, padding: '8px 12px' }}>
              <div className="stat-label" style={{ color: '#666', fontSize: 11 }}>{label}</div>
              <div className="stat-value" style={{ fontWeight: 'bold', fontSize: 15 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Scramble row */}
        <div className="solve-scramble" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#161626', borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{localSolve.scramble}</span>
          <button
            onClick={() => navigator.clipboard.writeText(localSolve.scramble)}
            style={{ padding: '4px 8px', fontSize: 11 }}
            title="Copy scramble"
          >📋</button>
          <button
            onClick={copySteps}
            style={{ padding: '4px 10px', fontSize: 11, background: copiedSteps ? '#27ae60' : '#2980b9', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'background 0.2s' }}
          >
            {copiedSteps ? 'Copied!' : 'Copy steps'}
          </button>
          {onUseScramble && (
            <button
              onClick={() => { onUseScramble(localSolve.scramble); onClose() }}
              style={{ padding: '4px 10px', fontSize: 11, background: '#2ecc71', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Use this scramble
            </button>
          )}
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
            <div style={{ position: 'relative' }}>
              <CubeCanvas
                facelets={computeFaceletsAtIndex(scrambledFacelets, localSolve.moves, currentIndex)}
                quaternion={IDENTITY_QUATERNION}
                interactive
                onRendererReady={(r) => {
                  rendererRef.current = r
                  if (!localSolve.moves.some((m) => m.quaternion) || !gyroEnabled) {
                    r.setCameraPosition(4.5, 5, 5.5)
                  }
                }}
                onOrbit={() => setOrbitChanged(true)}
              />
              {orbitChanged && (
                <button
                  onClick={() => {
                    rendererRef.current?.resetOrientation()
                    setOrbitChanged(false)
                  }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 11, padding: '2px 7px',
                    background: 'rgba(0,0,0,0.5)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Reset view
                </button>
              )}
            </div>
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
              {getPhaseLabelAtIndex(localSolve, currentIndex)} — {formatTime(indicatorMs)} / {formatTime(totalMs)}
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="analysis-section" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Detailed Analysis</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <MethodSelector method={method} onChange={handleMethodChange} disabled={saving || !!readOnly} />
                {!readOnly && savedConfirmation && <span style={{ color: '#4c4', fontSize: 11 }}>Saved ✓</span>}
                {!readOnly && methodError && <span style={{ color: '#e74c3c', fontSize: 11 }}>{methodError}</span>}
              </div>
            </div>
            <div ref={phaseBarRef} className="analysis-phasebar">
              <PhaseBar
                phaseRecords={localSolve.phases}
                method={method}
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
                          <td colSpan={6} style={{ padding: '4px 8px 8px 20px', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {row.moves.length > 0
                              ? row.moves.map((m, mi) => {
                                  const isCurrentMove = isActive && mi === activeMoveInPhase
                                  const isCancelled = cancelledIndices.has(row.moveStart + mi)
                                  return (
                                    <span
                                      key={mi}
                                      onClick={() => {
                                        const globalIdx = row.moveStart + mi
                                        rendererRef.current?.animateMove(localSolve.moves[globalIdx].face, localSolve.moves[globalIdx].direction, 150)
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

        {/* Migration review section — shown when movesV1 is present */}
        {localSolve.movesV1 && (
          <div style={{ marginTop: 20, padding: 12, background: '#1a1a2a', border: '1px solid #e8a02055', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: '#e8a020', fontSize: 12, fontWeight: 'bold' }}>Migration Review</span>
              {!readOnly && (
                <button
                  disabled={reviewingMigration}
                  onClick={async () => {
                    setReviewingMigration(true)
                    const { movesV1: _, migrationNote: __, ...rest } = localSolve
                    const updated = rest as typeof localSolve
                    setLocalSolve(updated)
                    try {
                      await onUpdate(updated)
                    } catch {
                      setLocalSolve(localSolve)
                    } finally {
                      setReviewingMigration(false)
                    }
                  }}
                  style={{ padding: '2px 10px', fontSize: 11, background: 'transparent', color: '#4c4', border: '1px solid #4c4', borderRadius: 3, cursor: reviewingMigration ? 'default' : 'pointer' }}
                >
                  {reviewingMigration ? 'Saving...' : 'Mark as reviewed'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
              Face labels corrected for M/E/S center drift. Only changed moves shown.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ color: '#555' }}>
                  <td style={{ padding: '2px 4px' }}>#</td>
                  <td style={{ padding: '2px 4px' }}>Old</td>
                  <td style={{ padding: '2px 8px' }}>New</td>
                </tr>
              </thead>
              <tbody>
                {localSolve.moves.map((m, i) => {
                  const old = localSolve.movesV1![i]
                  if (!old || (old.face === m.face && old.direction === m.direction)) return null
                  const fmt = (mv: typeof m) => mv.face + (mv.direction === 'CCW' ? "'" : '')
                  return (
                    <tr key={i}>
                      <td style={{ padding: '1px 4px', color: '#555' }}>{i + 1}</td>
                      <td style={{ padding: '1px 4px', color: '#e94560' }}>{fmt(old)}</td>
                      <td style={{ padding: '1px 8px', color: '#4caf7d' }}>{fmt(m)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        {!readOnly && (
          <div className="solve-detail-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Share row — only shown when onShare is provided */}
            {onShare && (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {shareUrl ? (
                  <>
                    <input
                      readOnly
                      value={shareUrl}
                      style={{
                        flex: 1, padding: '5px 8px', fontSize: 11,
                        background: '#161626', border: '1px solid #333',
                        borderRadius: 4, color: '#aaa', fontFamily: 'monospace',
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl)
                        setShareCopied(true)
                        setTimeout(() => setShareCopied(false), 1500)
                      }}
                      style={{
                        padding: '5px 10px', fontSize: 11,
                        background: shareCopied ? '#27ae60' : '#2980b9',
                        color: '#fff', border: 'none', borderRadius: 4,
                        cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                      }}
                    >
                      {shareCopied ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={handleUnshare}
                      disabled={shareState !== 'idle'}
                      style={{
                        padding: '5px 10px', fontSize: 11,
                        background: shareState === 'unsharing' ? '#555' : '#7f8c8d',
                        color: '#fff', border: 'none', borderRadius: 4,
                        cursor: shareState !== 'idle' ? 'not-allowed' : 'pointer', flexShrink: 0,
                      }}
                    >
                      {shareState === 'unsharing' ? 'Removing…' : 'Unshare'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleShare}
                    disabled={shareState !== 'idle'}
                    style={{
                      padding: '5px 12px', fontSize: 11,
                      background: shareState === 'sharing' ? '#555' : '#2980b9',
                      color: '#fff', border: 'none', borderRadius: 4,
                      cursor: shareState !== 'idle' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {shareState === 'sharing' ? 'Sharing…' : 'Share'}
                  </button>
                )}
              </div>
              {shareError && (
                <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 2 }}>{shareError}</div>
              )}
              </>
            )}

            {/* Delete / confirm-delete row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {confirmDelete ? (
                <>
                  <span style={{ color: '#e74c3c', fontSize: 12, marginRight: 8, alignSelf: 'center' }}>
                    Delete this solve?
                  </span>
                  <button onClick={() => onDelete(localSolve.id)} style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {!localSolve.isExample && (
                    <button
                      onClick={copyAsExample}
                      style={{ padding: '6px 14px', background: copiedExample ? '#27ae60' : '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 8, transition: 'background 0.2s' }}
                      title="Copy solve JSON for use as an example solve in exampleSolves.ts"
                    >
                      {copiedExample ? 'Copied!' : 'Copy as example'}
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving || shareState !== 'idle'}
                    style={{ padding: '6px 14px', background: (saving || shareState !== 'idle') ? '#555' : '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: (saving || shareState !== 'idle') ? 'not-allowed' : 'pointer' }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

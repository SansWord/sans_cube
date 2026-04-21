import { useCallback, useRef, useState } from 'react'
import type { SolveRecord, SolveFilter } from '../types/solve'
import { formatSeconds } from '../utils/formatting'
import { getMethod } from '../methods/index'
import { computeStats, filterSolves, type StatEntry, type SolveStats } from '../utils/solveStats'
import { buildCopySolveList } from '../utils/copySolveList'

function migrationColor(s: SolveRecord): string | undefined {
  if ((s.schemaVersion ?? 1) < 2) {
    return s.moves.some(m => m.face === 'M' || m.face === 'E' || m.face === 'S') ? '#e8a020' : '#60b8ff'
  }
  if (s.migrationNote) return '#60b8ff'
  return undefined
}

interface Props {
  solves: SolveRecord[]
  onSelectSolve: (solve: SolveRecord) => void
  width: number
  onWidthChange: (w: number) => void
  onClose?: () => void
  cloudLoading?: boolean
  solveFilter: SolveFilter
  updateSolveFilter: (updater: (f: SolveFilter) => SolveFilter) => void
  onOpenTrends?: () => void
}

const MIN_WIDTH = 220
const MAX_WIDTH = 320
const DEFAULT_WIDTH = 220

function calcFontSize(width: number): number {
  const t = (width - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)
  return Math.round(11 + t * 5)
}

function fmtTps(solve: SolveRecord): string {
  const secs = solve.timeMs / 1000
  if (secs === 0) return '—'
  return (solve.moves.length / secs).toFixed(2)
}

const filterSelectStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #333',
  color: '#888',
  fontSize: 11,
  padding: '1px 4px',
  borderRadius: 3,
  cursor: 'pointer',
}

function StatsSection({ solves, solveFilter, updateSolveFilter, onOpenTrends, cloudLoading, fontSize }: {
  solves: SolveRecord[]
  solveFilter: SolveFilter
  updateSolveFilter: (updater: (f: SolveFilter) => SolveFilter) => void
  onOpenTrends?: () => void
  cloudLoading?: boolean
  fontSize?: number
}) {
  const statsPool = filterSolves(solves, solveFilter).filter(s => !s.isExample)
  const stats: SolveStats = computeStats(statsPool)
  const rows: Array<{ label: string; entry: StatEntry }> = [
    { label: 'Single', entry: stats.single },
    { label: 'Ao5', entry: stats.ao5 },
    { label: 'Ao12', entry: stats.ao12 },
    { label: 'Ao100', entry: stats.ao100 },
  ]
  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontWeight: 'bold', color: '#888' }}>Statistics</span>
          {onOpenTrends && (
            <button
              onClick={onOpenTrends}
              disabled={cloudLoading}
              style={{
                background: 'transparent',
                border: '1px solid #333',
                color: cloudLoading ? '#444' : '#888',
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 3,
                cursor: cloudLoading ? 'not-allowed' : 'pointer',
                opacity: cloudLoading ? 0.5 : 1,
              }}
            >
              Trends
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#555', fontSize: 10 }}>Method</span>
            <select
              value={solveFilter.method}
              onChange={e => updateSolveFilter(f => ({ ...f, method: e.target.value as SolveFilter['method'] }))}
              disabled={cloudLoading}
              style={{
                ...filterSelectStyle,
                cursor: cloudLoading ? 'not-allowed' : 'pointer',
                opacity: cloudLoading ? 0.5 : 1,
              }}
            >
              <option value="all">All</option>
              <option value="cfop">CFOP</option>
              <option value="roux">Roux</option>
              <option value="freeform">Freeform</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#555', fontSize: 10 }}>Driver</span>
            <select
              value={solveFilter.driver}
              onChange={e => updateSolveFilter(f => ({ ...f, driver: e.target.value as SolveFilter['driver'] }))}
              disabled={cloudLoading}
              style={{
                ...filterSelectStyle,
                cursor: cloudLoading ? 'not-allowed' : 'pointer',
                opacity: cloudLoading ? 0.5 : 1,
              }}
            >
              <option value="all">All</option>
              <option value="cube">Cube</option>
              <option value="mouse">Mouse</option>
            </select>
          </div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#555', fontSize: fontSize ? fontSize - 2 : 11 }}>
            <td></td>
            <td style={{ textAlign: 'right' }}>Current</td>
            <td style={{ textAlign: 'right' }}>Best</td>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, entry }) => (
            <tr key={label}>
              <td style={{ color: '#888' }}>{label}</td>
              <td style={{ textAlign: 'right' }}>{formatSeconds(entry.current)}</td>
              <td style={{ textAlign: 'right', color: '#2ecc71' }}>{formatSeconds(entry.best)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function CopyButton({ solves, disabled }: { solves: SolveRecord[]; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      disabled={disabled || copied}
      onClick={() => {
        navigator.clipboard.writeText(buildCopySolveList(solves)).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      style={{
        background: 'transparent',
        border: '1px solid #444',
        color: disabled ? '#444' : copied ? '#2ecc71' : '#aaa',
        fontSize: 11,
        cursor: disabled ? 'default' : 'pointer',
        padding: '1px 6px',
        borderRadius: 3,
        lineHeight: 1.4,
        flexShrink: 0,
      }}
      title="Copy solve list"
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  )
}

export function SolveHistorySidebar({ solves, onSelectSolve, width, onWidthChange, onClose, cloudLoading, solveFilter, updateSolveFilter, onOpenTrends }: Props) {
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_WIDTH)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    e.preventDefault()

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - startX.current
      onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)))
    }
    const onMouseUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [width, onWidthChange])

  const filteredSolves = filterSolves(solves, solveFilter)
  const reversedSolves = [...filteredSolves].reverse()

  // Overlay mode (mobile): full-screen fixed panel
  if (onClose) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0a0a1a', display: 'flex', flexDirection: 'column', fontSize: 13, color: '#ccc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #222', flexShrink: 0 }}>
          <span style={{ fontWeight: 'bold', color: '#888' }}>Solves</span>
          <button onClick={onClose} style={{ background: 'transparent', color: '#e94560', fontSize: 18, padding: '0 4px', border: 'none' }}>✕</button>
        </div>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #222', flexShrink: 0 }}>
          <StatsSection solves={solves} solveFilter={solveFilter} updateSolveFilter={updateSolveFilter} onOpenTrends={onOpenTrends} cloudLoading={cloudLoading} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 2px', flexShrink: 0 }}>
          <span style={{ color: '#555', fontSize: 11 }}>Last Solves</span>
          <CopyButton solves={reversedSolves} disabled={cloudLoading} />
        </div>
        {cloudLoading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #333', borderTopColor: '#888', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#555', fontSize: 13 }}>Loading…</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0a0a1a', zIndex: 1 }}>
                <tr style={{ color: '#555', fontSize: 11 }}>
                  <td style={{ padding: '2px 12px' }}>#</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px' }}>TPS</td>
                  <td style={{ textAlign: 'right', padding: '2px 12px' }}>Method</td>
                </tr>
              </thead>
              <tbody>
                {reversedSolves.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onSelectSolve(s)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '3px 12px', color: s.shareId ? '#4caf7d' : '#555' }}>
                      {s.isExample ? '★' : (s.seq ?? s.id)}
                      {s.movesV1 && (
                        <span
                          title="Migrated to v2 — tap to review move corrections"
                          style={{ marginLeft: 4, display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#e8a020', verticalAlign: 'middle' }}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', color: migrationColor(s) }}>{formatSeconds(s.timeMs)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', color: '#888' }}>{fmtTps(s)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 12px', color: '#555', fontSize: 11 }}>{getMethod(s.method).label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // Sidebar mode (desktop): existing layout
  const fontSize = calcFontSize(width)

  return (
    <div className="sidebar-wrapper" style={{ display: 'flex', flexShrink: 0, position: 'relative', height: '100%' }}>
      <div style={{
        width,
        height: '100%',
        background: '#0a0a1a',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        fontSize,
        color: '#ccc',
      }}>
        <div style={{ padding: '10px 8px', borderBottom: '1px solid #222', flexShrink: 0 }}>
          <StatsSection solves={solves} solveFilter={solveFilter} updateSolveFilter={updateSolveFilter} onOpenTrends={onOpenTrends} cloudLoading={cloudLoading} fontSize={fontSize} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 2px', flexShrink: 0 }}>
          <span style={{ color: '#555', fontSize: fontSize - 2 }}>Last Solves</span>
          <CopyButton solves={reversedSolves} disabled={cloudLoading} />
        </div>
        {cloudLoading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #333', borderTopColor: '#888', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#555', fontSize: 13 }}>Loading…</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0a0a1a', zIndex: 1 }}>
                <tr style={{ color: '#555', fontSize: fontSize - 2 }}>
                  <td style={{ padding: '2px 8px' }}>#</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px' }}>TPS</td>
                  <td style={{ textAlign: 'right', padding: '2px 8px' }}>Method</td>
                </tr>
              </thead>
              <tbody>
                {reversedSolves.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onSelectSolve(s)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#111')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '3px 8px', color: s.shareId ? '#4caf7d' : '#555' }}>
                      {s.isExample ? '★' : (s.seq ?? s.id)}
                      {s.movesV1 && (
                        <span
                          title="Migrated to v2 — tap to review move corrections"
                          style={{ marginLeft: 4, display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#e8a020', verticalAlign: 'middle' }}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', color: migrationColor(s) }}>{formatSeconds(s.timeMs)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 4px', color: '#888' }}>{fmtTps(s)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 8px', color: '#555', fontSize: fontSize - 2 }}>{getMethod(s.method).label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          right: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 10,
        }}
      />
    </div>
  )
}

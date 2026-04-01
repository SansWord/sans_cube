import { useCallback, useRef } from 'react'
import type { SolveRecord } from '../types/solve'

interface StatEntry {
  current: number | null
  best: number | null
}

interface SolveStats {
  single: StatEntry
  ao5: StatEntry
  ao12: StatEntry
  ao100: StatEntry
}

interface Props {
  solves: SolveRecord[]
  stats: SolveStats
  onSelectSolve: (solve: SolveRecord) => void
  width: number
  onWidthChange: (w: number) => void
}

const MIN_WIDTH = 120
const MAX_WIDTH = 320
const DEFAULT_WIDTH = 160
// Font scales linearly from base 11px at min width to 16px at max width
function calcFontSize(width: number): number {
  const t = (width - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)
  return Math.round(11 + t * 5)
}

function fmtTime(ms: number | null): string {
  if (ms === null) return '—'
  return (ms / 1000).toFixed(2)
}

function fmtTps(solve: SolveRecord): string {
  const secs = solve.timeMs / 1000
  if (secs === 0) return '—'
  return (solve.moves.length / secs).toFixed(2)
}

export function SolveHistorySidebar({ solves, stats, onSelectSolve, width, onWidthChange }: Props) {
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
  }, [width])

  const fontSize = calcFontSize(width)
  const rows: Array<{ label: string; entry: StatEntry }> = [
    { label: 'Single', entry: stats.single },
    { label: 'Ao5', entry: stats.ao5 },
    { label: 'Ao12', entry: stats.ao12 },
    { label: 'Ao100', entry: stats.ao100 },
  ]
  const reversedSolves = [...solves].reverse()

  return (
    <div style={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
      <div style={{
        width,
        background: '#0a0a1a',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        fontSize,
        color: '#ccc',
      }}>
        {/* Statistics */}
        <div style={{ padding: '10px 8px', borderBottom: '1px solid #222' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#888' }}>Statistics</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#555', fontSize: fontSize - 2 }}>
                <td></td>
                <td style={{ textAlign: 'right' }}>Current</td>
                <td style={{ textAlign: 'right' }}>Best</td>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, entry }) => (
                <tr key={label}>
                  <td style={{ color: '#888' }}>{label}</td>
                  <td style={{ textAlign: 'right' }}>{fmtTime(entry.current)}</td>
                  <td style={{ textAlign: 'right', color: '#2ecc71' }}>{fmtTime(entry.best)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Solve list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          <div style={{ color: '#555', fontSize: fontSize - 2, padding: '0 8px 4px' }}>Last Solves</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#555', fontSize: fontSize - 2 }}>
                <td style={{ padding: '2px 8px' }}>#</td>
                <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
                <td style={{ textAlign: 'right', padding: '2px 8px' }}>TPS</td>
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
                  <td style={{ padding: '3px 8px', color: '#555' }}>{s.id}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{fmtTime(s.timeMs)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 8px', color: '#888' }}>{fmtTps(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drag handle */}
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

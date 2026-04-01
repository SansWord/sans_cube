import { useState } from 'react'
import type { PhaseRecord } from '../types/solve'
import type { SolveMethod } from '../types/solve'

interface Props {
  phaseRecords: PhaseRecord[]
  method: SolveMethod
  interactive?: boolean
}

function fmt(ms: number): string {
  return (ms / 1000).toFixed(2) + 's'
}

function fmtTps(turns: number, ms: number): string {
  if (ms === 0) return '—'
  return (turns / (ms / 1000)).toFixed(2)
}

export function PhaseBar({ phaseRecords, method, interactive = true }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  if (phaseRecords.length === 0) {
    // Show empty placeholder bar
    return (
      <div style={{ height: 24, background: '#222', borderRadius: 4, marginTop: 8 }} />
    )
  }

  const totalMs = phaseRecords.reduce((s, p) => s + p.recognitionMs + p.executionMs, 0)

  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      {/* Bar */}
      <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
        {phaseRecords.map((p, i) => {
          const stepMs = p.recognitionMs + p.executionMs
          const pct = totalMs > 0 ? (stepMs / totalMs) * 100 : 0
          const color = method.phases[i]?.color ?? '#555'
          const recPct = stepMs > 0 ? (p.recognitionMs / stepMs) * 100 : 0
          const execPct = 100 - recPct
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                display: 'flex',
                cursor: interactive ? 'pointer' : 'default',
                opacity: hoveredIndex === i ? 0.8 : 1,
                transition: 'opacity 0.1s',
              }}
              onMouseEnter={() => interactive && setHoveredIndex(i)}
              onMouseLeave={() => interactive && setHoveredIndex(null)}
              onMouseMove={(e) => interactive && setMousePos({ x: e.clientX, y: e.clientY })}
            >
              {recPct > 0 && (
                <div style={{ width: `${recPct}%`, background: color, opacity: 0.45 }} />
              )}
              <div style={{ width: `${execPct}%`, background: color }} />
            </div>
          )
        })}
      </div>

      {/* Labels row */}
      <div style={{ display: 'flex' }}>
        {phaseRecords.map((p, i) => {
          const stepMs = p.recognitionMs + p.executionMs
          const pct = totalMs > 0 ? (stepMs / totalMs) * 100 : 0
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                fontSize: 10,
                color: '#888',
                textAlign: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {fmt(stepMs)}
            </div>
          )
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredIndex !== null && (() => {
        const p = phaseRecords[hoveredIndex]
        const stepMs = p.recognitionMs + p.executionMs
        const pct = ((stepMs / totalMs) * 100).toFixed(1)

        // F2L group totals
        const isF2L = p.group === 'F2L'
        const f2lPhases = isF2L ? phaseRecords.filter((x) => x.group === 'F2L') : []
        const f2lTotalMs = f2lPhases.reduce((s, x) => s + x.recognitionMs + x.executionMs, 0)
        const f2lTotalRec = f2lPhases.reduce((s, x) => s + x.recognitionMs, 0)
        const f2lTotalExec = f2lPhases.reduce((s, x) => s + x.executionMs, 0)
        const f2lTurns = f2lPhases.reduce((s, x) => s + x.turns, 0)
        const f2lPct = totalMs > 0 ? ((f2lTotalMs / totalMs) * 100).toFixed(1) : '0'

        return (
          <div style={{
            position: 'fixed',
            top: mousePos.y + 12,
            left: Math.min(mousePos.x + 12, window.innerWidth - 224),
            background: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '10px 14px',
            zIndex: 10,
            minWidth: 200,
            fontSize: 12,
            color: '#ccc',
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{p.label}</div>
            <div>Total Time: {fmt(stepMs)}</div>
            <div>Recognition: {p.label === 'Cross' ? '—' : fmt(p.recognitionMs)}</div>
            <div>Execution: {fmt(p.executionMs)}</div>
            <div>TPS: {fmtTps(p.turns, stepMs)}</div>
            <div>True TPS: {fmtTps(p.turns, p.executionMs)}</div>
            <div>Turns: {p.turns}</div>
            <div>Percentage: {pct}%</div>
            {isF2L && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0' }} />
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>F2L Totals</div>
                <div>Total Time: {fmt(f2lTotalMs)}</div>
                <div>Total Recognition: {fmt(f2lTotalRec)}</div>
                <div>Total Execution: {fmt(f2lTotalExec)}</div>
                <div>Total TPS: {fmtTps(f2lTurns, f2lTotalMs)}</div>
                <div>Total True TPS: {fmtTps(f2lTurns, f2lTotalExec)}</div>
                <div>Total Turns: {f2lTurns}</div>
                <div>Percentage: {f2lPct}%</div>
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}

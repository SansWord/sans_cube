import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { PhaseRecord } from '../types/solve'
import type { SolveMethod } from '../types/solve'
import { formatTime, formatTps } from '../utils/formatting'

interface Props {
  phaseRecords: PhaseRecord[]
  method: SolveMethod
  interactive?: boolean
  indicatorPct?: number   // 0–100, shows a vertical playhead line
}

function calcPct(clientX: number, el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
}

function pctToPhaseIndex(pct: number, phaseRecords: PhaseRecord[], totalMs: number): number {
  let cumPct = 0
  for (let i = 0; i < phaseRecords.length; i++) {
    const stepMs = phaseRecords[i].recognitionMs + phaseRecords[i].executionMs
    cumPct += totalMs > 0 ? (stepMs / totalMs) * 100 : 0
    if (pct <= cumPct) return i
  }
  return phaseRecords.length - 1
}

export function PhaseBar({ phaseRecords, method, interactive = true, indicatorPct }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hoverPct, setHoverPct] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!interactive) return
    const handler = (e: TouchEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setHoveredIndex(null)
        setHoverPct(null)
      }
    }
    document.addEventListener('touchstart', handler, { passive: true })
    return () => document.removeEventListener('touchstart', handler)
  }, [interactive])

  if (phaseRecords.length === 0) {
    // Show empty placeholder bar
    return (
      <div style={{ height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 8 }} />
    )
  }

  const totalMs = phaseRecords.reduce((s, p) => s + p.recognitionMs + p.executionMs, 0)

  return (
    <div
      ref={barRef}
      data-testid="phase-bar-track"
      style={{ position: 'relative', width: '100%', maxWidth: 720, margin: '8px auto 0' }}
      onMouseMove={(e) => interactive && setHoverPct(calcPct(e.clientX, e.currentTarget))}
      onMouseLeave={() => interactive && setHoverPct(null)}
      onTouchMove={(e) => {
        if (!interactive) return
        const touch = e.touches[0]
        const pct = calcPct(touch.clientX, e.currentTarget)
        setHoverPct(pct)
        setHoveredIndex(pctToPhaseIndex(pct, phaseRecords, totalMs))
        setMousePos({ x: touch.clientX, y: touch.clientY })
      }}
      onTouchEnd={(e) => {
        if (!interactive) return
        // keep indicator and tooltip; update mousePos to final touch position
        const touch = e.changedTouches[0]
        if (touch) setMousePos({ x: touch.clientX, y: touch.clientY })
      }}
    >
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

      {/* Playhead indicator */}
      {indicatorPct !== undefined && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: `${indicatorPct}%`,
          width: 2,
          height: 24,
          background: '#fff',
          borderRadius: 1,
          pointerEvents: 'none',
          boxShadow: '0 0 4px rgba(0,0,0,0.6)',
          transform: 'translateX(-1px)',
        }} />
      )}

      {/* Hover indicator */}
      {hoverPct !== null && (
        <div
          data-testid="hover-indicator"
          style={{
            position: 'absolute',
            top: 0,
            left: `${hoverPct}%`,
            width: 2,
            height: 24,
            background: '#fff',
            borderRadius: 1,
            pointerEvents: 'none',
            boxShadow: '0 0 4px rgba(0,0,0,0.6)',
            transform: 'translateX(-1px)',
          }}
        />
      )}

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
              {formatTime(stepMs)}
            </div>
          )
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredIndex !== null && hoveredIndex < phaseRecords.length && (() => {
        const p = phaseRecords[hoveredIndex]
        const stepMs = p.recognitionMs + p.executionMs
        const pct = ((stepMs / totalMs) * 100).toFixed(1)

        // Group totals (F2L, OLL, PLL)
        const group = p.group
        const groupPhases = group ? phaseRecords.filter((x) => x.group === group) : []
        const groupTotalMs = groupPhases.reduce((s, x) => s + x.recognitionMs + x.executionMs, 0)
        const groupTotalRec = groupPhases.reduce((s, x) => s + x.recognitionMs, 0)
        const groupTotalExec = groupPhases.reduce((s, x) => s + x.executionMs, 0)
        const groupTurns = groupPhases.reduce((s, x) => s + x.turns, 0)
        const groupPct = totalMs > 0 ? ((groupTotalMs / totalMs) * 100).toFixed(1) : '0'

        const tooltipWidth = 220
        const flipLeft = mousePos.x + 12 + tooltipWidth > window.innerWidth
        const tooltipLeft = flipLeft ? mousePos.x - 12 - tooltipWidth : mousePos.x + 12

        return createPortal(
          <div style={{
            position: 'fixed',
            top: mousePos.y - 12,
            transform: 'translateY(-100%)',
            left: tooltipLeft,
            background: 'rgba(26, 26, 46, 0.75)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '10px 14px',
            zIndex: 10,
            width: tooltipWidth,
            fontSize: 12,
            color: '#ccc',
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{p.label}</div>
            <div>Total Time: {formatTime(stepMs)}</div>
            <div>Recognition: {p.label === 'Cross' ? '—' : formatTime(p.recognitionMs)}</div>
            <div>Execution: {formatTime(p.executionMs)}</div>
            <div>TPS: {formatTps(p.turns, stepMs)}</div>
            <div>True TPS: {formatTps(p.turns, p.executionMs)}</div>
            <div>Turns: {p.turns}</div>
            <div>Percentage: {pct}%</div>
            {group && groupPhases.length > 1 && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0' }} />
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{group} Totals</div>
                <div>Total Time: {formatTime(groupTotalMs)}</div>
                <div>Total Recognition: {formatTime(groupTotalRec)}</div>
                <div>Total Execution: {formatTime(groupTotalExec)}</div>
                <div>Total TPS: {formatTps(groupTurns, groupTotalMs)}</div>
                <div>Total True TPS: {formatTps(groupTurns, groupTotalExec)}</div>
                <div>Total Turns: {groupTurns}</div>
                <div>Percentage: {groupPct}%</div>
              </>
            )}
          </div>,
          document.body
        )
      })()}
    </div>
  )
}

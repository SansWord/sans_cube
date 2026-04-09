import { useState, useEffect, useRef } from 'react'
import {
  ComposedChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { SolveRecord, MethodFilter } from '../types/solve'
import { getMethod } from '../methods/index'
import { buildTotalData, buildPhaseData } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint } from '../utils/trends'
import { formatSeconds } from '../utils/formatting'

type Tab = 'total' | 'phases'
type WindowSize = 25 | 50 | 100 | 'all'
type TimeKey = 'exec' | 'recog' | 'total'
type TimeToggle = Record<TimeKey, boolean>

// Colors per time type for Total tab
const TYPE_COLORS: Record<TimeKey, { line: string; ao5: string; ao12: string }> = {
  exec:  { line: '#4fc3f7', ao5: '#0288d1', ao12: '#01579b' },
  recog: { line: '#a5d6a7', ao5: '#43a047', ao12: '#2e7d32' },
  total: { line: '#888',    ao5: '#e94560', ao12: '#3498db' },
}

interface Props {
  solves: SolveRecord[]
  methodFilter: MethodFilter
  setMethodFilter: (f: MethodFilter) => void
  onSelectSolve: (solve: SolveRecord) => void
  onClose: () => void
  detailOpen?: boolean
}

// ─── color helpers ────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b - r) / d + 2) / 6; break
    default: h = ((r - g) / d + 4) / 6; break
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const h1 = h / 360, s1 = s / 100, l1 = l / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    const tn = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }
  let r, g, b
  if (s1 === 0) {
    r = g = b = l1
  } else {
    const q = l1 < 0.5 ? l1 * (1 + s1) : l1 + s1 - l1 * s1
    const p = 2 * l1 - q
    r = hue2rgb(p, q, h1 + 1 / 3)
    g = hue2rgb(p, q, h1)
    b = hue2rgb(p, q, h1 - 1 / 3)
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseHashParams(): {
  tab: Tab
  windowSize: WindowSize
  grouped: boolean
  totalToggle: TimeToggle
  phaseTimeType: TimeKey
} {
  const hash = window.location.hash
  if (!hash.startsWith('#trends')) {
    return { tab: 'total', windowSize: 25, grouped: true, totalToggle: { exec: true, recog: false, total: false }, phaseTimeType: 'exec' }
  }
  const search = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(search)
  const tab: Tab = params.get('tab') === 'phases' ? 'phases' : 'total'
  const w = params.get('window')
  const windowSize: WindowSize = w === 'all' ? 'all' : w === '50' ? 50 : w === '100' ? 100 : 25
  const grouped: boolean = params.get('group') !== 'split'
  const ttRaw = params.get('ttotal') ?? 'exec'
  const activeSet = new Set(ttRaw.split(','))
  const totalToggle: TimeToggle = {
    exec: activeSet.has('exec'),
    recog: activeSet.has('recog'),
    total: activeSet.has('total'),
  }
  if (!totalToggle.exec && !totalToggle.recog && !totalToggle.total) {
    totalToggle.exec = true; totalToggle.recog = true; totalToggle.total = true
  }
  const ptRaw = params.get('tphase') ?? 'exec'
  const phaseTimeType: TimeKey = (['exec', 'recog', 'total'] as TimeKey[]).includes(ptRaw as TimeKey) ? ptRaw as TimeKey : 'exec'
  return { tab, windowSize, grouped, totalToggle, phaseTimeType }
}

function buildColorMap(
  methodFilter: MethodFilter,
  grouped: boolean,
): Record<string, string> {
  const method = getMethod(methodFilter === 'all' ? 'cfop' : methodFilter)

  if (grouped) {
    const map: Record<string, string> = {}
    for (const phase of method.phases) {
      const key = phase.group ?? phase.label
      if (!(key in map)) map[key] = phase.color
    }
    return map
  }

  // Split mode: generate lightness variants for sub-phases within the same group
  const groupLabels: Record<string, string[]> = {}
  for (const phase of method.phases) {
    const gk = phase.group ?? phase.label
    if (!groupLabels[gk]) groupLabels[gk] = []
    groupLabels[gk].push(phase.label)
  }

  const map: Record<string, string> = {}
  for (const phase of method.phases) {
    const gk = phase.group ?? phase.label
    const group = groupLabels[gk]
    if (group.length === 1 || !phase.group) {
      map[phase.label] = phase.color
    } else {
      const [h, s, l] = hexToHsl(phase.color)
      const idx = group.indexOf(phase.label)
      const n = group.length
      const range = 24  // total lightness spread in %
      const lNew = l - range / 2 + (range / (n - 1)) * idx
      map[phase.label] = hslToHex(h, s, Math.max(20, Math.min(80, lNew)))
    }
  }
  return map
}

function filterSolves(solves: SolveRecord[], methodFilter: MethodFilter): SolveRecord[] {
  if (methodFilter === 'all') return solves
  return solves.filter(s => s.isExample || (s.method ?? 'cfop') === methodFilter)
}

// ─── date helpers ────────────────────────────────────────────────────────────

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatMonthDay(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** Returns reference line positions for day boundaries in the visible data. */
function buildDayLines(
  visibleData: Array<{ seq: number; solveId: number }>,
  solveMap: Map<number, SolveRecord>,
): Array<{ x: number; label: string }> {
  if (visibleData.length === 0) return []

  const startOfDay = (ts: number) => {
    const d = new Date(ts)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }

  const lines: Array<{ x: number; label: string }> = []
  const firstSolve = solveMap.get(visibleData[0].solveId)
  if (!firstSolve) return []

  // Start boundary: labeled with the day of the first solve
  lines.push({ x: visibleData[0].seq - 0.5, label: formatMonthDay(firstSolve.date) })

  // Day-change boundaries
  let prevDay = startOfDay(firstSolve.date)
  for (let i = 1; i < visibleData.length; i++) {
    const solve = solveMap.get(visibleData[i].solveId)
    if (!solve) continue
    const day = startOfDay(solve.date)
    if (day !== prevDay) {
      lines.push({ x: visibleData[i].seq - 0.5, label: formatMonthDay(solve.date) })
      prevDay = day
    }
  }

  return lines
}

const btnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#333' : 'transparent',
  border: '1px solid #333',
  color: active ? '#ccc' : '#555',
  fontSize: 12,
  padding: '2px 8px',
  borderRadius: 3,
  cursor: 'pointer',
})

// ─── tooltips ────────────────────────────────────────────────────────────────

function TotalTooltip({
  active,
  payload,
  totalToggle,
  solveMap,
  hoveredSolveIdRef,
}: {
  active?: boolean
  payload?: Array<{ payload: TotalDataPoint }>
  totalToggle: TimeToggle
  solveMap: Map<number, SolveRecord>
  hoveredSolveIdRef: React.MutableRefObject<number | null>
}) {
  if (active && payload?.length) {
    hoveredSolveIdRef.current = payload[0].payload.solveId
  } else if (!active) {
    hoveredSolveIdRef.current = null
  }
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const solve = solveMap.get(d.solveId)
  const rows: Array<{ label: string; value: number; color: string }> = []
  if (totalToggle.exec) {
    rows.push({ label: 'Exec', value: d.exec, color: TYPE_COLORS.exec.line })
    if (d.execAo5 !== null) rows.push({ label: 'Ao5 (Exec)', value: d.execAo5, color: TYPE_COLORS.exec.ao5 })
    if (d.execAo12 !== null) rows.push({ label: 'Ao12 (Exec)', value: d.execAo12, color: TYPE_COLORS.exec.ao12 })
  }
  if (totalToggle.recog) {
    rows.push({ label: 'Recog', value: d.recog, color: TYPE_COLORS.recog.line })
    if (d.recogAo5 !== null) rows.push({ label: 'Ao5 (Recog)', value: d.recogAo5, color: TYPE_COLORS.recog.ao5 })
    if (d.recogAo12 !== null) rows.push({ label: 'Ao12 (Recog)', value: d.recogAo12, color: TYPE_COLORS.recog.ao12 })
  }
  if (totalToggle.total) {
    rows.push({ label: 'Total', value: d.total, color: TYPE_COLORS.total.line })
    if (d.totalAo5 !== null) rows.push({ label: 'Ao5 (Total)', value: d.totalAo5, color: TYPE_COLORS.total.ao5 })
    if (d.totalAo12 !== null) rows.push({ label: 'Ao12 (Total)', value: d.totalAo12, color: TYPE_COLORS.total.ao12 })
  }
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '6px 10px', fontSize: 12, color: '#ccc' }}>
      <div>Solve #{solve?.seq ?? d.seq}</div>
      {solve && <div style={{ color: '#666', fontSize: 11 }}>{formatDateTime(solve.date)}</div>}
      {rows.map(r => (
        <div key={r.label} style={{ color: r.color }}>{r.label}: {formatSeconds(r.value)}s</div>
      ))}
      <div style={{ color: '#555', marginTop: 4 }}>▶ tap to replay</div>
    </div>
  )
}

function PhaseTooltip({
  active,
  payload,
  solveMap,
  hoveredSolveIdRef,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload: PhaseDataPoint }>
  solveMap: Map<number, SolveRecord>
  hoveredSolveIdRef: React.MutableRefObject<number | null>
}) {
  if (active && payload?.length) {
    hoveredSolveIdRef.current = payload[0].payload.solveId as number
  } else if (!active) {
    hoveredSolveIdRef.current = null
  }
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  const solve = solveMap.get(pt.solveId as number)
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '6px 10px', fontSize: 12, color: '#ccc' }}>
      <div>Solve #{solve?.seq ?? pt.seq}</div>
      {solve && <div style={{ color: '#666', fontSize: 11 }}>{formatDateTime(solve.date)}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {formatSeconds(p.value)}s
        </div>
      ))}
      <div style={{ color: '#555', marginTop: 4 }}>▶ tap to replay</div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function TrendsModal({ solves, methodFilter, setMethodFilter, onSelectSolve, onClose, detailOpen }: Props) {
  const [isMobile] = useState(() => window.innerWidth < 640)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !detailOpen) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, detailOpen])
  const parsed = parseHashParams()
  const [tab, setTab] = useState<Tab>(parsed.tab)
  const [windowSize, setWindowSize] = useState<WindowSize>(isMobile ? 25 : parsed.windowSize)
  const [grouped, setGrouped] = useState(parsed.grouped)
  const [totalToggle, setTotalToggle] = useState<TimeToggle>({ exec: true, recog: true, total: true })
  const [phaseTimeType, setPhaseTimeType] = useState<TimeKey>(parsed.phaseTimeType)
  const [hiddenPhases, setHiddenPhases] = useState<Set<string>>(new Set())
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null)
  const [zoomStack, setZoomStack] = useState<Array<[number, number]>>([])

  const filtered = filterSolves(solves, methodFilter)
  const method = getMethod(methodFilter === 'all' ? 'cfop' : methodFilter)
  const hasGroups = method.phases.some(p => p.group)

  const currentDomain: [number, number] | null = zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : null

  const totalData = buildTotalData(filtered, windowSize)
  const phaseData = buildPhaseData(filtered, windowSize, phaseTimeType, grouped)

  const visibleTotalData = currentDomain
    ? totalData.filter(pt => pt.seq >= currentDomain[0] && pt.seq <= currentDomain[1])
    : totalData
  const visiblePhaseData = currentDomain
    ? phaseData.filter(pt => (pt.seq as number) >= currentDomain[0] && (pt.seq as number) <= currentDomain[1])
    : phaseData

  const solveMap = new Map(solves.map(s => [s.id, s]))

  const visibleSeqData = tab === 'total'
    ? visibleTotalData
    : visiblePhaseData.map(pt => ({ seq: pt.seq as number, solveId: pt.solveId as number }))
  const dayLines = buildDayLines(visibleSeqData, solveMap)

  const firstVisSeq = visibleSeqData[0]?.seq ?? 1
  const lastVisSeq = visibleSeqData[visibleSeqData.length - 1]?.seq ?? firstVisSeq
  const colorMap = buildColorMap(methodFilter, grouped)

  const phaseKeys = Array.from(
    phaseData.reduce((set, pt) => {
      Object.keys(pt).forEach(k => { if (k !== 'seq' && k !== 'solveId') set.add(k) })
      return set
    }, new Set<string>())
  )

  // Reset zoom when tab or window changes
  useEffect(() => {
    setZoomStack([])
    setRefAreaLeft(null)
    setRefAreaRight(null)
  }, [tab, windowSize])

  // Sync URL hash
  useEffect(() => {
    const activeTotalTypes = (Object.keys(totalToggle) as TimeKey[]).filter(k => totalToggle[k]).join(',') || 'exec'
    const params = new URLSearchParams({
      method: methodFilter,
      tab,
      window: String(windowSize),
      group: grouped ? 'grouped' : 'split',
      ttotal: activeTotalTypes,
      tphase: phaseTimeType,
    })
    window.location.hash = `trends?${params.toString()}`
  }, [methodFilter, tab, windowSize, grouped, totalToggle, phaseTimeType])

  const windowOptions: Array<{ label: string; value: WindowSize }> = [
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    ...(!isMobile ? [{ label: 'All', value: 'all' as const }] : []),
  ]

  const toggleTimeType = (key: TimeKey) => {
    setTotalToggle(prev => {
      const next = { ...prev, [key]: !prev[key] }
      // Ensure at least one is active
      if (!next.exec && !next.recog && !next.total) return prev
      return next
    })
  }

  const didZoomRef = useRef(false)
  const hoveredSolveIdRef = useRef<number | null>(null)

  const handleChartMouseDown = (e: { activeLabel?: string | number } | null) => {
    if (e?.activeLabel != null) {
      setRefAreaLeft(Number(e.activeLabel))
      didZoomRef.current = false
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartMouseMove = (e: any) => {
    if (refAreaLeft !== null && e?.activeLabel != null) {
      setRefAreaRight(Number(e.activeLabel))
    }
  }

  const handleChartMouseUp = () => {
    if (refAreaLeft !== null && refAreaRight !== null && Math.abs(refAreaRight - refAreaLeft) >= 2) {
      const l = Math.min(refAreaLeft, refAreaRight)
      const r = Math.max(refAreaLeft, refAreaRight)
      setZoomStack(prev => [...prev, [l, r]])
      didZoomRef.current = true
    }
    setRefAreaLeft(null)
    setRefAreaRight(null)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (_e: any) => {
    if (didZoomRef.current) { didZoomRef.current = false; return }
    const solveId = hoveredSolveIdRef.current
    if (solveId == null) return
    const solve = solves.find(s => s.id === solveId)
    if (solve) onSelectSolve(solve)
  }

  const handleLegendClick = (data: { dataKey?: string | number | ((obj: unknown) => unknown) }) => {
    if (typeof data.dataKey !== 'string') return
    const key = data.dataKey
    setHiddenPhases(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const xAxisProps = {
    dataKey: 'seq' as const,
    type: 'number' as const,
    domain: [firstVisSeq - 0.5, lastVisSeq + 0.5] as [number, number],
    allowDecimals: false,
    stroke: '#555',
    tick: { fill: '#555', fontSize: 11 },
  }

  const yAxisProps = {
    stroke: '#555',
    tick: { fill: '#555', fontSize: 11 },
    tickFormatter: (v: number) => (v / 1000).toFixed(2),
  }

  const chartContainerStyle: React.CSSProperties = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(10, 10, 26, 0.88)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      flexDirection: 'column',
      color: '#ccc',
      fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid #222',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 'bold', color: '#888', fontSize: 15 }}>Trends</span>
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value as MethodFilter)}
            style={{
              background: 'transparent',
              border: '1px solid #333',
              color: '#888',
              fontSize: 12,
              padding: '1px 4px',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            <option value="all">All</option>
            <option value="cfop">CFOP</option>
            <option value="roux">Roux</option>
          </select>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', color: '#e94560', fontSize: 20, padding: '0 4px', border: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #222',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {/* Row 1: Tab + Window */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setTab('total')} style={btnStyle(tab === 'total')}>Total</button>
            <button onClick={() => setTab('phases')} style={btnStyle(tab === 'phases')}>Phases</button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {windowOptions.map(opt => (
              <button key={opt.label} onClick={() => setWindowSize(opt.value)} style={btnStyle(windowSize === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Zoom controls (left) + Time type toggles + Group/Split (right) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {/* Zoom controls — only visible when zoomed */}
          <div style={{ display: 'flex', gap: 4 }}>
            {zoomStack.length > 0 && (
              <button
                onClick={() => setZoomStack([])}
                style={{ ...btnStyle(false), color: '#e94560', borderColor: '#e94560' }}
              >
                Reset zoom
              </button>
            )}
            {zoomStack.length >= 1 && (
              <button
                onClick={() => setZoomStack(prev => prev.slice(0, -1))}
                style={{ ...btnStyle(false), color: '#aaa', borderColor: '#555' }}
              >
                ← Back
              </button>
            )}
          </div>

          {/* Time type toggles + Group/Split */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {tab === 'total' ? (
              /* Multi-select for Total tab — order: Total, Exec, Recog */
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => toggleTimeType('total')} style={{ ...btnStyle(totalToggle.total), color: totalToggle.total ? TYPE_COLORS.total.ao5 : '#555', borderColor: totalToggle.total ? TYPE_COLORS.total.ao5 : '#333' }}>Total</button>
                <button onClick={() => toggleTimeType('exec')} style={{ ...btnStyle(totalToggle.exec), color: totalToggle.exec ? TYPE_COLORS.exec.line : '#555', borderColor: totalToggle.exec ? TYPE_COLORS.exec.line : '#333' }}>Exec</button>
                <button onClick={() => toggleTimeType('recog')} style={{ ...btnStyle(totalToggle.recog), color: totalToggle.recog ? TYPE_COLORS.recog.line : '#555', borderColor: totalToggle.recog ? TYPE_COLORS.recog.line : '#333' }}>Recog</button>
              </div>
            ) : (
              /* Single-select for Phases tab — order: Total, Exec, Recog */
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPhaseTimeType('total')} style={btnStyle(phaseTimeType === 'total')}>Total</button>
                <button onClick={() => setPhaseTimeType('exec')} style={btnStyle(phaseTimeType === 'exec')}>Exec</button>
                <button onClick={() => setPhaseTimeType('recog')} style={btnStyle(phaseTimeType === 'recog')}>Recog</button>
              </div>
            )}
            {tab === 'phases' && hasGroups && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setGrouped(true)} style={btnStyle(grouped)}>Group</button>
                <button onClick={() => setGrouped(false)} style={btnStyle(!grouped)}>Split</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, padding: '16px', minHeight: 0 }}>
        {tab === 'total' ? (
          <div style={chartContainerStyle}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={visibleTotalData}
                margin={{ top: 24, right: 16, bottom: 8, left: 0 }}
                onMouseDown={handleChartMouseDown}
                onMouseMove={handleChartMouseMove}
                onMouseUp={handleChartMouseUp}
                onClick={handleChartClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip content={<TotalTooltip totalToggle={totalToggle} solveMap={solveMap} hoveredSolveIdRef={hoveredSolveIdRef} />} />

                {/* Day boundary lines */}
                {dayLines.map(dl => (
                  <ReferenceLine
                    key={dl.x}
                    x={dl.x}
                    stroke="#4a6080"
                    strokeDasharray="6 3"
                    label={{ value: dl.label, position: 'top', fill: '#6a90b0', fontSize: 10 }}
                  />
                ))}

                {/* Exec lines */}
                {totalToggle.exec && (
                  <Line dataKey="exec" name="Exec" stroke="none"
                    dot={{ r: 3, fill: TYPE_COLORS.exec.line }}
                    activeDot={{ r: 6, fill: TYPE_COLORS.exec.line, cursor: 'pointer' }} />
                )}
                {totalToggle.exec && visibleTotalData.length >= 5 && (
                  <Line dataKey="execAo5" name="Ao5 (Exec)" stroke={TYPE_COLORS.exec.ao5} dot={false} strokeWidth={2} connectNulls />
                )}
                {totalToggle.exec && visibleTotalData.length >= 12 && (
                  <Line dataKey="execAo12" name="Ao12 (Exec)" stroke={TYPE_COLORS.exec.ao12} dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls />
                )}

                {/* Recog lines */}
                {totalToggle.recog && (
                  <Line dataKey="recog" name="Recog" stroke="none"
                    dot={{ r: 3, fill: TYPE_COLORS.recog.line }}
                    activeDot={{ r: 6, fill: TYPE_COLORS.recog.line, cursor: 'pointer' }} />
                )}
                {totalToggle.recog && visibleTotalData.length >= 5 && (
                  <Line dataKey="recogAo5" name="Ao5 (Recog)" stroke={TYPE_COLORS.recog.ao5} dot={false} strokeWidth={2} connectNulls />
                )}
                {totalToggle.recog && visibleTotalData.length >= 12 && (
                  <Line dataKey="recogAo12" name="Ao12 (Recog)" stroke={TYPE_COLORS.recog.ao12} dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls />
                )}

                {/* Total lines */}
                {totalToggle.total && (
                  <Line dataKey="total" name="Total" stroke="none"
                    dot={{ r: 3, fill: TYPE_COLORS.total.line }}
                    activeDot={{ r: 6, fill: TYPE_COLORS.total.line, cursor: 'pointer' }} />
                )}
                {totalToggle.total && visibleTotalData.length >= 5 && (
                  <Line dataKey="totalAo5" name="Ao5 (Total)" stroke={TYPE_COLORS.total.ao5} dot={false} strokeWidth={2} connectNulls />
                )}
                {totalToggle.total && visibleTotalData.length >= 12 && (
                  <Line dataKey="totalAo12" name="Ao12 (Total)" stroke={TYPE_COLORS.total.ao12} dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls />
                )}

                {/* Zoom selection area */}
                {refAreaLeft !== null && refAreaRight !== null && (
                  <ReferenceArea
                    x1={Math.min(refAreaLeft, refAreaRight)}
                    x2={Math.max(refAreaLeft, refAreaRight)}
                    strokeOpacity={0.3}
                    fill="#666"
                    fillOpacity={0.2}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={chartContainerStyle}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={visiblePhaseData}
                margin={{ top: 24, right: 16, bottom: 8, left: 0 }}
                onMouseDown={handleChartMouseDown}
                onMouseMove={handleChartMouseMove}
                onMouseUp={handleChartMouseUp}
                onClick={handleChartClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip content={<PhaseTooltip solveMap={solveMap} hoveredSolveIdRef={hoveredSolveIdRef} />} />

                {/* Day boundary lines */}
                {dayLines.map(dl => (
                  <ReferenceLine
                    key={dl.x}
                    x={dl.x}
                    stroke="#4a6080"
                    strokeDasharray="6 3"
                    label={{ value: dl.label, position: 'top', fill: '#6a90b0', fontSize: 10 }}
                  />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  onClick={handleLegendClick}
                  formatter={(value: string) => (
                    <span style={{ color: hiddenPhases.has(value) ? '#444' : (colorMap[value] ?? '#888'), cursor: 'pointer' }}>
                      {value}
                    </span>
                  )}
                />
                {phaseKeys.map(key => (
                  <Line
                    key={key}
                    dataKey={key}
                    stroke={colorMap[key] ?? '#888'}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                    hide={hiddenPhases.has(key)}
                    activeDot={{ r: 6, fill: colorMap[key] ?? '#888', cursor: 'pointer' }}
                  />
                ))}

                {/* Zoom selection area */}
                {refAreaLeft !== null && refAreaRight !== null && (
                  <ReferenceArea
                    x1={Math.min(refAreaLeft, refAreaRight)}
                    x2={Math.max(refAreaLeft, refAreaRight)}
                    strokeOpacity={0.3}
                    fill="#666"
                    fillOpacity={0.2}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

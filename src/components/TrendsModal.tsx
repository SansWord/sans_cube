import { useState, useEffect, useRef, useCallback } from 'react'
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
import type { SolveRecord, SolveFilter } from '../types/solve'
import { getMethod, CFOP, ROUX, FREEFORM } from '../methods/index'
import { buildTotalData, buildPhaseData, buildStatsData, windowStats } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint, SortMode, StatsSolvePoint } from '../utils/trends'
import { formatSeconds } from '../utils/formatting'
import { filterStats } from '../utils/solveStats'
import { serializeZoomStack, type TrendsHashParams } from '../hooks/useHashRouter'

type Tab = 'total' | 'phases'
type WindowSize = 25 | 50 | 100 | 'all'
type TimeKey = 'exec' | 'recog' | 'total'
type TimeToggle = Record<TimeKey, boolean>

// tune: line draw-in animation duration in ms (set to 0 to disable)
const LINE_ANIMATION_DURATION_MS = 200
// tune: easing for the draw-in animation — "ease" (default) starts slow which looks like
// vertical drift; try "ease-out" (fast start, soft stop) or "linear" (no drift effect)
const LINE_ANIMATION_EASING = 'ease-out'

// Colors per time type for Total tab
const TYPE_COLORS: Record<TimeKey, { line: string; ao5: string; ao12: string }> = {
  exec:  { line: '#4fc3f7', ao5: '#0288d1', ao12: '#01579b' },
  recog: { line: '#a5d6a7', ao5: '#43a047', ao12: '#2e7d32' },
  total: { line: '#888',    ao5: '#e94560', ao12: '#3498db' },
}


interface Props {
  solves: SolveRecord[]
  solveFilter: SolveFilter
  updateSolveFilter: (updater: (f: SolveFilter) => SolveFilter) => void
  onSelectSolve: (solve: SolveRecord) => void
  onClose: () => void
  detailOpen?: boolean
  initialParams: TrendsHashParams
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

function buildColorMapForMethod(method: ReturnType<typeof getMethod>, grouped: boolean): Record<string, string> {
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
      const range = 24
      const lNew = l - range / 2 + (range / (n - 1)) * idx
      map[phase.label] = hslToHex(h, s, Math.max(20, Math.min(80, lNew)))
    }
  }
  return map
}

function buildColorMap(
  method: SolveFilter['method'],
  grouped: boolean,
): Record<string, string> {
  if (method === 'all') {
    // Merge colors from all methods so Roux/Freeform phase names don't fall back to gray
    return {
      ...buildColorMapForMethod(ROUX, grouped),
      ...buildColorMapForMethod(FREEFORM, grouped),
      ...buildColorMapForMethod(CFOP, grouped),
    }
  }
  return buildColorMapForMethod(getMethod(method), grouped)
}

function buildMergedPhaseData(
  windowed: StatsSolvePoint[],
  phaseToggle: TimeToggle,
  grouped: boolean,
): PhaseDataPoint[] {
  const activeTypes = (Object.keys(phaseToggle) as TimeKey[]).filter(k => phaseToggle[k])
  if (activeTypes.length === 0) return []
  const datasets = activeTypes.map(type => buildPhaseData(windowed, type, grouped))
  return datasets[0].map((pt, i) => {
    const merged: PhaseDataPoint = { xIndex: pt.xIndex, solveId: pt.solveId }
    activeTypes.forEach((type, j) => {
      const typePt = datasets[j][i]
      Object.entries(typePt).forEach(([key, val]) => {
        if (key === 'xIndex' || key === 'solveId') return
        merged[`${key}_${type}`] = val as number
      })
    })
    return merged
  })
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
  visibleData: Array<{ xIndex: number; solveId: number }>,
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

  lines.push({ x: visibleData[0].xIndex - 0.5, label: formatMonthDay(firstSolve.date) })

  let prevDay = startOfDay(firstSolve.date)
  for (let i = 1; i < visibleData.length; i++) {
    const solve = solveMap.get(visibleData[i].solveId)
    if (!solve) continue
    const day = startOfDay(solve.date)
    if (day !== prevDay) {
      lines.push({ x: visibleData[i].xIndex - 0.5, label: formatMonthDay(solve.date) })
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
      <div>Solve #{solve?.seq ?? '?'}</div>
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
      <div>Solve #{solve?.seq ?? '?'}</div>
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

export function TrendsModal({ solves, solveFilter, updateSolveFilter, onSelectSolve, onClose, detailOpen, initialParams }: Props) {
  const [isMobile] = useState(() => window.innerWidth < 640)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !detailOpen) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, detailOpen])
  const isFirstMountRef = useRef(true)
  const [tab, setTab] = useState<Tab>(initialParams.tab)
  const [windowSize, setWindowSize] = useState<WindowSize>(initialParams.windowSize ?? (isMobile ? 25 : 'all'))
  const [grouped, setGrouped] = useState(initialParams.grouped)
  const [totalToggle, setTotalToggle] = useState<TimeToggle>({ exec: false, recog: false, total: true })
  const [phaseToggle, setPhaseToggle] = useState<TimeToggle>(initialParams.phaseToggle)
  const [hiddenPhases, setHiddenPhases] = useState<Set<string>>(new Set())
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null)
  const refAreaRightRef = useRef<number | null>(null)
  const [zoomStack, setZoomStack] = useState<Array<[number, number]>>(initialParams.zoom ?? [])
  const [sortMode, setSortMode] = useState<SortMode>(initialParams.sortMode)

  const method = getMethod(solveFilter.method === 'all' ? 'cfop' : solveFilter.method)
  const hasGroups = method.phases.some(p => p.group)

  const currentDomain: [number, number] | null = zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : null

  const indexed = buildStatsData(solves, sortMode)
  const filteredStats = filterStats(indexed, solveFilter)
  const windowed = windowStats(filteredStats, windowSize)
  const totalData = buildTotalData(windowed)
  const phaseData = buildMergedPhaseData(windowed, phaseToggle, grouped)

  const visibleTotalData = currentDomain
    ? totalData.filter(pt => pt.xIndex >= currentDomain[0] && pt.xIndex <= currentDomain[1])
    : totalData
  const visiblePhaseData = currentDomain
    ? phaseData.filter(pt => (pt.xIndex as number) >= currentDomain[0] && (pt.xIndex as number) <= currentDomain[1])
    : phaseData

  const solveMap = new Map(solves.map(s => [s.id, s]))

  const visibleSeqData = tab === 'total'
    ? visibleTotalData
    : visiblePhaseData.map(pt => ({ xIndex: pt.xIndex as number, solveId: pt.solveId as number }))
  const dayLines = buildDayLines(visibleSeqData, solveMap)

  const firstVisIndex = visibleSeqData[0]?.xIndex ?? 1
  const lastVisIndex = visibleSeqData[visibleSeqData.length - 1]?.xIndex ?? firstVisIndex
  const colorMap = buildColorMap(solveFilter.method, grouped)

  const phaseKeys = Array.from(
    phaseData.reduce((set, pt) => {
      Object.keys(pt).forEach(k => { if (k !== 'xIndex' && k !== 'solveId') set.add(k) })
      return set
    }, new Set<string>())
  )

  // Reset zoom at the user-action boundary (handlers below) rather than in an
  // effect. A `useEffect` keyed on [windowSize, sortMode] fires on mount and on
  // StrictMode's simulated remount, wiping `initialParams.zoom` hydrated from
  // the URL.
  const changeWindowSize = useCallback((next: WindowSize) => {
    setWindowSize(prev => {
      if (prev !== next) {
        setZoomStack([])
        setRefAreaLeft(null)
        setRefAreaRight(null)
      }
      return next
    })
  }, [])
  const changeSortMode = useCallback((next: SortMode) => {
    setSortMode(prev => {
      if (prev !== next) {
        setZoomStack([])
        setRefAreaLeft(null)
        setRefAreaRight(null)
      }
      return next
    })
  }, [])

  // Sync URL hash
  useEffect(() => {
    if (detailOpen) return  // don't overwrite #solve or #shared URL while a detail modal is open
    const activeTotalTypes = (Object.keys(totalToggle) as TimeKey[]).filter(k => totalToggle[k]).join(',') || 'exec,recog,total'
    const activePhaseTypes = (Object.keys(phaseToggle) as TimeKey[]).filter(k => phaseToggle[k]).join(',') || 'total'
    const params = new URLSearchParams({
      method: solveFilter.method,
      driver: solveFilter.driver,
      tab,
      window: String(windowSize),
      sort: sortMode,
      group: grouped ? 'grouped' : 'split',
      ttotal: activeTotalTypes,
      tphase: activePhaseTypes,
    })
    if (zoomStack.length > 0) params.set('zoom', serializeZoomStack(zoomStack))
    const url = `${window.location.pathname}${window.location.search}#trends?${params.toString()}`
    if (isFirstMountRef.current) {
      history.pushState(null, '', url)
      isFirstMountRef.current = false
    } else {
      history.replaceState(null, '', url)
    }
  }, [solveFilter.method, solveFilter.driver, tab, windowSize, sortMode, grouped, totalToggle, phaseToggle, detailOpen, zoomStack])

  const windowOptions: Array<{ label: string; value: WindowSize }> = [
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    ...(!isMobile ? [{ label: 'All', value: 'all' as const }] : []),
  ]

  const toggleTimeType = (key: TimeKey) => {
    setTotalToggle(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (!next.exec && !next.recog && !next.total) return prev
      return next
    })
  }

  const togglePhaseType = (key: TimeKey) => {
    setPhaseToggle(prev => {
      const next = { ...prev, [key]: !prev[key] }
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
      const val = Number(e.activeLabel)
      setRefAreaRight(val)
      refAreaRightRef.current = val
    }
  }

  const handleChartMouseUp = () => {
    const right = refAreaRightRef.current
    if (refAreaLeft !== null && right !== null && Math.abs(right - refAreaLeft) >= 2) {
      const l = Math.min(refAreaLeft, right)
      const r = Math.max(refAreaLeft, right)
      setZoomStack(prev => [...prev, [l, r]])
      didZoomRef.current = true
    }
    setRefAreaLeft(null)
    setRefAreaRight(null)
    refAreaRightRef.current = null
  }

  // Finish drag selection when mouse releases outside the chart (e.g. outside the window)
  useEffect(() => {
    if (refAreaLeft === null) return
    document.addEventListener('mouseup', handleChartMouseUp)
    return () => document.removeEventListener('mouseup', handleChartMouseUp)
  }, [refAreaLeft]) // eslint-disable-line react-hooks/exhaustive-deps

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
    dataKey: 'xIndex' as const,
    type: 'number' as const,
    domain: [firstVisIndex - 0.5, lastVisIndex + 0.5] as [number, number],
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#555', fontSize: 11 }}>Method</span>
            <select
              value={solveFilter.method}
              onChange={e => updateSolveFilter(f => ({ ...f, method: e.target.value as SolveFilter['method'] }))}
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
              <option value="freeform">Freeform</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#555', fontSize: 11 }}>Driver</span>
            <select
              value={solveFilter.driver}
              onChange={e => updateSolveFilter(f => ({ ...f, driver: e.target.value as SolveFilter['driver'] }))}
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
              <option value="cube">Cube</option>
              <option value="mouse">Mouse</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#555', fontSize: 11 }}>Sort</span>
            <select
              value={sortMode}
              onChange={e => changeSortMode(e.target.value as SortMode)}
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
              <option value="seq">Seq</option>
              <option value="date">Date</option>
            </select>
          </div>
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
              <button key={opt.label} onClick={() => changeWindowSize(opt.value)} style={btnStyle(windowSize === opt.value)}>
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
              /* Multi-toggle for Phases tab: Total / Exec / Recog */
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => togglePhaseType('total')} style={btnStyle(phaseToggle.total)}>Total</button>
                <button onClick={() => togglePhaseType('exec')} style={btnStyle(phaseToggle.exec)}>Exec</button>
                <button onClick={() => togglePhaseType('recog')} style={btnStyle(phaseToggle.recog)}>Recog</button>
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
                    activeDot={{ r: 6, fill: TYPE_COLORS.exec.line, cursor: 'pointer' }}
                    animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}
                {totalToggle.exec && visibleTotalData.length >= 5 && (
                  <Line dataKey="execAo5" name="Ao5 (Exec)" stroke={TYPE_COLORS.exec.ao5} dot={false} strokeWidth={2} connectNulls animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}
                {totalToggle.exec && visibleTotalData.length >= 12 && (
                  <Line dataKey="execAo12" name="Ao12 (Exec)" stroke={TYPE_COLORS.exec.ao12} dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}

                {/* Recog lines — tune: RECOG_OPACITY (0–1), RECOG_WIDTH (px) */}
                {totalToggle.recog && (
                  <Line dataKey="recog" name="Recog" stroke="none"
                    dot={{ r: 3, fill: TYPE_COLORS.recog.line, fillOpacity: 0.45 }}
                    activeDot={{ r: 6, fill: TYPE_COLORS.recog.line, fillOpacity: 0.45, cursor: 'pointer' }}
                    animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}
                {totalToggle.recog && visibleTotalData.length >= 5 && (
                  <Line dataKey="recogAo5" name="Ao5 (Recog)" stroke={TYPE_COLORS.recog.ao5} strokeOpacity={0.45} dot={false} strokeWidth={2} connectNulls animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}
                {totalToggle.recog && visibleTotalData.length >= 12 && (
                  <Line dataKey="recogAo12" name="Ao12 (Recog)" stroke={TYPE_COLORS.recog.ao12} strokeOpacity={0.45} dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}

                {/* Total lines */}
                {totalToggle.total && (
                  <Line dataKey="total" name="Total" stroke="none"
                    dot={{ r: 3, fill: TYPE_COLORS.total.line }}
                    activeDot={{ r: 6, fill: TYPE_COLORS.total.line, cursor: 'pointer' }}
                    animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}
                {totalToggle.total && visibleTotalData.length >= 5 && (
                  <Line dataKey="totalAo5" name="Ao5 (Total)" stroke={TYPE_COLORS.total.ao5} dot={false} strokeWidth={2} connectNulls animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
                )}
                {totalToggle.total && visibleTotalData.length >= 12 && (
                  <Line dataKey="totalAo12" name="Ao12 (Total)" stroke={TYPE_COLORS.total.ao12} dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls animationDuration={LINE_ANIMATION_DURATION_MS} animationEasing={LINE_ANIMATION_EASING} />
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
                  formatter={(value: string) => {
                    const typeMatch = value.match(/_(exec|recog|total)$/)
                    const phaseName = typeMatch ? value.slice(0, -(typeMatch[0].length)) : value
                    const timeType = typeMatch?.[1] as TimeKey | undefined
                    const typeSuffix = timeType ? ` (${timeType[0].toUpperCase()}${timeType.slice(1)})` : ''
                    const color = hiddenPhases.has(value) ? '#444' : (colorMap[phaseName] ?? '#888')
                    return <span style={{ color, cursor: 'pointer' }}>{phaseName}{typeSuffix}</span>
                  }}
                />
                {phaseKeys.map(key => {
                  const typeMatch = key.match(/_(exec|recog|total)$/)
                  const phaseName = typeMatch ? key.slice(0, -(typeMatch[0].length)) : key
                  const timeType = typeMatch?.[1] as TimeKey | undefined
                  const color = colorMap[phaseName] ?? '#888'
                  const strokeDasharray = timeType === 'exec' ? '5 3' : timeType === 'recog' ? '2 3' : undefined
                  return (
                    <Line
                      key={key}
                      dataKey={key}
                      stroke={color}
                      strokeOpacity={timeType === 'recog' ? 0.45 : undefined}
                      dot={false}
                      strokeWidth={2}
                      strokeDasharray={strokeDasharray}
                      connectNulls
                      hide={hiddenPhases.has(key)}
                      activeDot={{ r: 6, fill: color, fillOpacity: timeType === 'recog' ? 0.45 : undefined, cursor: 'pointer' }}
                      animationDuration={LINE_ANIMATION_DURATION_MS}
                      animationEasing={LINE_ANIMATION_EASING}
                    />
                  )
                })}

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

import { useState, useEffect } from 'react'
import {
  ComposedChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { SolveRecord, MethodFilter } from '../types/solve'
import { getMethod } from '../methods/index'
import { buildTotalData, buildPhaseData } from '../utils/trends'
import type { TotalDataPoint, PhaseDataPoint } from '../utils/trends'
import { formatSeconds } from '../utils/formatting'

type Tab = 'total' | 'phases'
type WindowSize = 25 | 50 | 100 | 'all'
type TimeType = 'exec' | 'recog'

interface Props {
  solves: SolveRecord[]
  methodFilter: MethodFilter
  setMethodFilter: (f: MethodFilter) => void
  onSelectSolve: (solve: SolveRecord) => void
  onClose: () => void
}

function parseHashParams(): {
  tab: Tab
  windowSize: WindowSize
  grouped: boolean
  timeType: TimeType
} {
  const hash = window.location.hash
  if (!hash.startsWith('#trends')) {
    return { tab: 'total', windowSize: 25, grouped: true, timeType: 'exec' }
  }
  const search = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(search)
  const tab: Tab = params.get('tab') === 'phases' ? 'phases' : 'total'
  const w = params.get('window')
  const windowSize: WindowSize =
    w === 'all' ? 'all' : w === '50' ? 50 : w === '100' ? 100 : 25
  const grouped: boolean = params.get('group') !== 'split'
  const timeType: TimeType = params.get('timetype') === 'recog' ? 'recog' : 'exec'
  return { tab, windowSize, grouped, timeType }
}

function buildColorMap(
  methodFilter: MethodFilter,
  grouped: boolean,
): Record<string, string> {
  const method = getMethod(methodFilter === 'all' ? 'cfop' : methodFilter)
  const map: Record<string, string> = {}
  for (const phase of method.phases) {
    const key = grouped && phase.group ? phase.group : phase.label
    if (!(key in map)) map[key] = phase.color
  }
  return map
}

function filterSolves(solves: SolveRecord[], methodFilter: MethodFilter): SolveRecord[] {
  if (methodFilter === 'all') return solves
  return solves.filter(s => s.isExample || (s.method ?? 'cfop') === methodFilter)
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

function TotalTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TotalDataPoint }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '6px 10px', fontSize: 12, color: '#ccc' }}>
      <div>Solve #{d.seq}</div>
      <div>Value: {formatSeconds(d.value)}s</div>
      {d.ao5 !== null && <div style={{ color: '#e94560' }}>Ao5: {formatSeconds(d.ao5)}s</div>}
      {d.ao12 !== null && <div style={{ color: '#3498db' }}>Ao12: {formatSeconds(d.ao12)}s</div>}
      <div style={{ color: '#555', marginTop: 4 }}>▶ tap to replay</div>
    </div>
  )
}

function PhaseTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload: PhaseDataPoint }> }) {
  if (!active || !payload?.length) return null
  const seq = payload[0].payload.seq
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '6px 10px', fontSize: 12, color: '#ccc' }}>
      <div>Solve #{seq}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {formatSeconds(p.value)}s
        </div>
      ))}
      <div style={{ color: '#555', marginTop: 4 }}>▶ tap to replay</div>
    </div>
  )
}

export function TrendsModal({ solves, methodFilter, setMethodFilter, onSelectSolve, onClose }: Props) {
  const [isMobile] = useState(() => window.innerWidth < 640)
  const parsed = parseHashParams()
  const [tab, setTab] = useState<Tab>(parsed.tab)
  const [windowSize, setWindowSize] = useState<WindowSize>(isMobile ? 25 : parsed.windowSize)
  const [grouped, setGrouped] = useState(parsed.grouped)
  const [timeType, setTimeType] = useState<TimeType>(parsed.timeType)

  const filtered = filterSolves(solves, methodFilter)
  const method = getMethod(methodFilter === 'all' ? 'cfop' : methodFilter)
  const hasGroups = method.phases.some(p => p.group)

  const totalData = buildTotalData(filtered, windowSize, timeType)
  const phaseData = buildPhaseData(filtered, windowSize, timeType, grouped)
  const colorMap = buildColorMap(methodFilter, grouped)

  const phaseKeys = Array.from(
    phaseData.reduce((set, pt) => {
      Object.keys(pt).forEach(k => { if (k !== 'seq' && k !== 'solveId') set.add(k) })
      return set
    }, new Set<string>())
  )

  useEffect(() => {
    const params = new URLSearchParams({
      method: methodFilter,
      tab,
      window: String(windowSize),
      group: grouped ? 'grouped' : 'split',
      timetype: timeType,
    })
    window.location.hash = `trends?${params.toString()}`
  }, [methodFilter, tab, windowSize, grouped, timeType])

  const handleDotClick = (data: TotalDataPoint) => {
    const solve = solves.find(s => s.id === data.solveId)
    if (solve) onSelectSolve(solve)
  }

  const handlePhaseLineDotClick = (_: unknown, payload: { payload: PhaseDataPoint }) => {
    const solve = solves.find(s => s.id === payload.payload.solveId)
    if (solve) onSelectSolve(solve)
  }

  const windowOptions: Array<{ label: string; value: WindowSize }> = [
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    ...(!isMobile ? [{ label: 'All', value: 'all' as const }] : []),
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: '#0a0a1a',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setTimeType('exec')} style={btnStyle(timeType === 'exec')}>Exec</button>
            <button onClick={() => setTimeType('recog')} style={btnStyle(timeType === 'recog')}>Recog</button>
          </div>
          {tab === 'phases' && hasGroups && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setGrouped(true)} style={btnStyle(grouped)}>Grp</button>
              <button onClick={() => setGrouped(false)} style={btnStyle(!grouped)}>Split</button>
            </div>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, padding: '16px', minHeight: 0 }}>
        {tab === 'total' ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={totalData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="seq" stroke="#555" tick={{ fill: '#555', fontSize: 11 }} />
              <YAxis
                stroke="#555"
                tick={{ fill: '#555', fontSize: 11 }}
                tickFormatter={v => (v / 1000).toFixed(2)}
              />
              <Tooltip content={<TotalTooltip />} />
              <Line
                dataKey="value"
                stroke="none"
                dot={{ r: 3, fill: '#555' }}
                activeDot={{ r: 5, fill: '#777', onClick: handleDotClick as never }}
              />
              {totalData.length >= 5 && (
                <Line
                  dataKey="ao5"
                  stroke="#e94560"
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              )}
              {totalData.length >= 12 && (
                <Line
                  dataKey="ao12"
                  stroke="#3498db"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={phaseData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="seq" stroke="#555" tick={{ fill: '#555', fontSize: 11 }} />
              <YAxis
                stroke="#555"
                tick={{ fill: '#555', fontSize: 11 }}
                tickFormatter={v => (v / 1000).toFixed(2)}
              />
              <Tooltip content={<PhaseTooltip />} />
              <Legend wrapperStyle={{ color: '#888', fontSize: 12 }} />
              {phaseKeys.map(key => (
                <Line
                  key={key}
                  dataKey={key}
                  stroke={colorMap[key] ?? '#888'}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                  activeDot={{ r: 5, onClick: handlePhaseLineDotClick as never, style: { cursor: 'pointer' } }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

import type { SolveRecord } from '../types/solve'

export interface TotalDataPoint {
  seq: number
  exec: number
  recog: number
  total: number
  execAo5: number | null
  execAo12: number | null
  recogAo5: number | null
  recogAo12: number | null
  totalAo5: number | null
  totalAo12: number | null
  solveId: number
}

export interface PhaseDataPoint {
  seq: number
  [phaseLabel: string]: number | null
  solveId: number
}

/** Trimmed rolling average of the last `n` values ending at `index`. Returns null if fewer than n values available. */
function rollingAo(values: number[], index: number, n: number): number | null {
  if (index + 1 < n) return null
  const slice = values.slice(index + 1 - n, index + 1)
  const sorted = [...slice].sort((a, b) => a - b)
  const trimmed = sorted.slice(1, -1)
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
}

function sliceWindow(solves: SolveRecord[], window: number | 'all'): SolveRecord[] {
  const real = solves.filter(s => !s.isExample).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  if (window === 'all') return real
  return real.slice(-window)
}

export function buildTotalData(
  solves: SolveRecord[],
  window: number | 'all',
): TotalDataPoint[] {
  const windowed = sliceWindow(solves, window)
  const execs = windowed.map(s => s.phases.reduce((sum, p) => sum + p.executionMs, 0))
  const recogs = windowed.map(s => s.phases.reduce((sum, p) => sum + p.recognitionMs, 0))
  const totals = execs.map((e, i) => e + recogs[i])
  return windowed.map((s, i) => ({
    seq: i + 1,
    exec: execs[i],
    recog: recogs[i],
    total: totals[i],
    execAo5: rollingAo(execs, i, 5),
    execAo12: rollingAo(execs, i, 12),
    recogAo5: rollingAo(recogs, i, 5),
    recogAo12: rollingAo(recogs, i, 12),
    totalAo5: rollingAo(totals, i, 5),
    totalAo12: rollingAo(totals, i, 12),
    solveId: s.id,
  }))
}

export function buildPhaseData(
  solves: SolveRecord[],
  window: number | 'all',
  timeType: 'exec' | 'recog' | 'total',
  grouped: boolean,
): PhaseDataPoint[] {
  const windowed = sliceWindow(solves, window)
  return windowed.map((s, i) => {
    const point: PhaseDataPoint = { seq: i + 1, solveId: s.id }
    for (const phase of s.phases) {
      const key = grouped && phase.group ? phase.group : phase.label
      const ms = timeType === 'exec' ? phase.executionMs
               : timeType === 'recog' ? phase.recognitionMs
               : phase.executionMs + phase.recognitionMs
      point[key] = ((point[key] as number | null | undefined) ?? 0) + ms
    }
    return point
  })
}

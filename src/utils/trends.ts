import type { SolveRecord } from '../types/solve'

export interface TotalDataPoint {
  seq: number
  value: number
  ao5: number | null
  ao12: number | null
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
  const real = solves.filter(s => !s.isExample)
  if (window === 'all') return real
  return real.slice(-window)
}

export function buildTotalData(
  solves: SolveRecord[],
  window: number | 'all',
  timeType: 'exec' | 'recog',
): TotalDataPoint[] {
  const windowed = sliceWindow(solves, window)
  const values = windowed.map(s =>
    s.phases.reduce((sum, p) => sum + (timeType === 'exec' ? p.executionMs : p.recognitionMs), 0)
  )
  return windowed.map((s, i) => ({
    seq: i + 1,
    value: values[i],
    ao5: rollingAo(values, i, 5),
    ao12: rollingAo(values, i, 12),
    solveId: s.id,
  }))
}

export function buildPhaseData(
  solves: SolveRecord[],
  window: number | 'all',
  timeType: 'exec' | 'recog',
  grouped: boolean,
): PhaseDataPoint[] {
  const windowed = sliceWindow(solves, window)
  return windowed.map((s, i) => {
    const point: PhaseDataPoint = { seq: i + 1, solveId: s.id }
    for (const phase of s.phases) {
      const key = grouped && phase.group ? phase.group : phase.label
      const ms = timeType === 'exec' ? phase.executionMs : phase.recognitionMs
      point[key] = ((point[key] as number | null | undefined) ?? 0) + ms
    }
    return point
  })
}

import type { SolveRecord } from '../types/solve'
import { formatSeconds } from './formatting'
import { getMethod } from '../methods/index'

function fmtTps(solve: SolveRecord): string {
  const secs = solve.timeMs / 1000
  if (secs === 0) return '—'
  return (solve.moves.length / secs).toFixed(2)
}

/**
 * Builds a tab-separated solve list suitable for pasting into a spreadsheet or notes.
 * Columns: #, Time, TPS, Method
 * Input solves should already be in the desired display order.
 */
export function buildCopySolveList(solves: SolveRecord[]): string {
  const header = ['#', 'Time', 'TPS', 'Method'].join('\t')
  const rows = solves.map((s) => [
    s.isExample ? '★' : String(s.seq ?? s.id),
    formatSeconds(s.timeMs),
    fmtTps(s),
    getMethod(s.method).label,
  ].join('\t'))
  return [header, ...rows].join('\n')
}

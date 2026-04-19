import type { SolveRecord } from '../../types/solve'

/** Shape of one record in an acubemy export (fields we read or probe). */
export interface AcubemyRecord {
  solve_id?: number
  date?: string
  scramble?: string
  raw_solution?: string
  raw_timestamps?: number[]
  analysis_type?: string
  gyro_data?: unknown
  // Unknown fields are allowed; we ignore them.
  [key: string]: unknown
}

export type PreviewStatus = 'new' | 'duplicate' | 'parse-error' | 'unsolved'

export type Warning = 'gyro-dropped'

export interface PreviewRow {
  index: number                 // 1-based row number in sorted-by-date order
  status: PreviewStatus
  reason?: string               // for parse-error / unsolved (first error only)
  warnings: Warning[]
  // Display hints — whatever we could extract, even on parse-error
  date?: number                 // Unix ms, if parseable
  method?: string               // resolved method id, e.g. 'cfop' | 'roux' | 'freeform'
  timeMs?: number
  moveCount?: number
  // Only present when status === 'new'
  draft?: SolveRecord
}

export interface PreviewSummary {
  rows: PreviewRow[]
  counts: {
    new: number
    duplicate: number
    parseError: number
    unsolved: number
    warnings: number            // count of rows with ≥1 warning
  }
}

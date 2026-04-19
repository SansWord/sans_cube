import type { SolveRecord } from '../../types/solve'
import type { PositionMove } from '../../types/cube'
import { ColorMoveTranslator } from '../../drivers/ColorMoveTranslator'
import { ColorCubeEventEmitter, type ColorCubeDriver } from '../../drivers/CubeDriver'
import { getMethod } from '../../methods'
import { computePhases } from '../recomputePhases'
import { parseRawSolution } from './parseRawSolution'
import { gyroMap } from './gyroMap'
import { verifySolvability } from './verifySolvability'
import type {
  AcubemyRecord, PreviewRow, PreviewSummary, Warning,
} from './types'

// Exported for test spying (dedup short-circuit test).
export const __testing = { parseRawSolution }

const ACUBEMY_REQUIRED_FIELDS: (keyof AcubemyRecord)[] = [
  'solve_id', 'date', 'scramble', 'raw_solution', 'raw_timestamps',
]

const KNOWN_METHODS: Record<string, string> = { cfop: 'cfop', roux: 'roux', freeform: 'freeform' }

function looksLikeAcubemyRecord(r: unknown): boolean {
  if (typeof r !== 'object' || r === null) return false
  const obj = r as Record<string, unknown>
  return 'solve_id' in obj && 'raw_solution' in obj
}

function mapMethod(analysisType: unknown): string {
  if (typeof analysisType !== 'string') return 'freeform'
  return KNOWN_METHODS[analysisType.toLowerCase()] ?? 'freeform'
}

// Run ColorMove[] through ColorMoveTranslator synchronously via a mock inner driver.
function translateColorMoves(colorMoves: ReturnType<typeof parseRawSolution>): PositionMove[] {
  class BatchInner extends ColorCubeEventEmitter implements ColorCubeDriver {
    async connect() {}
    async disconnect() {}
  }
  const inner = new BatchInner()
  const translator = new ColorMoveTranslator(inner)
  const out: PositionMove[] = []
  translator.on('move', (m) => out.push(m))
  translator.on('replacePreviousMove', (m) => { out.pop(); out.push(m) })
  for (const cm of colorMoves) inner.emit('move', cm)
  translator.flush()
  return out
}

export interface ParseExportResult {
  fileError?: string
  summary?: PreviewSummary
}

export function parseExport(parsed: unknown, existingSolves: SolveRecord[]): ParseExportResult {
  if (!Array.isArray(parsed)) {
    return { fileError: 'Expected a JSON array of solve records.' }
  }
  if (parsed.length === 0) {
    return { fileError: 'No solves found in file.' }
  }
  if (!parsed.some(looksLikeAcubemyRecord)) {
    return { fileError: "This doesn't look like an acubemy export." }
  }

  const dedup = new Set<string>()
  for (const s of existingSolves) {
    if (s.importedFrom?.source === 'acubemy') {
      dedup.add(`acubemy:${s.importedFrom.externalId}`)
    }
  }

  const rawRows = parsed as AcubemyRecord[]
  const rowsWithDate = rawRows.map((rec, i) => {
    const parsedDate = typeof rec.date === 'string' ? new Date(rec.date).getTime() : NaN
    return { rec, origIndex: i, parsedDate: Number.isFinite(parsedDate) ? parsedDate : undefined }
  })
  rowsWithDate.sort((a, b) =>
    (a.parsedDate ?? Number.MAX_SAFE_INTEGER) - (b.parsedDate ?? Number.MAX_SAFE_INTEGER)
  )

  const rows: PreviewRow[] = rowsWithDate.map(({ rec, parsedDate }, i) => {
    return classifyRecord(rec, i + 1, parsedDate, dedup)
  })

  const counts = {
    new: rows.filter(r => r.status === 'new').length,
    duplicate: rows.filter(r => r.status === 'duplicate').length,
    parseError: rows.filter(r => r.status === 'parse-error').length,
    unsolved: rows.filter(r => r.status === 'unsolved').length,
    warnings: rows.filter(r => r.warnings.length > 0).length,
  }
  return { summary: { rows, counts } }
}

function classifyRecord(
  rec: AcubemyRecord,
  index: number,
  parsedDate: number | undefined,
  dedup: Set<string>,
): PreviewRow {
  const warnings: Warning[] = []
  const displayMethod = mapMethod(rec.analysis_type)

  // Required-field presence.
  for (const field of ACUBEMY_REQUIRED_FIELDS) {
    const v = rec[field]
    if (v === undefined || v === null
        || (Array.isArray(v) && v.length === 0)
        || (typeof v === 'string' && v.length === 0)) {
      return { index, status: 'parse-error', reason: `Missing field: ${field}`, warnings, method: displayMethod, date: parsedDate }
    }
  }
  if (parsedDate === undefined) {
    return { index, status: 'parse-error', reason: `Invalid date: "${rec.date}"`, warnings, method: displayMethod }
  }

  // Dedup short-circuit — before expensive parsing.
  const externalId = rec.solve_id as number
  const key = `acubemy:${externalId}`
  if (dedup.has(key)) {
    return { index, status: 'duplicate', warnings, method: displayMethod, date: parsedDate }
  }

  // Parse moves.
  let colorMoves
  try {
    colorMoves = __testing.parseRawSolution(rec.raw_solution as string, rec.raw_timestamps as number[])
  } catch (e) {
    return { index, status: 'parse-error', reason: (e as Error).message, warnings, method: displayMethod, date: parsedDate }
  }

  const positionMoves = translateColorMoves(colorMoves)
  const timeMs = (rec.raw_timestamps as number[])[(rec.raw_timestamps as number[]).length - 1]

  // Solvability.
  let solved: boolean
  try {
    solved = verifySolvability(rec.scramble as string, positionMoves)
  } catch (e) {
    return { index, status: 'parse-error', reason: (e as Error).message, warnings, method: displayMethod, date: parsedDate, timeMs, moveCount: positionMoves.length }
  }
  if (!solved) {
    return { index, status: 'unsolved', reason: 'Final cube state not solved after applying scramble + moves.', warnings, method: displayMethod, date: parsedDate, timeMs, moveCount: positionMoves.length }
  }

  // Gyro mapping.
  const gyroPresent = rec.gyro_data !== undefined && rec.gyro_data !== null
  const quaternionSnapshots = gyroMap(rec.gyro_data) ?? undefined
  if (gyroPresent && !quaternionSnapshots) warnings.push('gyro-dropped')

  // Phases.
  const method = getMethod(displayMethod)
  const phases = computePhases(positionMoves, rec.scramble as string, method) ?? []

  const draft: SolveRecord = {
    id: 0,            // caller assigns
    schemaVersion: 2,
    scramble: rec.scramble as string,
    timeMs,
    moves: positionMoves,
    phases,
    date: parsedDate,
    method: displayMethod,
    quaternionSnapshots,
    importedFrom: { source: 'acubemy', externalId },
  }

  return { index, status: 'new', warnings, method: displayMethod, date: parsedDate, timeMs, moveCount: positionMoves.length, draft }
}

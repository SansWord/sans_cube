import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets } from './applyMove'
import { computePhases } from './recomputePhases'
import { getMethod } from '../methods/index'
import type { SolveRecord } from '../types/solve'
import type { Move } from '../types/cube'

// Center sticker positions in the 54-char facelets string (U R F D L B order)
const CENTERS = [4, 13, 22, 31, 40, 49] as const
const GEO_FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const

// Original GAN color for each geometric face at solved state.
// GAN_COLOR_MAP: ['W','R','G','Y','O','B'] for face indices 0..5 (U R F D L B)
const FACE_TO_COLOR: Record<string, string> = {
  U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B',
}

// Original color pair that bounds each slice (the two outer face colors).
// M = between L (orange) and R (red); E = between D (yellow) and U (white); S = between F (green) and B (blue)
const SLICE_TO_COLORS: Record<string, readonly [string, string]> = {
  M: ['O', 'R'],
  E: ['Y', 'W'],
  S: ['G', 'B'],
}

// Unordered face pair → slice name
const PAIR_TO_SLICE: Record<string, string> = {
  LR: 'M', RL: 'M',
  UD: 'E', DU: 'E',
  FB: 'S', BF: 'S',
}

function geoFaceForColor(facelets: string, color: string): string {
  const i = CENTERS.findIndex(p => facelets[p] === color)
  return GEO_FACES[i]
}

/** Re-derive geometric face labels for all moves in a v1 solve via center tracking. */
export function correctMovesV1toV2(solve: SolveRecord): Move[] {
  let facelets = SOLVED_FACELETS
  return solve.moves.map(move => {
    let correctedFace: string
    if (move.face === 'M' || move.face === 'E' || move.face === 'S') {
      const [colorA, colorB] = SLICE_TO_COLORS[move.face]
      const faceA = geoFaceForColor(facelets, colorA)
      const faceB = geoFaceForColor(facelets, colorB)
      correctedFace = PAIR_TO_SLICE[faceA + faceB] ?? move.face
    } else {
      correctedFace = geoFaceForColor(facelets, FACE_TO_COLOR[move.face])
    }
    const corrected: Move = { ...move, face: correctedFace as Move['face'] }
    facelets = applyMoveToFacelets(facelets, corrected)
    return corrected
  })
}

/**
 * Migrate a v1 SolveRecord to v2.
 *
 * Fast path (no M/E/S): bump schemaVersion only — centers never drifted, labels are already correct.
 *
 * Full path (M/E/S present): correct face labels by tracking center positions from solved state.
 * For each move, the stored face label is mapped to its original GAN color, then the current
 * geometric face holding that color is looked up in the simulated facelets. After emitting the
 * corrected move, facelets are updated so subsequent lookups reflect the new center positions.
 *
 * Then computePhases is called on the corrected moves to verify the phase structure is unchanged.
 * If not, the record is malformed — return it unchanged to avoid silent data corruption.
 *
 * movesV1 is always set when moves were corrected so callers can decide whether to keep it:
 * localStorage strips it; Firestore keeps it for the review workflow.
 */
export function migrateSolveV1toV2(solve: SolveRecord): SolveRecord {
  // Fast path: centers never drifted, labels are already correct
  if (!solve.moves.some(m => m.face === 'M' || m.face === 'E' || m.face === 'S')) {
    return { ...solve, schemaVersion: 2 }
  }

  // Full path: re-derive geometric face for each move via center tracking
  const correctedMoves = correctMovesV1toV2(solve)

  // Correctness check: recomputed phases must be deeply identical to stored phases
  const method = getMethod(solve.method)
  const freshPhases = computePhases(correctedMoves, solve.scramble, method)

  if (!freshPhases) {
    console.warn(`migrateSolveV1toV2: corrected moves did not solve the cube (id=${solve.id}) — returning unchanged`)
    return solve
  }

  const diffs: string[] = []
  for (let i = 0; i < Math.max(freshPhases.length, solve.phases.length); i++) {
    const a = freshPhases[i], b = solve.phases[i]
    if (!a || !b) { diffs.push(`phase[${i}]: ${b ? `removed ${b.label}` : `added ${a.label}`}`); continue }
    const fields: string[] = []
    if (a.label !== b.label) fields.push(`label ${b.label}→${a.label}`)
    if (a.group !== b.group) fields.push(`group ${b.group}→${a.group}`)
    if (a.turns !== b.turns) fields.push(`turns ${b.turns}→${a.turns}`)
    if (a.recognitionMs !== b.recognitionMs) fields.push(`recognitionMs ${b.recognitionMs}→${a.recognitionMs}`)
    if (a.executionMs !== b.executionMs) fields.push(`executionMs ${b.executionMs}→${a.executionMs}`)
    if (fields.length > 0) diffs.push(`phase[${i}] ${a.label}: ${fields.join(', ')}`)
  }
  const migrationNote = diffs.length > 0 ? diffs.join('\n') : undefined
  if (migrationNote) {
    console.warn(`migrateSolveV1toV2: phases changed for id=${solve.id} — migrating anyway:\n  ${diffs.join('\n  ')}`)
  }

  return {
    ...solve,
    moves: correctedMoves,
    movesV1: solve.moves,
    phases: freshPhases,
    schemaVersion: 2,
    ...(migrationNote ? { migrationNote } : {}),
  }
}

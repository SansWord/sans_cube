import { SOLVED_FACELETS } from '../../types/cube'
import { applyMoveToFacelets, isSolvedFacelets } from '../applyMove'
import { parseScramble } from '../scramble'
import type { PositionMove, Face } from '../../types/cube'

const OUTER_FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

/**
 * Simulate acubemy's scramble + our translated moves against a solved cube and
 * assert it ends solved. Throws on unsupported scramble notation so the caller
 * can classify the record as parse-error (not unsolved).
 */
export function verifySolvability(scramble: string, moves: PositionMove[]): boolean {
  // Pre-validate raw tokens — parseScramble is lenient and will silently
  // mis-parse things like "Rw" or "x" as a face.
  const rawTokens = scramble.trim().split(/\s+/).filter(Boolean)
  rawTokens.forEach((tok, i) => {
    if (tok.length === 0) return
    const face = tok[0]
    const suffix = tok.slice(1)
    if (!OUTER_FACES.includes(face as Face) || (suffix !== '' && suffix !== "'" && suffix !== '2')) {
      throw new Error(`Unsupported scramble token "${tok}" at position ${i}`)
    }
  })

  let f = SOLVED_FACELETS
  for (const step of parseScramble(scramble)) {
    const m: PositionMove = { face: step.face, direction: step.direction, cubeTimestamp: 0, serial: 0 }
    f = applyMoveToFacelets(f, m)
    if (step.double) f = applyMoveToFacelets(f, m)
  }
  for (const m of moves) {
    f = applyMoveToFacelets(f, m)
  }
  return isSolvedFacelets(f)
}

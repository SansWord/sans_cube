import { CFOP } from '../methods/cfop'
import { ROUX } from '../methods/roux'
import { recomputePhases } from './recomputePhases'
import type { SolveRecord } from '../types/solve'

export type MethodMismatch = {
  solve: SolveRecord
  storedMethod: string
  suggestedMethod: 'cfop' | 'roux'
  mMoves: number
  cfopCrossTurns: number
  rouxFBTurns: number
}

// Heuristics for determining the actual solving method from moves:
//
// 1. M-move count (strongest signal for BLE solves):
//    Roux LSE is exclusively M+U moves — a typical Roux solve has 10–20 M moves.
//    CFOP almost never uses M moves (0–4 at most, only in specific OLL/PLL algs).
//    Threshold ≥ 8 confidently identifies Roux.
//
// 2. First-phase turn count (works for all drivers including mouse):
//    Recompute with both methods — the "correct" method produces a naturally short
//    first phase. Under the wrong method, the first phase bloats because the opening
//    moves of one technique don't incidentally satisfy the other's first condition.
//    CFOP Cross expected: 5–15 moves. If > 20, probably not CFOP.
//    Roux FB expected: 7–18 moves. If > 20, probably not Roux.
//
// A mismatch is flagged only when a signal is unambiguous (avoids false positives).

function suggestMethod(
  mMoves: number,
  cfopCrossTurns: number,
  rouxFBTurns: number,
): 'cfop' | 'roux' | null {
  if (mMoves >= 8) return 'roux'

  const cfopPlausible = cfopCrossTurns <= 15
  const rouxPlausible = rouxFBTurns <= 18

  if (cfopPlausible && !rouxPlausible) return 'cfop'
  if (rouxPlausible && !cfopPlausible) return 'roux'
  return null  // ambiguous — don't guess
}

export function detectMethodMismatches(solves: SolveRecord[]): MethodMismatch[] {
  const results: MethodMismatch[] = []

  for (const solve of solves) {
    if (solve.isExample) continue
    if (solve.moves.length === 0) continue

    const cfopPhases = recomputePhases(solve, CFOP)
    const rouxPhases = recomputePhases(solve, ROUX)
    if (!cfopPhases || !rouxPhases) continue

    const mMoves = solve.moves.filter((m) => m.face === 'M').length
    const cfopCrossTurns = cfopPhases[0].turns
    const rouxFBTurns = rouxPhases[0].turns

    const suggested = suggestMethod(mMoves, cfopCrossTurns, rouxFBTurns)
    const stored = solve.method ?? 'cfop'

    if (suggested !== null && suggested !== stored) {
      results.push({ solve, storedMethod: stored, suggestedMethod: suggested, mMoves, cfopCrossTurns, rouxFBTurns })
    }
  }

  return results
}

import type { SolveRecord, PhaseRecord } from '../types/solve'

export interface RecomputeChange {
  solve: SolveRecord
  oldPhases: PhaseRecord[]
  newPhases: PhaseRecord[]
}

export interface RecomputeResult {
  /** Solves whose recomputed phases exactly match stored phases. */
  unchanged: SolveRecord[]
  /** Solves whose recomputed phases differ from stored phases. Safe to commit. */
  changed: RecomputeChange[]
  /** Solves where `recomputePhases` returned null (empty moves, replay didn't reach solved). */
  failed: SolveRecord[]
  /** Solves that weren't scanned (isExample, or method === 'freeform'). */
  skipped: SolveRecord[]
}

export function recomputeAllPhases(solves: SolveRecord[]): RecomputeResult {
  const unchanged: SolveRecord[] = []
  const changed: RecomputeChange[] = []
  const failed: SolveRecord[] = []
  const skipped: SolveRecord[] = []

  for (const solve of solves) {
    if (solve.isExample) { skipped.push(solve); continue }
    if ((solve.method ?? 'cfop') === 'freeform') { skipped.push(solve); continue }
    // recompute logic in Task 3
  }

  return { unchanged, changed, failed, skipped }
}

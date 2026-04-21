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

export function recomputeAllPhases(_solves: SolveRecord[]): RecomputeResult {
  return { unchanged: [], changed: [], failed: [], skipped: [] }
}

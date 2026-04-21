import { recomputePhases } from './recomputePhases'
import { getMethod } from '../methods'
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

function phasesEqual(a: PhaseRecord[], b: PhaseRecord[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label) return false
    if (a[i].group !== b[i].group) return false
    if (a[i].recognitionMs !== b[i].recognitionMs) return false
    if (a[i].executionMs !== b[i].executionMs) return false
    if (a[i].turns !== b[i].turns) return false
  }
  return true
}

export function recomputeAllPhases(solves: SolveRecord[]): RecomputeResult {
  const unchanged: SolveRecord[] = []
  const changed: RecomputeChange[] = []
  const failed: SolveRecord[] = []
  const skipped: SolveRecord[] = []

  for (const solve of solves) {
    if (solve.isExample) { skipped.push(solve); continue }
    const methodId = solve.method ?? 'cfop'
    if (methodId === 'freeform') { skipped.push(solve); continue }

    const method = getMethod(methodId)
    const newPhases = recomputePhases(solve, method)
    if (newPhases === null) { failed.push(solve); continue }

    if (phasesEqual(solve.phases, newPhases)) {
      unchanged.push(solve)
    } else {
      changed.push({ solve, oldPhases: solve.phases, newPhases })
    }
  }

  return { unchanged, changed, failed, skipped }
}

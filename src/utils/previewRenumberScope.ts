import type { SolveRecord } from '../types/solve'

export interface RenumberScope {
  totalCount: number
  firstMismatchIndex: number
  firstMismatchSolve: SolveRecord | null
  renumberedCount: number
}

export function previewRenumberScope(solves: SolveRecord[]): RenumberScope {
  const sorted = [...solves].sort((a, b) => a.date - b.date)
  const totalCount = sorted.length
  const firstMismatchIndex = sorted.findIndex((s, i) => s.seq !== i + 1)
  if (firstMismatchIndex === -1) {
    return { totalCount, firstMismatchIndex: -1, firstMismatchSolve: null, renumberedCount: 0 }
  }
  let renumberedCount = 0
  for (let i = firstMismatchIndex; i < sorted.length; i++) {
    if (sorted[i].seq !== i + 1) renumberedCount++
  }
  return {
    totalCount,
    firstMismatchIndex,
    firstMismatchSolve: sorted[firstMismatchIndex],
    renumberedCount,
  }
}

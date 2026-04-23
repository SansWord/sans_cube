import { useSyncExternalStore } from 'react'
import { solveStore } from '../stores/solveStore'
import type { StoreState } from '../stores/solveStore'
import { EXAMPLE_SOLVES } from '../data/exampleSolves'
import type { SolveRecord } from '../types/solve'

export function getAllSolves(state: StoreState): SolveRecord[] {
  const visibleExamples = EXAMPLE_SOLVES.filter(e => !state.dismissedExamples.has(e.id))
  return [...visibleExamples, ...state.solves]
}

export function useSolveStore() {
  const state = useSyncExternalStore(solveStore.subscribe, solveStore.getSnapshot, solveStore.getSnapshot)
  const solves = getAllSolves(state)
  const cloudLoading = state.status === 'loading'

  if (import.meta.env.DEV) {
    (window as unknown as { __solves: SolveRecord[]; __solveState: StoreState }).__solves = solves
    ;(window as unknown as { __solves: SolveRecord[]; __solveState: StoreState }).__solveState = state
  }

  return {
    solves,
    addSolve:       solveStore.addSolve.bind(solveStore),
    updateSolve:    solveStore.updateSolve.bind(solveStore),
    deleteSolve:    solveStore.deleteSolve.bind(solveStore),
    addMany:        solveStore.addMany.bind(solveStore),
    nextSolveIds:   solveStore.nextSolveIds.bind(solveStore),
    reload:         solveStore.reload.bind(solveStore),
    runBulkOp:      solveStore.runBulkOp.bind(solveStore),
    dismissExample: solveStore.dismissExample.bind(solveStore),
    reloadLocal:    solveStore.reloadLocal.bind(solveStore),
    status:         state.status,
    error:          state.error,
    cloudReady:     state.cloudReady,
    cloudLoading,
  }
}

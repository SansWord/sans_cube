import type { User } from 'firebase/auth'
import type { SolveRecord } from '../types/solve'

export interface CloudConfig {
  enabled: boolean
  user: User | null
  authLoading?: boolean
}

export type Status = 'idle' | 'loading' | 'refreshing' | 'error'

export interface StoreState {
  solves: SolveRecord[]
  dismissedExamples: Set<number>
  status: Status
  error: string | null
  cloudReady: boolean
}

function initialState(): StoreState {
  return {
    solves: [],
    dismissedExamples: new Set<number>(),
    status: 'idle',
    error: null,
    cloudReady: false,
  }
}

let state: StoreState = initialState()
const listeners = new Set<() => void>()

function notify(): void {
  for (const l of listeners) l()
}

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch }
  notify()
}

export const solveStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getSnapshot(): StoreState {
    return state
  },
}

export function __resetForTests(): void {
  state = initialState()
  listeners.clear()
}

// HMR: when this module hot-reloads, wipe state so stale closures don't stick around.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { __resetForTests() })
}

// Internal setState — exported for implementation files in later tasks.
export const _internal = { setState, notify }

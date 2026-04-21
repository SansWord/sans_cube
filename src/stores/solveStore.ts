import type { User } from 'firebase/auth'
import type { SolveRecord } from '../types/solve'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { migrateSolveV1toV2 } from '../utils/migrateSolveV1toV2'
import {
  loadSolvesFromFirestore,
  loadNextSeqFromFirestore,
  migrateLocalSolvesToFirestore,
} from '../services/firestoreSolves'

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

function loadLocalSolves(): SolveRecord[] {
  const raw = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
  const migrated = raw.map(s => {
    if ((s.schemaVersion ?? 1) < 2) {
      const result = migrateSolveV1toV2(s)
      const { movesV1: _, ...toSave } = result
      return toSave
    }
    return s
  })
  if (migrated.some((s, i) => s !== raw[i])) {
    saveToStorage(STORAGE_KEYS.SOLVES, migrated)
  }
  return migrated
}

function loadDismissedExamples(): Set<number> {
  return new Set(loadFromStorage<number[]>(STORAGE_KEYS.DISMISSED_EXAMPLES, []))
}

const migratedUids = new Set<string>()
let nextId: number = 1
let activeLoadToken = 0

function loadNextId(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NEXT_ID)
    return raw ? Math.max(1, parseInt(raw, 10)) : 1
  } catch {
    return 1
  }
}

function saveNextId(id: number): void {
  localStorage.setItem(STORAGE_KEYS.NEXT_ID, String(id))
}

async function doCloudLoad(uid: string, localSolves: SolveRecord[], token: number): Promise<void> {
  if (!migratedUids.has(uid) && localSolves.length > 0) {
    migratedUids.add(uid)
    await migrateLocalSolvesToFirestore(uid, localSolves)
  }
  const [solves, nextSeq] = await Promise.all([
    loadSolvesFromFirestore(uid),
    loadNextSeqFromFirestore(uid),
  ])
  if (token !== activeLoadToken) return
  if (nextSeq > nextId) {
    nextId = nextSeq
    saveNextId(nextId)
  }
  setState({ solves, status: 'idle', cloudReady: true, error: null })
}

let lastConfigKey: string | null = null

function configKey(config: CloudConfig): string {
  // enabled:true + user:null collapses to the same key as enabled:false — both use local path.
  const enabled = !!(config.enabled && config.user)
  return `${enabled ? '1' : '0'}:${config.user?.uid ?? ''}`
}

export const solveStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getSnapshot(): StoreState {
    return state
  },
  configure(config: CloudConfig): void {
    const key = configKey(config)
    if (key === lastConfigKey) return
    lastConfigKey = key

    const useCloud = !!(config.enabled && config.user)
    const localSolves = loadLocalSolves()
    const dismissedExamples = loadDismissedExamples()
    nextId = Math.max(
      loadNextId(),
      localSolves.length > 0 ? Math.max(...localSolves.map(s => s.seq ?? s.id)) + 1 : 1,
    )

    if (!useCloud) {
      activeLoadToken++
      setState({ solves: localSolves, dismissedExamples, status: 'idle', error: null, cloudReady: false })
      return
    }

    const uid = config.user!.uid
    activeLoadToken++
    const token = activeLoadToken
    setState({ solves: localSolves, dismissedExamples, status: 'loading', error: null, cloudReady: false })
    doCloudLoad(uid, localSolves, token).catch((e) => {
      if (token !== activeLoadToken) return
      setState({ status: 'error', error: String(e) })
    })
  },
}

export function __resetForTests(): void {
  state = initialState()
  listeners.clear()
  lastConfigKey = null
  migratedUids.clear()
  nextId = 1
  activeLoadToken = 0
}

// HMR: when this module hot-reloads, wipe state so stale closures don't stick around.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { __resetForTests() })
}

// Internal setState — exported for implementation files in later tasks.
export const _internal = { setState, notify }

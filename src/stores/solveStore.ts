import type { User } from 'firebase/auth'
import type { SolveRecord } from '../types/solve'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { migrateSolveV1toV2 } from '../utils/migrateSolveV1toV2'
import {
  loadSolvesFromFirestore,
  loadNextSeqFromFirestore,
  migrateLocalSolvesToFirestore,
  addSolveToFirestore,
  updateSolveInFirestore,
  deleteSolveFromFirestore,
  updateCounterInFirestore,
} from '../services/firestoreSolves'
import { updateSharedSolve } from '../services/firestoreSharing'

export interface CloudConfig {
  enabled: boolean
  user: User | null
  authLoading?: boolean
}

export interface AddManyResult {
  committed: SolveRecord[]
  failed: Array<{ draft: SolveRecord; error: Error }>
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

async function reloadInternal(): Promise<void> {
  const uid = lastCloudConfig?.user?.uid ?? null
  const useCloud = !!(lastCloudConfig?.enabled && uid)
  if (!useCloud || !uid) return
  activeLoadToken++
  const token = activeLoadToken
  const [solves, nextSeq] = await Promise.all([
    loadSolvesFromFirestore(uid),
    loadNextSeqFromFirestore(uid),
  ])
  if (token !== activeLoadToken) return
  if (nextSeq > nextId) {
    nextId = nextSeq
    saveNextId(nextId)
  }
  setState({ solves, cloudReady: true, error: null })
}

let lastConfigKey: string | null = null
let lastCloudConfig: CloudConfig | null = null

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
    lastCloudConfig = config
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

  nextSolveIds(): { id: number; seq: number } {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const seq = nextId
    nextId = seq + 1
    saveNextId(nextId)
    return { id: useCloud ? Date.now() : seq, seq }
  },

  dismissExample(id: number): void {
    const dismissedExamples = new Set(state.dismissedExamples)
    dismissedExamples.add(id)
    saveToStorage(STORAGE_KEYS.DISMISSED_EXAMPLES, [...dismissedExamples])
    setState({ dismissedExamples })
  },

  async addSolve(solve: SolveRecord): Promise<void> {
    if (solve.isExample) { console.warn('solveStore.addSolve called with example solve; ignored'); return }
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null
    const snapshot = state.solves
    setState({ solves: [...snapshot, solve] })
    try {
      if (useCloud && uid) {
        const nextSeq = (solve.seq ?? 0) + 1
        await Promise.all([
          addSolveToFirestore(uid, solve),
          updateCounterInFirestore(uid, nextSeq),
        ])
      } else {
        saveToStorage(STORAGE_KEYS.SOLVES, [...snapshot, solve])
      }
      if (state.error) setState({ error: null })
    } catch (e) {
      setState({ solves: snapshot, error: String(e) })
      throw e
    }
  },

  async updateSolve(updated: SolveRecord): Promise<void> {
    if (updated.isExample) { console.warn('solveStore.updateSolve called with example solve; ignored'); return }
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null
    const snapshot = state.solves
    const next = snapshot.map(s => s.id === updated.id ? updated : s)
    setState({ solves: next })
    try {
      if (useCloud && uid) {
        await updateSolveInFirestore(uid, updated)
        if (updated.shareId) {
          void updateSharedSolve(updated.shareId, updated)
        }
      } else {
        saveToStorage(STORAGE_KEYS.SOLVES, next)
      }
      if (state.error) setState({ error: null })
    } catch (e) {
      setState({ solves: snapshot, error: String(e) })
      throw e
    }
  },

  async addMany(
    drafts: SolveRecord[],
    onProgress: (chunkDone: number, chunkTotal: number) => void = () => {},
  ): Promise<AddManyResult> {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null

    if (!useCloud || !uid) {
      const next = [...state.solves, ...drafts]
      setState({ solves: next })
      saveToStorage(STORAGE_KEYS.SOLVES, next)
      const maxSeq = Math.max(0, ...drafts.map(d => d.seq ?? 0))
      if (maxSeq + 1 > nextId) {
        nextId = maxSeq + 1
        saveNextId(nextId)
      }
      onProgress(1, 1)
      return { committed: [...drafts], failed: [] }
    }

    // Cloud path — optimistic append all, then chunk through setDoc with allSettled.
    const snapshot = state.solves
    setState({ solves: [...snapshot, ...drafts] })

    const CHUNK = 100
    const chunks: SolveRecord[][] = []
    for (let i = 0; i < drafts.length; i += CHUNK) chunks.push(drafts.slice(i, i + CHUNK))

    const failed: Array<{ draft: SolveRecord; error: Error }> = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const results = await Promise.allSettled(
        chunk.map(d => addSolveToFirestore(uid, d))
      )
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        if (r.status === 'rejected') {
          failed.push({ draft: chunk[j], error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)) })
        }
      }
      onProgress(i + 1, chunks.length)
    }

    // Update counter to the max seq we intended to commit.
    const maxSeq = Math.max(0, ...drafts.map(d => d.seq ?? 0))
    try {
      await updateCounterInFirestore(uid, maxSeq + 1)
    } catch {
      // Counter write is best-effort; per-solve writes already reflect reality.
    }

    // Roll back failed drafts: rebuild from pre-optimistic snapshot + committed solves.
    const failedIds = new Set(failed.map(f => f.draft.id))
    const committed = drafts.filter(d => !failedIds.has(d.id))
    if (failed.length > 0) {
      setState({ solves: [...snapshot, ...committed] })
    }

    return { committed, failed }
  },

  async reload(): Promise<void> {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    if (!useCloud) return
    setState({ status: 'refreshing', error: null })
    try {
      await reloadInternal()
      setState({ status: 'idle' })
    } catch (e) {
      setState({ status: 'error', error: String(e) })
      throw e
    }
  },

  async runBulkOp<T>(fn: () => Promise<T>): Promise<T> {
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    setState({ status: 'refreshing', error: null })
    try {
      const result = await fn()
      if (useCloud) await reloadInternal()
      setState({ status: 'idle' })
      return result
    } catch (e) {
      setState({ status: 'error', error: String(e) })
      throw e
    }
  },

  reloadLocal(): void {
    if (lastCloudConfig?.enabled && lastCloudConfig?.user) return
    setState({ solves: loadLocalSolves() })
  },

  async deleteSolve(id: number): Promise<void> {
    if (id < 0) { solveStore.dismissExample(id); return }
    const useCloud = !!(lastCloudConfig?.enabled && lastCloudConfig?.user)
    const uid = lastCloudConfig?.user?.uid ?? null
    const snapshot = state.solves
    const target = snapshot.find(s => s.id === id)
    if (!target) return
    const next = snapshot.filter(s => s.id !== id)
    setState({ solves: next })
    try {
      if (useCloud && uid) {
        await deleteSolveFromFirestore(uid, target)
      } else {
        saveToStorage(STORAGE_KEYS.SOLVES, next)
      }
      if (state.error) setState({ error: null })
    } catch (e) {
      setState({ solves: snapshot, error: String(e) })
      throw e
    }
  },
}

export function __resetForTests(): void {
  state = initialState()
  listeners.clear()
  lastConfigKey = null
  lastCloudConfig = null
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

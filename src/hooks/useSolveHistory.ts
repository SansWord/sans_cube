import { useState, useCallback, useRef, useEffect } from 'react'
import type { User } from 'firebase/auth'
import type { SolveRecord } from '../types/solve'
import { EXAMPLE_SOLVES } from '../data/exampleSolves'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { migrateSolveV1toV2 } from '../utils/migrateSolveV1toV2'
import {
  loadSolvesFromFirestore,
  addSolveToFirestore,
  deleteSolveFromFirestore,
  updateSolveInFirestore,
  migrateLocalSolvesToFirestore,
  loadNextSeqFromFirestore,
  updateCounterInFirestore,
} from '../services/firestoreSolves'
import { updateSharedSolve } from '../services/firestoreSharing'

// Re-export for back-compat during the solveStore migration; will be removed in a later task.
export { computeAo, computeStats, filterSolves } from '../utils/solveStats'
export type { StatEntry, SolveStats } from '../utils/solveStats'

export interface CloudConfig {
  enabled: boolean
  user: User | null
  authLoading?: boolean
}

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

function loadLocalSolves(): SolveRecord[] {
  return loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
}

function saveLocalSolves(solves: SolveRecord[]): void {
  saveToStorage(STORAGE_KEYS.SOLVES, solves)
}

function loadDismissedExamples(): Set<number> {
  return new Set(loadFromStorage<number[]>(STORAGE_KEYS.DISMISSED_EXAMPLES, []))
}

function dismissExample(id: number): void {
  const dismissed = loadDismissedExamples()
  dismissed.add(id)
  saveToStorage(STORAGE_KEYS.DISMISSED_EXAMPLES, [...dismissed])
}


export function useSolveHistory(cloudConfig?: CloudConfig) {
  const useCloud = !!(cloudConfig?.enabled && cloudConfig?.user)
  const uid = cloudConfig?.user?.uid ?? null

  // localStorage state (always initialized, used when cloud is off)
  const [localSolves, setLocalSolves] = useState<SolveRecord[]>(() => {
    const raw = loadLocalSolves()
    const migrated = raw.map(s => {
      if ((s.schemaVersion ?? 1) < 2) {
        const result = migrateSolveV1toV2(s)
        const { movesV1: _, ...toSave } = result  // strip movesV1 — no review for localStorage
        return toSave
      }
      return s
    })
    if (migrated.some((s, i) => s !== raw[i])) {
      saveLocalSolves(migrated)
    }
    return migrated
  })
  const [dismissedExamples, setDismissedExamples] = useState<Set<number>>(() => loadDismissedExamples())

  // Cloud state
  const [cloudSolves, setCloudSolves] = useState<SolveRecord[]>([])
  const [cloudReady, setCloudReady] = useState(false)
  const migratedRef = useRef(false)

  // Sequential ID counter (for localStorage mode)
  const nextIdRef = useRef(Math.max(
    loadNextId(),
    localSolves.length > 0 ? Math.max(...localSolves.map(s => s.id)) + 1 : 1
  ))

  // Load from Firestore when cloud is enabled
  useEffect(() => {
    if (!useCloud || !uid) {
      setCloudReady(false)
      return
    }

    const doLoad = async () => {
      if (!migratedRef.current && localSolves.length > 0) {
        migratedRef.current = true
        await migrateLocalSolvesToFirestore(uid, localSolves)
      }
      const [solves, nextSeq] = await Promise.all([
        loadSolvesFromFirestore(uid),
        loadNextSeqFromFirestore(uid),
      ])
      if (nextSeq > nextIdRef.current) {
        nextIdRef.current = nextSeq
        saveNextId(nextIdRef.current)
      }
      setCloudSolves(solves)
      setCloudReady(true)
    }

    doLoad()
  }, [useCloud, uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextSolveIds = useCallback((): { id: number; seq: number } => {
    const seq = nextIdRef.current
    nextIdRef.current = seq + 1
    saveNextId(nextIdRef.current)
    const id = useCloud ? Date.now() : seq
    return { id, seq }
  }, [useCloud])

  const addSolve = useCallback((solve: SolveRecord) => {
    if (useCloud && uid) {
      setCloudSolves((prev) => [...prev, solve])
      const nextSeq = (solve.seq ?? 0) + 1
      void Promise.all([
        addSolveToFirestore(uid, solve),
        updateCounterInFirestore(uid, nextSeq),
      ])
    } else {
      setLocalSolves((prev) => {
        const next = [...prev, solve]
        saveLocalSolves(next)
        return next
      })
    }
  }, [useCloud, uid])

  const updateSolve = useCallback(async (updated: SolveRecord): Promise<void> => {
    if (useCloud && uid) {
      setCloudSolves((prev) => prev.map((s) => s.id === updated.id ? updated : s))
      await updateSolveInFirestore(uid, updated)
      if (updated.shareId) {
        void updateSharedSolve(updated.shareId, updated)
      }
    } else {
      setLocalSolves((prev) => {
        const next = prev.map((s) => s.id === updated.id ? updated : s)
        saveLocalSolves(next)
        return next
      })
    }
  }, [useCloud, uid])

  const deleteSolve = useCallback((id: number) => {
    if (id < 0) {
      dismissExample(id)
      setDismissedExamples((prev) => new Set([...prev, id]))
      return
    }
    if (useCloud && uid) {
      setCloudSolves((prev) => {
        const solve = prev.find((s) => s.id === id)
        if (solve) deleteSolveFromFirestore(uid, solve)
        return prev.filter((s) => s.id !== id)
      })
    } else {
      setLocalSolves((prev) => {
        const next = prev.filter((s) => s.id !== id)
        saveLocalSolves(next)
        return next
      })
    }
  }, [useCloud, uid])

  // Show loading whenever cloud sync is enabled and data isn't ready yet:
  // covers auth-pending (no user yet) AND the gap between auth resolving and Firestore returning
  const isCloudLoading = !!(cloudConfig?.enabled && (!cloudConfig?.user || !cloudReady))

  const solves = isCloudLoading ? [] : (useCloud ? cloudSolves : localSolves)
  const visibleExamples = isCloudLoading ? [] : EXAMPLE_SOLVES.filter((e) => !dismissedExamples.has(e.id))
  const allSolves = [...visibleExamples, ...solves]
  return { solves: allSolves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading: isCloudLoading }
}

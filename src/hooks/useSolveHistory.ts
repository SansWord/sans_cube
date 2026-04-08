import { useState, useCallback, useRef, useEffect } from 'react'
import type { User } from 'firebase/auth'
import type { SolveRecord } from '../types/solve'
import { EXAMPLE_SOLVES } from '../data/exampleSolves'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import {
  loadSolvesFromFirestore,
  addSolveToFirestore,
  deleteSolveFromFirestore,
  migrateLocalSolvesToFirestore,
} from '../services/firestoreSolves'

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

// Exported for tests
export function computeAo(solves: SolveRecord[], n: number): number | null {
  if (solves.length < n) return null
  const slice = solves.slice(solves.length - n)
  if (n <= 4) {
    return slice.reduce((sum, s) => sum + s.timeMs, 0) / n
  }
  const times = slice.map((s) => s.timeMs).sort((a, b) => a - b)
  const trimmed = times.slice(1, -1)
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
}

function bestAo(solves: SolveRecord[], n: number): number | null {
  if (solves.length < n) return null
  let best: number | null = null
  for (let i = n; i <= solves.length; i++) {
    const ao = computeAo(solves.slice(0, i), n)
    if (ao !== null && (best === null || ao < best)) best = ao
  }
  return best
}

interface StatEntry {
  current: number | null
  best: number | null
}

interface SolveStats {
  single: StatEntry
  ao5: StatEntry
  ao12: StatEntry
  ao100: StatEntry
}

// Exported for tests
export function computeStats(solves: SolveRecord[]): SolveStats {
  const single: StatEntry = {
    current: solves.length > 0 ? solves[solves.length - 1].timeMs : null,
    best: solves.length > 0 ? Math.min(...solves.map((s) => s.timeMs)) : null,
  }
  return {
    single,
    ao5:   { current: computeAo(solves, 5),   best: bestAo(solves, 5) },
    ao12:  { current: computeAo(solves, 12),  best: bestAo(solves, 12) },
    ao100: { current: computeAo(solves, 100), best: bestAo(solves, 100) },
  }
}

export function useSolveHistory(cloudConfig?: CloudConfig) {
  const useCloud = !!(cloudConfig?.enabled && cloudConfig?.user)
  const uid = cloudConfig?.user?.uid ?? null

  // localStorage state (always initialized, used when cloud is off)
  const [localSolves, setLocalSolves] = useState<SolveRecord[]>(() => loadLocalSolves())
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

    // Migrate localStorage solves on first enable (only once per session)
    const doLoad = async () => {
      if (!migratedRef.current && localSolves.length > 0) {
        migratedRef.current = true
        await migrateLocalSolvesToFirestore(uid, localSolves)
      }
      const solves = await loadSolvesFromFirestore(uid)
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
      addSolveToFirestore(uid, solve)
    } else {
      setLocalSolves((prev) => {
        const next = [...prev, solve]
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
  const stats = computeStats(solves)

  return { solves: allSolves, addSolve, deleteSolve, stats, nextSolveIds, cloudLoading: isCloudLoading }
}

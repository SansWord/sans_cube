import { useState, useCallback, useRef } from 'react'
import type { SolveRecord } from '../types/solve'

const STORAGE_KEY = 'sans_cube_solves'
const COUNTER_KEY = 'sans_cube_next_id'

function loadNextId(): number {
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    return raw ? Math.max(1, parseInt(raw, 10)) : 1
  } catch {
    return 1
  }
}

function saveNextId(id: number): void {
  localStorage.setItem(COUNTER_KEY, String(id))
}

function loadSolves(): SolveRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SolveRecord[]) : []
  } catch {
    return []
  }
}

function saveSolves(solves: SolveRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solves))
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

export function useSolveHistory() {
  const [solves, setSolves] = useState<SolveRecord[]>(() => loadSolves())
  const nextIdRef = useRef(Math.max(
    loadNextId(),
    solves.length > 0 ? Math.max(...solves.map(s => s.id)) + 1 : 1
  ))

  const nextId = useCallback((): number => {
    const id = nextIdRef.current
    nextIdRef.current = id + 1
    saveNextId(nextIdRef.current)
    return id
  }, [])

  const addSolve = useCallback((solve: SolveRecord) => {
    setSolves((prev) => {
      const next = [...prev, solve]
      saveSolves(next)
      return next
    })
  }, [])

  const deleteSolve = useCallback((id: number) => {
    setSolves((prev) => {
      const next = prev.filter((s) => s.id !== id)
      saveSolves(next)
      return next
    })
  }, [])

  const stats = computeStats(solves)

  return { solves, addSolve, deleteSolve, stats, nextId }
}

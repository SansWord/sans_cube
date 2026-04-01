import { useState, useCallback } from 'react'
import type { SolveRecord } from '../types/solve'

const STORAGE_KEY = 'sans_cube_solves'

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

  return { solves, addSolve, deleteSolve, stats }
}

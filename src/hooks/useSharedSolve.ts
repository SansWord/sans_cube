import { useState, useEffect, useCallback } from 'react'
import type { SolveRecord } from '../types/solve'
import { loadSharedSolve, SHARE_ID_RE } from '../services/firestoreSharing'
import { logSharedSolveViewed } from '../services/analytics' // used inside doLoad for boot-only analytics

export interface UseSharedSolveResult {
  sharedSolve: SolveRecord | null
  sharedSolveLoading: boolean
  sharedSolveNotFound: boolean
  clearSharedSolve: () => void
}

export function useSharedSolve(): UseSharedSolveResult {
  const [sharedSolve, setSharedSolve] = useState<SolveRecord | null>(null)
  const [sharedSolveLoading, setSharedSolveLoading] = useState(false)
  const [sharedSolveNotFound, setSharedSolveNotFound] = useState(false)

  const showNotFound = useCallback(() => {
    setSharedSolveNotFound(true)
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setTimeout(() => setSharedSolveNotFound(false), 3000)
  }, [])

  const doLoad = useCallback((shareId: string, logAnalytics = false) => {
    if (!SHARE_ID_RE.test(shareId)) { showNotFound(); return }
    if (logAnalytics) logSharedSolveViewed(shareId)
    setSharedSolveLoading(true)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    void Promise.race([loadSharedSolve(shareId).catch(() => null), timeout]).then((solve) => {
      setSharedSolveLoading(false)
      if (solve) {
        setSharedSolve(solve)
        // Restore the hash — the URL-update effect in TimerScreen may have cleared it while the fetch was in flight
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}#shared-${shareId}`)
      } else {
        showNotFound()
      }
    })
  }, [showNotFound])

  // Boot: resolve #shared-{shareId} on mount
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#shared-')) return
    const shareId = hash.replace('#shared-', '')
    doLoad(shareId, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Hashchange: handle navigation to a #shared- URL
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash
      if (!hash.startsWith('#shared-')) return
      const shareId = hash.replace('#shared-', '')
      doLoad(shareId)
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [doLoad])

  const clearSharedSolve = useCallback(() => {
    setSharedSolve(null)
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  return { sharedSolve, sharedSolveLoading, sharedSolveNotFound, clearSharedSolve }
}

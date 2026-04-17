import { useState, useEffect, useCallback, useRef } from 'react'
import type { SolveRecord } from '../types/solve'
import { loadSharedSolve, SHARE_ID_RE } from '../services/firestoreSharing'
import { logSharedSolveViewed } from '../services/analytics' // used inside doLoad for boot-only analytics
import type { Route } from './useHashRouter'

export interface UseSharedSolveResult {
  sharedSolve: SolveRecord | null
  sharedSolveLoading: boolean
  sharedSolveNotFound: boolean
  clearSharedSolve: () => void
}

export function useSharedSolve(currentRoute: Route): UseSharedSolveResult {
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
      } else {
        showNotFound()
      }
    })
  }, [showNotFound])

  const isBootRef = useRef(true)

  useEffect(() => {
    if (currentRoute.type !== 'shared') return
    const logAnalytics = isBootRef.current
    isBootRef.current = false
    doLoad(currentRoute.shareId, logAnalytics)
  }, [currentRoute, doLoad])

  const clearSharedSolve = useCallback(() => {
    setSharedSolve(null)
  }, [])

  return { sharedSolve, sharedSolveLoading, sharedSolveNotFound, clearSharedSolve }
}

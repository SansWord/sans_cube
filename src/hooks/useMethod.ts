import { useState, useCallback } from 'react'
import type { SolveMethod } from '../types/solve'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { getMethod } from '../methods/index'

export function useMethod(): { method: SolveMethod; setMethod: (m: SolveMethod) => void } {
  const [method, setMethodState] = useState<SolveMethod>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.METHOD)
    return getMethod(saved ?? undefined)
  })

  const setMethod = useCallback((m: SolveMethod) => {
    localStorage.setItem(STORAGE_KEYS.METHOD, m.id)
    setMethodState(m)
  }, [])

  return { method, setMethod }
}

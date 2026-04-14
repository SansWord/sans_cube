import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver, EventMap } from '../drivers/CubeDriver'

/**
 * Registers a typed event handler on a CubeDriver and cleans it up on unmount
 * or when driverVersion changes (indicating a reconnect).
 *
 * Uses a ref to hold the handler so it always calls the latest version
 * without re-registering on every render. No useCallback required at call sites.
 */
export function useCubeDriverEvent<K extends keyof EventMap>(
  driver: MutableRefObject<CubeDriver | null>,
  event: K,
  handler: (payload: EventMap[K]) => void,
  driverVersion = 0,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const fn = (payload: EventMap[K]) => handlerRef.current(payload)
    d.on(event, fn)
    return () => d.off(event, fn)
  }, [driver, driverVersion, event]) // eslint-disable-line react-hooks/exhaustive-deps
}

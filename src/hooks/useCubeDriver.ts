import { useRef, useState, useCallback } from 'react'
import { GanCubeDriver } from '../drivers/GanCubeDriver'
import type { CubeDriver, ConnectionStatus } from '../drivers/CubeDriver'

export function useCubeDriver() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')

  // Initialize eagerly so driver.current is non-null on first render.
  // Lazy init (inside a callback) caused all hooks' useEffects to find null,
  // bail out, and never re-subscribe when the driver was eventually created.
  const driverRef = useRef<CubeDriver | null>(null)
  if (driverRef.current === null) {
    const driver = new GanCubeDriver()
    driver.on('connection', setStatus)
    driverRef.current = driver
  }

  const connect = useCallback(async () => {
    await driverRef.current!.connect()
  }, [])

  const disconnect = useCallback(async () => {
    await driverRef.current!.disconnect()
  }, [])

  return { driver: driverRef, connect, disconnect, status }
}

import { useRef, useState, useCallback } from 'react'
import { GanCubeDriver } from '../drivers/GanCubeDriver'
import type { CubeDriver, ConnectionStatus } from '../drivers/CubeDriver'

export function useCubeDriver() {
  const driverRef = useRef<CubeDriver | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')

  const getDriver = useCallback((): CubeDriver => {
    if (!driverRef.current) {
      const driver = new GanCubeDriver()
      driver.on('connection', setStatus)
      driverRef.current = driver
    }
    return driverRef.current
  }, [])

  const connect = useCallback(async () => {
    await getDriver().connect()
  }, [getDriver])

  const disconnect = useCallback(async () => {
    await getDriver().disconnect()
  }, [getDriver])

  return { driver: driverRef, connect, disconnect, status }
}

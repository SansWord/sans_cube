import { useRef, useState, useCallback } from 'react'
import { GanCubeDriver } from '../drivers/GanCubeDriver'
import { ButtonDriver } from '../drivers/ButtonDriver'
import type { CubeDriver, ConnectionStatus } from '../drivers/CubeDriver'

export type DriverType = 'gan' | 'button'

export function useCubeDriver() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [driverType, setDriverType] = useState<DriverType>('gan')
  const [driverVersion, setDriverVersion] = useState(0)

  const driverRef = useRef<CubeDriver | null>(null)
  if (driverRef.current === null) {
    const driver = new GanCubeDriver()
    driver.on('connection', setStatus)
    driverRef.current = driver
  }

  const switchDriver = useCallback((type: DriverType) => {
    const old = driverRef.current
    old?.removeAllListeners()
    old?.disconnect()

    const next = type === 'button' ? new ButtonDriver() : new GanCubeDriver()
    next.on('connection', setStatus)
    driverRef.current = next
    setDriverType(type)
    setStatus('disconnected')
    setDriverVersion((v) => v + 1)
  }, [])

  const connect = useCallback(async () => {
    await driverRef.current!.connect()
  }, [])

  const disconnect = useCallback(async () => {
    await driverRef.current!.disconnect()
  }, [])

  const buttonDriver = driverType === 'button' ? (driverRef.current as ButtonDriver) : null

  return { driver: driverRef, connect, disconnect, status, driverType, switchDriver, buttonDriver, driverVersion }
}

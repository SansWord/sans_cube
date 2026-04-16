import { useRef, useState, useCallback, useEffect } from 'react'
import { GanCubeDriver } from '../drivers/GanCubeDriver'
import { MouseDriver } from '../drivers/MouseDriver'
import { ColorMoveTranslator } from '../drivers/ColorMoveTranslator'
import type { CubeDriver, ConnectionStatus } from '../drivers/CubeDriver'

export type DriverType = 'cube' | 'mouse'

export function useCubeDriver() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [driverType, setDriverType] = useState<DriverType>('mouse')
  const [driverVersion, setDriverVersion] = useState(0)

  const driverRef = useRef<CubeDriver | null>(null)
  if (driverRef.current === null) {
    const driver = new MouseDriver()
    driver.on('connection', setStatus)
    driverRef.current = driver
  }

  // Auto-connect mouse driver on mount
  useEffect(() => {
    if (driverType === 'mouse') driverRef.current?.connect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const switchDriver = useCallback((type: DriverType) => {
    const old = driverRef.current
    old?.removeAllListeners()
    old?.disconnect()

    const next = type === 'mouse' ? new MouseDriver() : new ColorMoveTranslator(new GanCubeDriver())
    next.on('connection', setStatus)
    driverRef.current = next
    setDriverType(type)
    setStatus('disconnected')
    setDriverVersion((v) => v + 1)
    if (type === 'mouse') next.connect()
  }, [])

  const connect = useCallback(async () => {
    await driverRef.current!.connect()
  }, [])

  const disconnect = useCallback(async () => {
    await driverRef.current!.disconnect()
  }, [])

  return { driver: driverRef, connect, disconnect, status, driverType, switchDriver, driverVersion }
}

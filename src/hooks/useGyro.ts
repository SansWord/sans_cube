import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Quaternion, OrientationConfig } from '../types/cube'
import { IDENTITY_QUATERNION, applyReference } from '../utils/quaternion'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'

const DEFAULT_CONFIG: OrientationConfig = { frontFace: 'green', bottomFace: 'yellow', referenceQuaternion: null }

export function useGyro(driver: MutableRefObject<CubeDriver | null>, driverVersion = 0) {
  const [quaternion, setQuaternion] = useState(IDENTITY_QUATERNION)
  const [config, setConfig] = useState<OrientationConfig>(() => loadFromStorage(STORAGE_KEYS.ORIENTATION_CONFIG, DEFAULT_CONFIG))
  const latestRawQ = useRef(IDENTITY_QUATERNION)

  const reference = config.referenceQuaternion ?? IDENTITY_QUATERNION

  const resetGyro = useCallback(() => {
    const newConfig: OrientationConfig = { ...config, referenceQuaternion: latestRawQ.current }
    setConfig(newConfig)
    saveToStorage(STORAGE_KEYS.ORIENTATION_CONFIG, newConfig)
  }, [config])

  const saveOrientationConfig = useCallback((updates: Partial<OrientationConfig>) => {
    const newConfig: OrientationConfig = { ...config, ...updates }
    setConfig(newConfig)
    saveToStorage(STORAGE_KEYS.ORIENTATION_CONFIG, newConfig)
  }, [config])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onGyro = (q: Quaternion) => {
      latestRawQ.current = q
      setQuaternion(applyReference(q, reference))
    }
    d.on('gyro', onGyro)
    return () => d.off('gyro', onGyro)
  }, [driver, driverVersion, reference])

  return { quaternion, config, resetGyro, saveOrientationConfig }
}

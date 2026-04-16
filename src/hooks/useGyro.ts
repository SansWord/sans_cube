import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Quaternion, OrientationConfig } from '../types/cube'
import { IDENTITY_QUATERNION, applyReference, SLICE_GYRO_ROTATIONS, multiplyQuaternions } from '../utils/quaternion'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { useCubeDriverEvent } from './useCubeDriverEvent'

const DEFAULT_CONFIG: OrientationConfig = { frontFace: 'green', bottomFace: 'yellow', referenceQuaternion: null }

export function useGyro(driver: MutableRefObject<CubeDriver | null>, driverVersion = 0) {
  const [quaternion, setQuaternion] = useState(IDENTITY_QUATERNION)
  const [config, setConfig] = useState<OrientationConfig>(() => loadFromStorage(STORAGE_KEYS.ORIENTATION_CONFIG, DEFAULT_CONFIG))
  const latestRawQ = useRef(IDENTITY_QUATERNION)

  // Tracks the effective reference quaternion, updated when the user resets gyro
  // or when a M/E/S slice move drifts the physical gyro sensor position.
  const effectiveRefRef = useRef<Quaternion>(config.referenceQuaternion ?? IDENTITY_QUATERNION)

  // Keep effectiveRefRef in sync whenever the stored config reference changes
  // (e.g. user presses "reset gyro" or loads a saved config on mount).
  useEffect(() => {
    effectiveRefRef.current = config.referenceQuaternion ?? IDENTITY_QUATERNION
  }, [config.referenceQuaternion])

  const resetGyro = useCallback(() => {
    effectiveRefRef.current = latestRawQ.current
    const newConfig: OrientationConfig = { ...config, referenceQuaternion: latestRawQ.current }
    setConfig(newConfig)
    saveToStorage(STORAGE_KEYS.ORIENTATION_CONFIG, newConfig)
  }, [config])

  const saveOrientationConfig = useCallback((updates: Partial<OrientationConfig>) => {
    const newConfig: OrientationConfig = { ...config, ...updates }
    setConfig(newConfig)
    saveToStorage(STORAGE_KEYS.ORIENTATION_CONFIG, newConfig)
  }, [config])

  // When an M/E/S slice move is detected, the GAN gyro sensor (located in the
  // M-slice center) physically rotates with it. Update the effective reference
  // so applyReference continues to cancel that drift correctly.
  // Formula: new_ref = sliceQ * old_ref  (world-frame left-multiply)
  useCubeDriverEvent(driver, 'move', (move) => {
    const key = `${move.face}:${move.direction}`
    const sliceQ = SLICE_GYRO_ROTATIONS[key]
    if (sliceQ) {
      effectiveRefRef.current = multiplyQuaternions(sliceQ, effectiveRefRef.current)
    }
  }, driverVersion)

  // Same update for the retroactive slice path (replacePreviousMove).
  useCubeDriverEvent(driver, 'replacePreviousMove', (move) => {
    const key = `${move.face}:${move.direction}`
    const sliceQ = SLICE_GYRO_ROTATIONS[key]
    if (sliceQ) {
      effectiveRefRef.current = multiplyQuaternions(sliceQ, effectiveRefRef.current)
    }
  }, driverVersion)

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onGyro = (q: Quaternion) => {
      latestRawQ.current = q
      setQuaternion(applyReference(q, effectiveRefRef.current))
    }
    d.on('gyro', onGyro)
    return () => d.off('gyro', onGyro)
  }, [driver, driverVersion])

  return { quaternion, config, resetGyro, saveOrientationConfig }
}

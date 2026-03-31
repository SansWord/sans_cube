import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Quaternion, OrientationConfig, CubeColor } from '../types/cube'

const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 }
const STORAGE_KEY = 'cubeOrientationConfig'

export function invertQuaternion(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w }
}

export function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x:  a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y:  a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z:  a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w:  a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

// Returns q relative to the reference orientation (inverse(ref) * q)
export function applyReference(q: Quaternion, reference: Quaternion): Quaternion {
  return multiplyQuaternions(invertQuaternion(reference), q)
}

function loadConfig(): OrientationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as OrientationConfig
  } catch {}
  return { frontFace: 'green', bottomFace: 'yellow', referenceQuaternion: null }
}

function saveConfig(config: OrientationConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function useGyro(driver: MutableRefObject<CubeDriver | null>) {
  const [quaternion, setQuaternion] = useState<Quaternion>(IDENTITY_QUATERNION)
  const [config, setConfig] = useState<OrientationConfig>(loadConfig)
  const latestRawQ = useRef<Quaternion>(IDENTITY_QUATERNION)

  const reference = config.referenceQuaternion ?? IDENTITY_QUATERNION

  const resetGyro = useCallback(() => {
    const newConfig: OrientationConfig = { ...config, referenceQuaternion: latestRawQ.current }
    setConfig(newConfig)
    saveConfig(newConfig)
  }, [config])

  const saveOrientationConfig = useCallback((updates: Partial<OrientationConfig>) => {
    const newConfig: OrientationConfig = { ...config, ...updates }
    setConfig(newConfig)
    saveConfig(newConfig)
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
  }, [driver, reference])

  return { quaternion, config, resetGyro, saveOrientationConfig }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Quaternion, OrientationConfig } from '../types/cube'
import { IDENTITY_QUATERNION, applyReference, SLICE_GYRO_ROTATIONS, multiplyQuaternions, invertQuaternion } from '../utils/quaternion'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { useCubeDriverEvent } from './useCubeDriverEvent'

const DEFAULT_CONFIG: OrientationConfig = { frontFace: 'green', bottomFace: 'yellow', referenceQuaternion: null }

export function useGyro(driver: MutableRefObject<CubeDriver | null>, driverVersion = 0) {
  const [quaternion, setQuaternion] = useState(IDENTITY_QUATERNION)
  const [config, setConfig] = useState<OrientationConfig>(() => loadFromStorage(STORAGE_KEYS.ORIENTATION_CONFIG, DEFAULT_CONFIG))
  const latestRawQ = useRef(IDENTITY_QUATERNION)

  // Tracks the effective reference quaternion in "cube-frame" space (q_cube, not
  // q_sensor). Updated when the user presses Reset Gyro or on initial load.
  const effectiveRefRef = useRef<Quaternion>(config.referenceQuaternion ?? IDENTITY_QUATERNION)

  // Tracks the accumulated body-frame rotation of the GAN gyro sensor relative
  // to the cube's outer-layer frame. The GAN sensor is in the M-slice, so it
  // physically rotates with every M (and possibly E/S) move.
  //
  //   q_cube = q_sensor * inv(sensorOffset)
  //
  // After M CW:  sensorOffset = sensorOffset * sliceQ_M_CW  (right-multiply)
  // After M CCW: sensorOffset = sensorOffset * sliceQ_M_CCW
  //
  // This correctly cancels the axis confusion:
  //   physical Y rotation → sensor sees it as -Z (after M CW) → corrected back to Y
  //   (conjugation: sliceQ * R_{-Z}(θ) * inv(sliceQ) = R_Y(θ))
  const sensorOffsetRef = useRef<Quaternion>(IDENTITY_QUATERNION)

  // Keep effectiveRefRef in sync whenever the stored config reference changes
  // (e.g. on initial load from localStorage).
  useEffect(() => {
    effectiveRefRef.current = config.referenceQuaternion ?? IDENTITY_QUATERNION
  }, [config.referenceQuaternion])

  /** Compute q_cube from the raw sensor quaternion. */
  function _qCube(qSensor: Quaternion): Quaternion {
    return multiplyQuaternions(qSensor, invertQuaternion(sensorOffsetRef.current))
  }

  const resetGyro = useCallback(() => {
    // Reference is stored as q_cube so it remains valid across M/E/S moves.
    const qCube = _qCube(latestRawQ.current)
    effectiveRefRef.current = qCube
    const newConfig: OrientationConfig = { ...config, referenceQuaternion: qCube }
    setConfig(newConfig)
    saveToStorage(STORAGE_KEYS.ORIENTATION_CONFIG, newConfig)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const saveOrientationConfig = useCallback((updates: Partial<OrientationConfig>) => {
    const newConfig: OrientationConfig = { ...config, ...updates }
    setConfig(newConfig)
    saveToStorage(STORAGE_KEYS.ORIENTATION_CONFIG, newConfig)
  }, [config])

  // For each M/E/S move: accumulate the sensor's rotation offset.
  //
  // Each sliceQ is defined in the cube's outer-layer frame (GAN +X/+Y/+Z axes),
  // so the update is a LEFT-multiply (pre-multiplication):
  //   sensorOffset_new = sliceQ * sensorOffset_old
  //
  // RIGHT-multiply would be wrong for combinations: after E CW (Rz+90°) then M'
  // (Rx-90°), right-multiply gives Rz(90°)*Rx(-90°) but the correct accumulated
  // offset is Rx(-90°)*Rz(90°) — they differ because rotations don't commute.
  useCubeDriverEvent(driver, 'move', (move) => {
    const sliceQ = SLICE_GYRO_ROTATIONS[`${move.face}:${move.direction}`]
    if (sliceQ) {
      sensorOffsetRef.current = multiplyQuaternions(sliceQ, sensorOffsetRef.current)
    }
  }, driverVersion)

  // Same for the retroactive slice detection path.
  useCubeDriverEvent(driver, 'replacePreviousMove', (move) => {
    const sliceQ = SLICE_GYRO_ROTATIONS[`${move.face}:${move.direction}`]
    if (sliceQ) {
      sensorOffsetRef.current = multiplyQuaternions(sliceQ, sensorOffsetRef.current)
    }
  }, driverVersion)

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onGyro = (q: Quaternion) => {
      latestRawQ.current = q
      setQuaternion(applyReference(_qCube(q), effectiveRefRef.current))
    }
    d.on('gyro', onGyro)
    return () => d.off('gyro', onGyro)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, driverVersion])

  /** Reset the accumulated sensor offset to identity. Call this when cube state
   *  is reset to solved — the M-slice (and sensor) returns to its home position. */
  const resetSensorOffset = useCallback(() => {
    sensorOffsetRef.current = IDENTITY_QUATERNION
  }, [])

  return { quaternion, config, resetGyro, resetSensorOffset, saveOrientationConfig }
}

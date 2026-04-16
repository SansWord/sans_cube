import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Quaternion, OrientationConfig } from '../types/cube'
import { IDENTITY_QUATERNION, applyReference, SENSOR_ORIENTATION_FSM, multiplyQuaternions, invertQuaternion } from '../utils/quaternion'
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

  // FSM state index (0–23) tracking the sensor's accumulated orientation offset.
  // State 0 = identity (sensor at home, all slices at solved position).
  // Transitions are pure table lookups — no float multiplication, no drift.
  // q_cube = q_sensor * inv(SENSOR_ORIENTATION_FSM.orientations[sensorState])
  const sensorStateRef = useRef(0)

  // Keep effectiveRefRef in sync whenever the stored config reference changes
  // (e.g. on initial load from localStorage).
  useEffect(() => {
    effectiveRefRef.current = config.referenceQuaternion ?? IDENTITY_QUATERNION
  }, [config.referenceQuaternion])

  /** Compute q_cube from the raw sensor quaternion using the current FSM state. */
  function _qCube(qSensor: Quaternion): Quaternion {
    const offset = SENSOR_ORIENTATION_FSM.orientations[sensorStateRef.current]
    return multiplyQuaternions(qSensor, invertQuaternion(offset))
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

  // On each M/E/S move: advance the FSM state via table lookup — O(1), no float ops.
  useCubeDriverEvent(driver, 'move', (move) => {
    const key = `${move.face}:${move.direction}`
    const next = SENSOR_ORIENTATION_FSM.transitions[sensorStateRef.current][key]
    if (next !== undefined) sensorStateRef.current = next
  }, driverVersion)

  // Same for the retroactive slice detection path.
  useCubeDriverEvent(driver, 'replacePreviousMove', (move) => {
    const key = `${move.face}:${move.direction}`
    const next = SENSOR_ORIENTATION_FSM.transitions[sensorStateRef.current][key]
    if (next !== undefined) sensorStateRef.current = next
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

  /** Reset FSM to state 0. Call when cube state resets to solved — the sensor
   *  returns to its home position (all slices at 0). */
  const resetSensorOffset = useCallback(() => {
    sensorStateRef.current = 0
  }, [])

  return { quaternion, config, resetGyro, resetSensorOffset, saveOrientationConfig, sensorStateRef }
}

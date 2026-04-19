import type { QuaternionSnapshot } from '../../types/solve'

interface AcubemyGyroEntry {
  q: { w: number; x: number; y: number; z: number }
  t: number
}

function isValidEntry(e: unknown): e is AcubemyGyroEntry {
  if (typeof e !== 'object' || e === null) return false
  const obj = e as Record<string, unknown>
  if (typeof obj.t !== 'number' || !Number.isFinite(obj.t)) return false
  const q = obj.q
  if (typeof q !== 'object' || q === null) return false
  const qo = q as Record<string, unknown>
  for (const k of ['w', 'x', 'y', 'z']) {
    if (typeof qo[k] !== 'number' || !Number.isFinite(qo[k] as number)) return false
  }
  return true
}

/**
 * Map acubemy `gyro_data` to our `QuaternionSnapshot[]`.
 * Returns `null` if the input is missing, empty, or any entry fails validation.
 * Caller decides whether to emit a `gyro-dropped` warning.
 */
export function gyroMap(input: unknown): QuaternionSnapshot[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const valid = input.every(isValidEntry)
  if (!valid) return null
  return (input as AcubemyGyroEntry[]).map(e => ({
    quaternion: { x: e.q.x, y: e.q.y, z: e.q.z, w: e.q.w },
    relativeMs: e.t,
  }))
}

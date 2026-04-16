import type { Quaternion } from '../types/cube'

// GAN sensor coords: +X=Red(R), +Y=Blue/back(B), +Z=White/top(U)
// When a slice move is detected, the gyro sensor (in the M-slice) physically rotates with it.
// These quaternions represent that sensor rotation — apply to the reference to cancel the drift.
// M CW = +90° around X (U→F in GAN coords)
// E CW = +90° around Z (F→R in GAN coords, D direction)
// S CW = +90° around Y (U→R in GAN coords, F direction)
export const SLICE_GYRO_ROTATIONS: Partial<Record<string, Quaternion>> = {
  'M:CW':  { x:  Math.SQRT1_2, y: 0,              z: 0,              w: Math.SQRT1_2 },
  'M:CCW': { x: -Math.SQRT1_2, y: 0,              z: 0,              w: Math.SQRT1_2 },
  'E:CW':  { x: 0,              y: 0,              z:  Math.SQRT1_2, w: Math.SQRT1_2 },
  'E:CCW': { x: 0,              y: 0,              z: -Math.SQRT1_2, w: Math.SQRT1_2 },
  'S:CW':  { x: 0,              y:  Math.SQRT1_2, z: 0,              w: Math.SQRT1_2 },
  'S:CCW': { x: 0,              y: -Math.SQRT1_2, z: 0,              w: Math.SQRT1_2 },
}

export const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

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

/** Returns q relative to the reference orientation: inverse(ref) * q */
export function applyReference(q: Quaternion, reference: Quaternion): Quaternion {
  return multiplyQuaternions(invertQuaternion(reference), q)
}

export function slerpQuaternion(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w
  let { x: bx, y: by, z: bz, w: bw } = b
  if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot }
  if (dot > 0.9995) {
    const rx = a.x + t*(bx-a.x), ry = a.y + t*(by-a.y)
    const rz = a.z + t*(bz-a.z), rw = a.w + t*(bw-a.w)
    const len = Math.hypot(rx, ry, rz, rw)
    return { x: rx/len, y: ry/len, z: rz/len, w: rw/len }
  }
  const theta0 = Math.acos(dot)
  const theta = theta0 * t
  const sinTheta = Math.sin(theta)
  const sinTheta0 = Math.sin(theta0)
  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0
  const s1 = sinTheta / sinTheta0
  return { x: s0*a.x + s1*bx, y: s0*a.y + s1*by, z: s0*a.z + s1*bz, w: s0*a.w + s1*bw }
}

export function findSlerpedQuaternion(
  snapshots: { quaternion: Quaternion; relativeMs: number }[],
  solveElapsedMs: number,
): Quaternion | null {
  if (snapshots.length === 0) return null
  if (solveElapsedMs <= snapshots[0].relativeMs) return snapshots[0].quaternion
  const last = snapshots[snapshots.length - 1]
  if (solveElapsedMs >= last.relativeMs) return last.quaternion
  let lo = 0, hi = snapshots.length - 2
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (snapshots[mid + 1].relativeMs <= solveElapsedMs) lo = mid + 1
    else hi = mid
  }
  const prev = snapshots[lo], next = snapshots[lo + 1]
  const t = (solveElapsedMs - prev.relativeMs) / (next.relativeMs - prev.relativeMs)
  return slerpQuaternion(prev.quaternion, next.quaternion, t)
}

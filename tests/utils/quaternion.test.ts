import { describe, it, expect } from 'vitest'
import {
  IDENTITY_QUATERNION,
  invertQuaternion,
  multiplyQuaternions,
  applyReference,
  slerpQuaternion,
  findSlerpedQuaternion,
} from '../../src/utils/quaternion'

const q90 = { x: 0, y: 0.7071, z: 0, w: 0.7071 } // ~90° around Y

describe('invertQuaternion', () => {
  it('negates xyz, keeps w', () => {
    expect(invertQuaternion({ x: 1, y: 2, z: 3, w: 4 })).toEqual({ x: -1, y: -2, z: -3, w: 4 })
  })
  it('identity inverts to itself', () => {
    const r = invertQuaternion(IDENTITY_QUATERNION)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(0)
    expect(r.z).toBeCloseTo(0)
    expect(r.w).toBeCloseTo(1)
  })
})

describe('multiplyQuaternions', () => {
  it('identity * q = q', () => {
    const result = multiplyQuaternions(IDENTITY_QUATERNION, q90)
    expect(result.x).toBeCloseTo(q90.x)
    expect(result.y).toBeCloseTo(q90.y)
    expect(result.z).toBeCloseTo(q90.z)
    expect(result.w).toBeCloseTo(q90.w)
  })
  it('q * identity = q', () => {
    const result = multiplyQuaternions(q90, IDENTITY_QUATERNION)
    expect(result.y).toBeCloseTo(q90.y)
    expect(result.w).toBeCloseTo(q90.w)
  })
})

describe('applyReference', () => {
  it('cancels out when reference equals q', () => {
    const result = applyReference(q90, q90)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(1)
  })
  it('identity reference returns q unchanged', () => {
    const result = applyReference(q90, IDENTITY_QUATERNION)
    expect(result.y).toBeCloseTo(q90.y)
    expect(result.w).toBeCloseTo(q90.w)
  })
})

describe('slerpQuaternion', () => {
  it('t=0 returns a', () => {
    const r = slerpQuaternion(IDENTITY_QUATERNION, q90, 0)
    expect(r.w).toBeCloseTo(1)
    expect(r.y).toBeCloseTo(0)
  })
  it('t=1 returns b', () => {
    const r = slerpQuaternion(IDENTITY_QUATERNION, q90, 1)
    expect(r.w).toBeCloseTo(q90.w)
    expect(r.y).toBeCloseTo(q90.y)
  })
  it('t=0.5 produces unit quaternion', () => {
    const r = slerpQuaternion(IDENTITY_QUATERNION, q90, 0.5)
    const len = Math.hypot(r.x, r.y, r.z, r.w)
    expect(len).toBeCloseTo(1)
  })
})

describe('findSlerpedQuaternion', () => {
  const snapshots = [
    { quaternion: IDENTITY_QUATERNION, relativeMs: 0 },
    { quaternion: q90, relativeMs: 1000 },
  ]

  it('returns null for empty snapshots', () => {
    expect(findSlerpedQuaternion([], 500)).toBeNull()
  })
  it('clamps to first snapshot before start', () => {
    const r = findSlerpedQuaternion(snapshots, -100)
    expect(r).toEqual(IDENTITY_QUATERNION)
  })
  it('clamps to last snapshot after end', () => {
    const r = findSlerpedQuaternion(snapshots, 2000)
    expect(r).toEqual(q90)
  })
  it('interpolates at midpoint', () => {
    const r = findSlerpedQuaternion(snapshots, 500)!
    expect(r).not.toBeNull()
    const len = Math.hypot(r.x, r.y, r.z, r.w)
    expect(len).toBeCloseTo(1)
  })
})

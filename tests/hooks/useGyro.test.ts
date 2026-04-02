import { describe, it, expect } from 'vitest'
import { multiplyQuaternions, invertQuaternion, applyReference } from '../../src/utils/quaternion'

describe('quaternion helpers', () => {
  it('invertQuaternion negates x, y, z', () => {
    const q = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 }
    const inv = invertQuaternion(q)
    expect(inv.x).toBeCloseTo(-0.1)
    expect(inv.y).toBeCloseTo(-0.2)
    expect(inv.z).toBeCloseTo(-0.3)
    expect(inv.w).toBeCloseTo(0.9)
  })

  it('applyReference with identity reference returns same quaternion', () => {
    const identity = { x: 0, y: 0, z: 0, w: 1 }
    const q = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 }
    const result = applyReference(q, identity)
    expect(result.x).toBeCloseTo(q.x, 4)
    expect(result.y).toBeCloseTo(q.y, 4)
    expect(result.z).toBeCloseTo(q.z, 4)
    expect(result.w).toBeCloseTo(q.w, 4)
  })

  it('applyReference cancels out reference quaternion', () => {
    const ref = { x: 0, y: 0.707, z: 0, w: 0.707 } // 90° Y rotation
    const result = applyReference(ref, ref)
    expect(result.x).toBeCloseTo(0, 3)
    expect(result.y).toBeCloseTo(0, 3)
    expect(result.z).toBeCloseTo(0, 3)
    expect(result.w).toBeCloseTo(1, 3)
  })
})

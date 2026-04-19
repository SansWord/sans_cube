import { describe, it, expect } from 'vitest'
import { gyroMap } from '../../../src/utils/acubemyImport/gyroMap'

describe('gyroMap', () => {
  it('maps valid entries to QuaternionSnapshot', () => {
    const input = [
      { q: { w: 0.1, x: 0.2, y: 0.3, z: 0.4 }, t: 0 },
      { q: { w: 0.5, x: 0.6, y: 0.7, z: 0.8 }, t: 50 },
    ]
    expect(gyroMap(input)).toEqual([
      { quaternion: { x: 0.2, y: 0.3, z: 0.4, w: 0.1 }, relativeMs: 0 },
      { quaternion: { x: 0.6, y: 0.7, z: 0.8, w: 0.5 }, relativeMs: 50 },
    ])
  })

  it('returns null when input is missing', () => {
    expect(gyroMap(undefined)).toBeNull()
    expect(gyroMap(null)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(gyroMap([])).toBeNull()
  })

  it('returns null if any entry is malformed (non-finite number)', () => {
    const input = [
      { q: { w: 0.1, x: 0.2, y: 0.3, z: 0.4 }, t: 0 },
      { q: { w: NaN, x: 0.6, y: 0.7, z: 0.8 }, t: 50 },
    ]
    expect(gyroMap(input)).toBeNull()
  })

  it('returns null if any entry is missing q', () => {
    expect(gyroMap([{ t: 0 }])).toBeNull()
  })

  it('returns null if any entry is not an object', () => {
    expect(gyroMap(['not-an-object'])).toBeNull()
  })

  it('returns null if q.w / x / y / z fields are missing', () => {
    expect(gyroMap([{ q: { x: 0, y: 0, z: 0 }, t: 0 }])).toBeNull()
  })
})

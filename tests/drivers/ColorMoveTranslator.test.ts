import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ColorMoveTranslator } from '../../src/drivers/ColorMoveTranslator'
import { ColorCubeEventEmitter, type ColorCubeDriver } from '../../src/drivers/CubeDriver'
import type { ColorMove, PositionMove, FaceletColor } from '../../src/types/cube'

class MockColorDriver extends ColorCubeEventEmitter implements ColorCubeDriver {
  async connect() {}
  async disconnect() {}
  simulateMove(face: FaceletColor, direction: 'CW' | 'CCW', cubeTimestamp: number, serial: number) {
    const move: ColorMove = { face, direction, cubeTimestamp, serial }
    this.emit('move', move)
  }
}

describe('ColorMoveTranslator', () => {
  let inner: MockColorDriver
  let translator: ColorMoveTranslator
  let received: PositionMove[]

  beforeEach(() => {
    vi.useFakeTimers()
    inner = new MockColorDriver()
    translator = new ColorMoveTranslator(inner)
    received = []
    translator.on('move', (m) => received.push(m))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Pairing: color events → slice detection ──────────────────────────────

  it('O CCW + R CW (fast) → M CW', () => {
    // From solved: O=orange is on L, R=red is on R → M slice
    inner.simulateMove('O', 'CCW', 1000, 1)
    inner.simulateMove('R', 'CW',  1040, 2)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
    expect(received[0].cubeTimestamp).toBe(1000)
  })

  it('R CW + O CCW (fast, order-independent) → M CW', () => {
    inner.simulateMove('R', 'CW',  2000, 3)
    inner.simulateMove('O', 'CCW', 2030, 4)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
  })

  it('O CW + R CCW (fast) → M CCW', () => {
    inner.simulateMove('O', 'CW',  3000, 5)
    inner.simulateMove('R', 'CCW', 3020, 6)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CCW')
  })

  it('Y CCW + W CW (fast) → E CW', () => {
    // Y=yellow on D, W=white on U → E slice
    inner.simulateMove('Y', 'CCW', 4000, 7)
    inner.simulateMove('W', 'CW',  4030, 8)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('E')
    expect(received[0].direction).toBe('CW')
  })

  it('Y CW + W CCW (fast) → E CCW', () => {
    inner.simulateMove('Y', 'CW',  5000, 9)
    inner.simulateMove('W', 'CCW', 5020, 10)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('E')
    expect(received[0].direction).toBe('CCW')
  })

  it('G CCW + B CW (fast) → S CW', () => {
    // G=green on F, B=blue on B → S slice
    inner.simulateMove('G', 'CCW', 6000, 11)
    inner.simulateMove('B', 'CW',  6020, 12)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('S')
    expect(received[0].direction).toBe('CW')
  })

  it('G CW + B CCW (fast) → S CCW', () => {
    inner.simulateMove('G', 'CW',  7000, 13)
    inner.simulateMove('B', 'CCW', 7020, 14)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('S')
    expect(received[0].direction).toBe('CCW')
  })

  // ── Center tracking after slice ───────────────────────────────────────────

  it('after M CW: blue center → U, so B event → U geometric', () => {
    // Step 1: emit M CW (orange CCW + red CW)
    inner.simulateMove('O', 'CCW', 1000, 1)
    inner.simulateMove('R', 'CW',  1040, 2)
    expect(received[0].face).toBe('M')

    // Step 2: after timeout, send blue CW (blue center is now at U after M CW)
    vi.advanceTimersByTime(200)
    inner.simulateMove('B', 'CW', 2000, 3)
    vi.advanceTimersByTime(200)
    expect(received[1].face).toBe('U')
  })

  it('after E CW: green center → R, so G event → R geometric', () => {
    inner.simulateMove('Y', 'CCW', 1000, 1)
    inner.simulateMove('W', 'CW',  1040, 2)
    expect(received[0].face).toBe('E')

    vi.advanceTimersByTime(200)
    inner.simulateMove('G', 'CW', 2000, 3)
    vi.advanceTimersByTime(200)
    expect(received[1].face).toBe('R')
  })

  // ── Outer-face pass-through ───────────────────────────────────────────────

  it('W CW (from solved) → U CW geometric', () => {
    inner.simulateMove('W', 'CW', 8000, 16)
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('U')
    expect(received[0].direction).toBe('CW')
  })

  it('G CCW alone (no partner within window) → F CCW geometric', () => {
    inner.simulateMove('G', 'CCW', 9000, 17)
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('F')
    expect(received[0].direction).toBe('CCW')
  })

  // ── Gyro/connection/battery forwarding ───────────────────────────────────

  it('forwards gyro events unchanged', () => {
    const quats: unknown[] = []
    translator.on('gyro', (q) => quats.push(q))
    inner.emit('gyro', { x: 0.1, y: 0.2, z: 0.3, w: 0.9 })
    expect(quats).toHaveLength(1)
  })
})

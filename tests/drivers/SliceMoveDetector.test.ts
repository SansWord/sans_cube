import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SliceMoveDetector } from '../../src/drivers/SliceMoveDetector'
import { CubeEventEmitter } from '../../src/drivers/CubeDriver'
import type { CubeDriver } from '../../src/drivers/CubeDriver'
import type { Move } from '../../src/types/cube'
import { applyMoveToFacelets } from '../../src/hooks/useCubeState'
import { SOLVED_FACELETS } from '../../src/types/cube'

// Minimal in-process driver for feeding moves to SliceMoveDetector
class MockDriver extends CubeEventEmitter implements CubeDriver {
  async connect() {}
  async disconnect() {}
}

function makeMove(face: Move['face'], direction: Move['direction'], cubeTimestamp: number, serial = 1): Move {
  return { face, direction, cubeTimestamp, serial }
}

describe('SliceMoveDetector', () => {
  let inner: MockDriver
  let detector: SliceMoveDetector
  let received: Move[]

  beforeEach(() => {
    vi.useFakeTimers()
    inner = new MockDriver()
    detector = new SliceMoveDetector(inner)
    received = []
    detector.on('move', (m) => received.push(m))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Case 1: L CCW → R CW within 50ms → M CW
  it('coalesces L CCW + R CW into M CW', () => {
    inner.emit('move', makeMove('L', 'CCW', 1000, 1))
    inner.emit('move', makeMove('R', 'CW', 1040, 2))
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
    expect(received[0].cubeTimestamp).toBe(1000) // first event's timestamp
    expect(received[0].serial).toBe(1)           // first event's serial
  })

  // Case 2: R CW → L CCW within 50ms → M CW (order-independent)
  it('coalesces R CW + L CCW into M CW (order-independent)', () => {
    inner.emit('move', makeMove('R', 'CW', 2000, 3))
    inner.emit('move', makeMove('L', 'CCW', 2030, 4))
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
  })

  // Case 3: L CW → R CCW within 50ms → M CCW
  it('coalesces L CW + R CCW into M CCW', () => {
    inner.emit('move', makeMove('L', 'CW', 3000, 5))
    inner.emit('move', makeMove('R', 'CCW', 3020, 6))
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CCW')
  })

  // Case 4: L CCW → R CCW within 50ms → both pass through (direction mismatch)
  it('passes through both moves when directions do not form a slice pair', () => {
    inner.emit('move', makeMove('L', 'CCW', 4000, 7))
    inner.emit('move', makeMove('R', 'CCW', 4020, 8))
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('L')
    expect(received[1].face).toBe('R')
  })

  // Case 5: L CCW with no partner → timeout flushes it as-is
  it('flushes pending move after 200ms wall-time timeout', () => {
    inner.emit('move', makeMove('L', 'CCW', 5000, 9))
    expect(received).toHaveLength(0) // not yet emitted
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('L')
    expect(received[0].direction).toBe('CCW')
  })

  // Case 6: L CCW → R CW but cubeTimestamp gap > 50ms → both pass through
  it('does not coalesce when cubeTimestamp gap exceeds 50ms', () => {
    inner.emit('move', makeMove('L', 'CCW', 6000, 10))
    inner.emit('move', makeMove('R', 'CW', 6100, 11)) // 100ms gap
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('L')
    expect(received[1].face).toBe('R')
  })

  // Case 7: M2 — two consecutive M CW pairs
  it('detects M2 as two separate M CW moves', () => {
    inner.emit('move', makeMove('L', 'CCW', 7000, 12))
    inner.emit('move', makeMove('R', 'CW', 7030, 13))
    inner.emit('move', makeMove('L', 'CCW', 7060, 14))
    inner.emit('move', makeMove('R', 'CW', 7090, 15))
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
    expect(received[1].face).toBe('M')
    expect(received[1].direction).toBe('CW')
  })

  // Non-slice moves pass through immediately via buffering
  it('passes through non-paireable moves via flush-on-next', () => {
    inner.emit('move', makeMove('U', 'CW', 8000, 16))
    inner.emit('move', makeMove('U', 'CW', 8500, 17))
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('U')
    expect(received[1].face).toBe('U')
  })

  // Gyro/connection/battery pass through unchanged
  it('forwards gyro events unchanged', () => {
    const quats: unknown[] = []
    detector.on('gyro', (q) => quats.push(q))
    inner.emit('gyro', { x: 0.1, y: 0.2, z: 0.3, w: 0.9 })
    expect(quats).toHaveLength(1)
  })

  it('integration: L CCW + R CW emits M CW that correctly applies L CCW + R CW sticker effect', () => {
    // M CW = L CCW + R CW: U left and right cols get F color; U mid unchanged
    let emittedMove: Move | null = null
    detector.on('move', (m) => { emittedMove = m })

    inner.emit('move', makeMove('L', 'CCW', 9000, 20))
    inner.emit('move', makeMove('R', 'CW', 9025, 21))

    expect(emittedMove).not.toBeNull()
    expect(emittedMove!.face).toBe('M')
    expect(emittedMove!.direction).toBe('CW')

    const result = applyMoveToFacelets(SOLVED_FACELETS, emittedMove!)
    // M CW on solved: U left col (0,3,6) and right col (2,5,8) get F color ('F')
    expect(result[0]).toBe('F')
    expect(result[2]).toBe('F')
    expect(result[1]).toBe('U') // U mid unchanged
    // Full state check
    expect(result).toBe('FUFFUFFUFRRRRRRRRRDFDDFDDFDBDBBDBBDBLLLLLLLLLUBUUBUUBU')
  })
})

import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { useTimer } from '../../src/hooks/useTimer'
import { CubeEventEmitter } from '../../src/drivers/CubeDriver'
import type { CubeDriver } from '../../src/drivers/CubeDriver'
import type { PositionMove } from '../../src/types/cube'
import type { SolveMethod } from '../../src/types/solve'

// Minimal method with no phases — simplest possible solve detection
const NO_PHASE_METHOD: SolveMethod = { id: 'test', label: 'Test', phases: [] }

class FakeDriver extends CubeEventEmitter implements CubeDriver {
  async connect() {}
  async disconnect() {}
}

function makeMove(face: PositionMove['face'], dir: PositionMove['direction'], ts: number): PositionMove {
  return { face, direction: dir, cubeTimestamp: ts, serial: 0 }
}

describe('useTimer — hardware clock timing', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses cubeTimestamp to measure elapsedMs, ignoring BLE delivery delay on last move', () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)

    const driver = new FakeDriver()
    const driverRef = { current: driver as CubeDriver | null }
    const { result } = renderHook(() => useTimer(driverRef, NO_PHASE_METHOD, true))

    // First move: wall=5000, cubeTs=1000 → hwOffset = 5000 - 1000 = 4000
    act(() => { driver.emit('move', makeMove('U', 'CW', 1000)) })
    expect(result.current.status).toBe('solving')

    // Last move arrives 1500ms later by wall clock, but only 1000ms later by hardware clock
    vi.setSystemTime(6500)
    act(() => { driver.emit('move', makeMove('U', 'CCW', 2000)) })

    expect(result.current.status).toBe('solved')
    // hardware elapsed = (2000 + 4000) - (1000 + 4000) = 1000ms
    // without fix it would be 6500 - 5000 = 1500ms
    expect(result.current.elapsedMs).toBe(1000)
  })

  it('uses cubeTimestamp for elapsedMs when solve completes via replacePreviousMove (retro M-move path)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)

    const driver = new FakeDriver()
    const driverRef = { current: driver as CubeDriver | null }
    const { result } = renderHook(() => useTimer(driverRef, NO_PHASE_METHOD, true))

    // First move: wall=5000, cubeTs=1000 → hwOffset = 4000
    act(() => { driver.emit('move', makeMove('U', 'CW', 1000)) })

    // Second move advances cube state; prevFacelets is now set to after-U-CW
    vi.setSystemTime(5100)
    act(() => { driver.emit('move', makeMove('L', 'CW', 1500)) })

    // Retro correction arrives 1400ms late by wall clock (only 500ms by hardware)
    // U CCW applied to prevFacelets (after-U-CW state) = SOLVED
    vi.setSystemTime(6500)
    act(() => { driver.emit('replacePreviousMove', makeMove('U', 'CCW', 2000)) })

    expect(result.current.status).toBe('solved')
    // hardware elapsed = (2000 + 4000) - (1000 + 4000) = 1000ms
    // without fix it would be 6500 - 5000 = 1500ms
    expect(result.current.elapsedMs).toBe(1000)
  })
})

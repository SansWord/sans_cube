import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { useCubeDriverEvent } from '../../src/hooks/useCubeDriverEvent'
import { CubeEventEmitter } from '../../src/drivers/CubeDriver'
import type { CubeDriver } from '../../src/drivers/CubeDriver'
import type { PositionMove } from '../../src/types/cube'

class FakeDriver extends CubeEventEmitter implements CubeDriver {
  async connect() {}
  async disconnect() {}
}

const MOVE: PositionMove = { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 }

describe('useCubeDriverEvent', () => {
  it('calls the handler when the event fires', () => {
    const driver = new FakeDriver()
    const driverRef = { current: driver as CubeDriver | null }
    const handler = vi.fn()

    renderHook(() => useCubeDriverEvent(driverRef, 'move', handler))

    act(() => { driver.emit('move', MOVE) })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(MOVE)
  })

  it('stops calling the handler after unmount', () => {
    const driver = new FakeDriver()
    const driverRef = { current: driver as CubeDriver | null }
    const handler = vi.fn()

    const { unmount } = renderHook(() => useCubeDriverEvent(driverRef, 'move', handler))
    unmount()

    act(() => { driver.emit('move', MOVE) })

    expect(handler).not.toHaveBeenCalled()
  })

  it('switches to the new driver when driverVersion increments', () => {
    const driverA = new FakeDriver()
    const driverB = new FakeDriver()
    const driverRef = { current: driverA as CubeDriver | null }
    const handler = vi.fn()

    const { rerender } = renderHook(
      ({ version }: { version: number }) => useCubeDriverEvent(driverRef, 'move', handler, version),
      { initialProps: { version: 0 } },
    )

    driverRef.current = driverB
    rerender({ version: 1 })

    // old driver unregistered
    act(() => { driverA.emit('move', MOVE) })
    expect(handler).not.toHaveBeenCalled()

    // new driver registered
    act(() => { driverB.emit('move', MOVE) })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls the latest handler without re-registering when handler reference changes', () => {
    const driver = new FakeDriver()
    const driverRef = { current: driver as CubeDriver | null }
    const onSpy = vi.spyOn(driver, 'on')
    const handlerA = vi.fn()
    const handlerB = vi.fn()

    const { rerender } = renderHook(
      ({ h }: { h: (m: PositionMove) => void }) => useCubeDriverEvent(driverRef, 'move', h),
      { initialProps: { h: handlerA } },
    )

    rerender({ h: handlerB })

    // re-render should not re-register the event
    expect(onSpy).toHaveBeenCalledOnce()

    act(() => { driver.emit('move', MOVE) })

    // latest handler called, old one not
    expect(handlerA).not.toHaveBeenCalled()
    expect(handlerB).toHaveBeenCalledOnce()
  })

  it('does nothing when driver is null', () => {
    const driverRef = { current: null as CubeDriver | null }
    const handler = vi.fn()

    expect(() => {
      renderHook(() => useCubeDriverEvent(driverRef, 'move', handler))
    }).not.toThrow()

    expect(handler).not.toHaveBeenCalled()
  })
})

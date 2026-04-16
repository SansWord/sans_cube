import { describe, it, expect } from 'vitest'
import { GanCubeDriver } from '../../src/drivers/GanCubeDriver'
import type { ColorMove } from '../../src/types/cube'

describe('GanCubeDriver event translation', () => {
  it('translates a GAN MOVE event to a ColorMove (face index 2 → G green)', () => {
    const driver = new GanCubeDriver()
    const received: ColorMove[] = []
    driver.on('move', (m) => received.push(m))

    driver._simulateGanMove({ face: 2, dir: 0, cubeTimestamp: 500, serial: 1 })

    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('G') // GAN_COLOR_MAP[2] = 'G' (green)
    expect(received[0].direction).toBe('CW')
    expect(received[0].cubeTimestamp).toBe(500)
    expect(received[0].serial).toBe(1)
  })

  it('translates CCW direction correctly (face index 0 → W white)', () => {
    const driver = new GanCubeDriver()
    const received: ColorMove[] = []
    driver.on('move', (m) => received.push(m))

    driver._simulateGanMove({ face: 0, dir: 1, cubeTimestamp: 100, serial: 2 })

    expect(received[0].face).toBe('W') // GAN_COLOR_MAP[0] = 'W' (white)
    expect(received[0].direction).toBe('CCW')
  })

  it('translates a GAN GYRO event to a normalized Quaternion', () => {
    const driver = new GanCubeDriver()
    const quats: { x: number; y: number; z: number; w: number }[] = []
    driver.on('gyro', (q) => quats.push(q))

    driver._simulateGanGyro({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 })

    expect(quats).toHaveLength(1)
    expect(quats[0].x).toBeCloseTo(0.1)
    expect(quats[0].w).toBeCloseTo(0.9)
  })

  it('emits disconnected on GAN DISCONNECT event', () => {
    const driver = new GanCubeDriver()
    const statuses: string[] = []
    driver.on('connection', (s) => statuses.push(s))

    driver._simulateGanDisconnect()

    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toBe('disconnected')
  })
})

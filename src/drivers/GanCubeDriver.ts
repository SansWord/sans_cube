import { connectGanCube } from 'gan-web-bluetooth'
import { CubeEventEmitter, type CubeDriver } from './CubeDriver'
import type { Move, Quaternion, Face } from '../types/cube'
import { STORAGE_KEYS } from '../utils/storageKeys'

// GAN face index → standard face letter
// GAN Gen4: face index 0-5 maps to U,R,F,D,L,B
const GAN_FACE_MAP: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

export class GanCubeDriver extends CubeEventEmitter implements CubeDriver {
  private connection: Awaited<ReturnType<typeof connectGanCube>> | null = null
  private batteryPollInterval: ReturnType<typeof setInterval> | null = null
  private _lastCubeTs = 0  // tracks last valid cubeTimestamp for interpolating missed-move nulls

  async connect(): Promise<void> {
    this.emit('connection', 'connecting')
    let usedSavedMac = false
    try {
      this.connection = await connectGanCube(
        async (_device: unknown, isFallback: boolean | undefined) => {
          if (!isFallback) return null
          const saved = localStorage.getItem(STORAGE_KEYS.CUBE_MAC_ADDRESS)
          if (saved) {
            usedSavedMac = true
            return saved
          }
          const entered = prompt('Enter cube MAC address (check cube box or nRF Connect app)')
          if (entered) localStorage.setItem(STORAGE_KEYS.CUBE_MAC_ADDRESS, entered)
          return entered
        }
      )
      this.connection.events$.subscribe((event: Record<string, unknown>) => {
        this._handleGanEvent(event)
      })
      this.emit('connection', 'connected')
      this.connection.sendCubeCommand({ type: 'REQUEST_BATTERY' }).catch(() => {})
      this.batteryPollInterval = setInterval(() => {
        this.connection?.sendCubeCommand({ type: 'REQUEST_BATTERY' }).catch(() => {})
      }, 60_000)
    } catch (err) {
      // If we used a saved MAC and the failure wasn't the user cancelling the BLE picker,
      // the MAC is likely wrong — clear it so the next attempt prompts for a fresh one.
      if (usedSavedMac && !isUserCancellation(err)) {
        localStorage.removeItem(STORAGE_KEYS.CUBE_MAC_ADDRESS)
      }
      this.emit('connection', 'disconnected')
      throw err
    }
  }

  async disconnect(): Promise<void> {
    if (this.batteryPollInterval !== null) {
      clearInterval(this.batteryPollInterval)
      this.batteryPollInterval = null
    }
    const conn = this.connection
    this.connection = null
    this.emit('connection', 'disconnected')
    await conn?.disconnect()
  }

  // Translates a raw GAN event from gan-web-bluetooth into normalized driver events
  private _handleGanEvent(event: Record<string, unknown>): void {
    if (event.type === 'MOVE') {
      const ganFaceIndex = event.face as number
      const ganDir = event.direction as number
      // GAN Gen4 sends cubeTimestamp: null for missed/recovered moves (BLE packet loss).
      // Interpolate with +50ms rather than passing null, which would corrupt replay timing.
      const rawTs = event.cubeTimestamp as number | null
      const cubeTimestamp = rawTs != null ? rawTs : this._lastCubeTs + 50
      this._lastCubeTs = cubeTimestamp
      const move: Move = {
        face: GAN_FACE_MAP[ganFaceIndex],
        direction: ganDir === 0 ? 'CW' : 'CCW',
        cubeTimestamp,
        serial: event.serial as number,
      }
      this.emit('move', move)
    } else if (event.type === 'GYRO') {
      const q = event.quaternion as { x: number; y: number; z: number; w: number }
      const quaternion: Quaternion = { x: q.x, y: q.y, z: q.z, w: q.w }
      this.emit('gyro', quaternion)
    } else if (event.type === 'BATTERY') {
      this.emit('battery', event.batteryLevel as number)
    } else if (event.type === 'DISCONNECT') {
      this.emit('connection', 'disconnected')
    }
  }

  // Test-only helpers to simulate GAN events without real BLE hardware
  _simulateGanMove(raw: { face: number; dir: number; cubeTimestamp: number; serial: number }): void {
    this._handleGanEvent({
      type: 'MOVE',
      face: raw.face,
      direction: raw.dir,
      cubeTimestamp: raw.cubeTimestamp,
      serial: raw.serial,
    })
  }

  _simulateGanGyro(q: { x: number; y: number; z: number; w: number }): void {
    this._handleGanEvent({ type: 'GYRO', quaternion: q })
  }

  _simulateGanDisconnect(): void {
    this._handleGanEvent({ type: 'DISCONNECT' })
  }
}

// Web Bluetooth throws a NotFoundError DOMException when the user dismisses the
// device picker without selecting anything. That's not a bad MAC — don't clear it.
function isUserCancellation(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotFoundError'
}

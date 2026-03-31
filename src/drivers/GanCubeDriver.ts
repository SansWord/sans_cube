import { connectGanCube } from 'gan-web-bluetooth'
import { CubeEventEmitter, type CubeDriver, type ConnectionStatus } from './CubeDriver'
import type { Move, Quaternion, Face } from '../types/cube'

// GAN face index → standard face letter
// GAN Gen4: face index 0-5 maps to U,R,F,D,L,B
const GAN_FACE_MAP: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

export class GanCubeDriver extends CubeEventEmitter implements CubeDriver {
  private connection: Awaited<ReturnType<typeof connectGanCube>> | null = null

  async connect(): Promise<void> {
    this.emit('connection', 'connecting')
    try {
      this.connection = await connectGanCube(
        async (_device: unknown, isFallback: boolean) =>
          isFallback ? prompt('Enter cube MAC address (check cube box or nRF Connect app)') : null
      )
      this.connection.events$.subscribe((event: Record<string, unknown>) => {
        this._handleGanEvent(event)
      })
      this.emit('connection', 'connected')
      await this.requestState()
    } catch (err) {
      this.emit('connection', 'disconnected')
      throw err
    }
  }

  async disconnect(): Promise<void> {
    this.connection = null
    this.emit('connection', 'disconnected')
  }

  async requestState(): Promise<void> {
    await this.connection?.sendCubeCommand({ type: 'REQUEST_FACELETS' })
  }

  // Translates a raw GAN event from gan-web-bluetooth into normalized driver events
  private _handleGanEvent(event: Record<string, unknown>): void {
    if (event.type === 'MOVE') {
      const ganFaceIndex = event.faceIndex as number
      const ganDir = event.direction as number
      const move: Move = {
        face: GAN_FACE_MAP[ganFaceIndex],
        direction: ganDir === 0 ? 'CW' : 'CCW',
        cubeTimestamp: event.cubeTimestamp as number,
        serial: event.serial as number,
      }
      this.emit('move', move)
    } else if (event.type === 'GYRO') {
      const q = event.quaternion as { x: number; y: number; z: number; w: number }
      const quaternion: Quaternion = { x: q.x, y: q.y, z: q.z, w: q.w }
      this.emit('gyro', quaternion)
    } else if (event.type === 'FACELETS') {
      this.emit('state', { facelets: event.facelets as string })
    } else if (event.type === 'DISCONNECT') {
      this.emit('connection', 'disconnected')
    }
  }

  // Test-only helpers to simulate GAN events without real BLE hardware
  _simulateGanMove(raw: { face: number; dir: number; cubeTimestamp: number; serial: number }): void {
    this._handleGanEvent({
      type: 'MOVE',
      faceIndex: raw.face,
      direction: raw.dir,
      cubeTimestamp: raw.cubeTimestamp,
      serial: raw.serial,
    })
  }

  _simulateGanGyro(q: { x: number; y: number; z: number; w: number }): void {
    this._handleGanEvent({ type: 'GYRO', quaternion: q })
  }
}

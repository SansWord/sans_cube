import { CubeEventEmitter, type CubeDriver } from './CubeDriver'
import type { Move, Face, Direction } from '../types/cube'

let serialCounter = 0

export class ButtonDriver extends CubeEventEmitter implements CubeDriver {
  async connect(): Promise<void> {
    this.emit('connection', 'connected')
  }

  async disconnect(): Promise<void> {
    this.emit('connection', 'disconnected')
  }

  sendMove(face: Face, direction: Direction, double = false): void {
    const move: Move = {
      face,
      direction,
      cubeTimestamp: Date.now(),
      serial: serialCounter++,
    }
    this.emit('move', move)
    if (double) {
      this.emit('move', { ...move, serial: serialCounter++ })
    }
  }
}

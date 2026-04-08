import { CubeEventEmitter, type CubeDriver } from './CubeDriver'
import type { Move, SliceFace, Direction } from '../types/cube'

/**
 * Detects M/E/S slice moves from paired GAN hardware events.
 *
 * GAN cubes report slice moves as two outer-face events on the same axis with
 * opposite directions arriving within ≤50ms (cubeTimestamp). This middleware
 * buffers each move, attempts to pair the next one, and either emits a single
 * slice Move or flushes both as-is. A 200ms wall-time safety timeout flushes
 * a lone pending move in case the second BLE event is lost.
 */
export class SliceMoveDetector extends CubeEventEmitter implements CubeDriver {
  private _inner: CubeDriver
  private _pending: Move | null = null
  private _flushTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(inner: CubeDriver) {
    super()
    this._inner = inner
    inner.on('move', (move) => this._onMove(move))
    inner.on('gyro', (q) => this.emit('gyro', q))
    inner.on('connection', (s) => this.emit('connection', s))
    inner.on('battery', (b) => this.emit('battery', b))
  }

  async connect(): Promise<void> { return this._inner.connect() }
  async disconnect(): Promise<void> { return this._inner.disconnect() }

  private _onMove(move: Move): void {
    if (this._pending === null) {
      this._setPending(move)
      return
    }

    const slice = tryPair(this._pending, move)
    if (slice !== null) {
      this._clearFlushTimeout()
      const sliceMove: Move = {
        face: slice.face,
        direction: slice.direction,
        cubeTimestamp: this._pending.cubeTimestamp,
        serial: this._pending.serial,
        quaternion: this._pending.quaternion,
      }
      this._pending = null
      this.emit('move', sliceMove)
    } else {
      // Flush pending as-is, buffer the new move
      const flushed = this._pending
      this._clearFlushTimeout()
      this._pending = null
      this.emit('move', flushed)
      this._setPending(move)
    }
  }

  private _setPending(move: Move): void {
    this._pending = move
    this._flushTimeout = setTimeout(() => {
      if (this._pending !== null) {
        const flushed = this._pending
        this._pending = null
        this.emit('move', flushed)
      }
    }, 200)
  }

  private _clearFlushTimeout(): void {
    if (this._flushTimeout !== null) {
      clearTimeout(this._flushTimeout)
      this._flushTimeout = null
    }
  }
}

/** Returns the slice move if (pending, incoming) form a valid pair, else null. */
function tryPair(pending: Move, incoming: Move): { face: SliceFace; direction: Direction } | null {
  if (Math.abs(incoming.cubeTimestamp - pending.cubeTimestamp) > 50) return null
  if (pending.direction === incoming.direction) return null // same direction = no slice

  const p = pending.face
  const i = incoming.face

  // M: L + R (opposite directions). Slice direction = R's direction.
  if (p === 'L' && i === 'R') return { face: 'M', direction: incoming.direction }
  if (p === 'R' && i === 'L') return { face: 'M', direction: pending.direction }

  // E: D + U (opposite directions). Slice direction = U's direction.
  if (p === 'D' && i === 'U') return { face: 'E', direction: incoming.direction }
  if (p === 'U' && i === 'D') return { face: 'E', direction: pending.direction }

  // S: F + B (opposite directions). Slice direction = B's direction.
  if (p === 'F' && i === 'B') return { face: 'S', direction: incoming.direction }
  if (p === 'B' && i === 'F') return { face: 'S', direction: pending.direction }

  return null
}

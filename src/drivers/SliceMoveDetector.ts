import { CubeEventEmitter, type CubeDriver } from './CubeDriver'
import type { Move, SliceFace, Direction } from '../types/cube'

/**
 * Detects M/E/S slice moves from paired GAN hardware events.
 *
 * GAN cubes report slice moves as two outer-face events on the same axis with
 * opposite directions. BLE delivery timing is bimodal: either fast (<100ms) or
 * very slow (>500ms), with nothing in between.
 *
 * Strategy:
 *  - Buffer each move for up to FAST_WINDOW_MS (100ms). If the partner arrives
 *    within that window, emit the slice cleanly with no individual moves shown.
 *  - After FAST_WINDOW_MS, emit the buffered move immediately (no long wait).
 *  - Keep the emitted move in a retroactive window (RETRO_WINDOW_MS = 1500ms).
 *    If the late BLE partner arrives within that window, emit `replacePreviousMove`
 *    so consumers can correct the already-recorded individual move to the slice.
 */
export class SliceMoveDetector extends CubeEventEmitter implements CubeDriver {
  private static readonly FAST_WINDOW_MS = 100
  private static readonly RETRO_WINDOW_MS = 1500

  private _inner: CubeDriver
  /** Move held during the fast-pairing window. */
  private _pending: Move | null = null
  private _fastTimeout: ReturnType<typeof setTimeout> | null = null
  /** Move already emitted, held for possible retroactive correction. */
  private _lastEmitted: { move: Move; wallTime: number } | null = null

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

  private _onMove(incoming: Move): void {
    // --- Retroactive check: did this arrive late but pair with last emitted? ---
    if (this._lastEmitted !== null) {
      const wallGap = Date.now() - this._lastEmitted.wallTime
      if (wallGap <= SliceMoveDetector.RETRO_WINDOW_MS) {
        const slice = pairResult(this._lastEmitted.move, incoming)
        if (slice !== null) {
          this._lastEmitted = null
          const corrected: Move = {
            face: slice.face,
            direction: slice.direction,
            cubeTimestamp: incoming.cubeTimestamp,
            serial: incoming.serial,
            quaternion: incoming.quaternion,
          }
          this.emit('replacePreviousMove', corrected)
          return
        }
      }
      this._lastEmitted = null
    }

    // --- Fast-window check: try to pair with buffered pending ---
    if (this._pending !== null) {
      const slice = pairResult(this._pending, incoming)
      if (slice !== null) {
        this._clearFastTimeout()
        const sliceMove: Move = {
          face: slice.face,
          direction: slice.direction,
          cubeTimestamp: this._pending.cubeTimestamp,
          serial: this._pending.serial,
          quaternion: this._pending.quaternion,
        }
        this._pending = null
        this._emitMove(sliceMove)
        return
      }

      // Not a pair — flush pending immediately, continue with incoming
      this._flushPending()
    }

    this._setPending(incoming)
  }

  private _setPending(move: Move): void {
    this._pending = move
    this._fastTimeout = setTimeout(() => {
      this._flushPending()
    }, SliceMoveDetector.FAST_WINDOW_MS)
  }

  private _flushPending(): void {
    if (this._pending === null) return
    this._clearFastTimeout()
    const move = this._pending
    this._pending = null
    this._emitMove(move)
  }

  private _emitMove(move: Move): void {
    this._lastEmitted = { move, wallTime: Date.now() }
    this.emit('move', move)
  }

  private _clearFastTimeout(): void {
    if (this._fastTimeout !== null) {
      clearTimeout(this._fastTimeout)
      this._fastTimeout = null
    }
  }
}

const CUBE_SLICE_WINDOW_MS = 50

function pairResult(pending: Move, incoming: Move): { face: SliceFace; direction: Direction } | null {
  if (pending.direction === incoming.direction) return null
  if (Math.abs(incoming.cubeTimestamp - pending.cubeTimestamp) > CUBE_SLICE_WINDOW_MS) return null

  const p = pending.face
  const i = incoming.face

  if (p === 'L' && i === 'R') return { face: 'M', direction: incoming.direction }
  if (p === 'R' && i === 'L') return { face: 'M', direction: pending.direction }
  if (p === 'D' && i === 'U') return { face: 'E', direction: incoming.direction }
  if (p === 'U' && i === 'D') return { face: 'E', direction: pending.direction }
  if (p === 'F' && i === 'B') return { face: 'S', direction: incoming.direction }
  if (p === 'B' && i === 'F') return { face: 'S', direction: pending.direction }

  return null
}

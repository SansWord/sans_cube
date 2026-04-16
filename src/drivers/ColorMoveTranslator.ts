// src/drivers/ColorMoveTranslator.ts
import { CubeEventEmitter, type CubeDriver, type ColorCubeDriver } from './CubeDriver'
import { applyMoveToFacelets } from '../utils/applyMove'
import { SOLVED_FACELETS } from '../types/cube'
import type { ColorMove, PositionMove, FaceletColor, Face, SliceFace, Direction } from '../types/cube'

/**
 * Translates GAN color-based move events to geometric face labels, and detects
 * M/E/S slice moves by pairing opposite geometric faces.
 *
 * GAN hardware emits face indices based on sticker color (face 0 = white center),
 * not geometric position. After M/E/S moves the centers drift, so a fixed map is
 * wrong. This class tracks center positions via a facelets string and looks up the
 * current geometric face for each incoming color.
 *
 * Timing windows and pairing logic are identical to the old SliceMoveDetector.
 */
export class ColorMoveTranslator extends CubeEventEmitter implements CubeDriver {
  private static readonly FAST_WINDOW_MS = 100
  private static readonly RETRO_WINDOW_MS = 1500

  private _inner: ColorCubeDriver
  private _pending: PositionMove | null = null
  private _fastTimeout: ReturnType<typeof setTimeout> | null = null
  private _lastEmitted: { move: PositionMove; wallTime: number } | null = null
  /** Facelets before _lastEmitted was applied — for retroactive facelets correction */
  private _prevFacelets: string = SOLVED_FACELETS

  // Tracked facelets string — updated after each emitted move
  private _facelets: string = SOLVED_FACELETS

  private static readonly CENTERS: readonly number[] = [4, 13, 22, 31, 40, 49]
  private static readonly FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

  constructor(inner: ColorCubeDriver) {
    super()
    this._inner = inner
    inner.on('move', (move) => this._onMove(move))
    inner.on('gyro', (q) => this.emit('gyro', q))
    inner.on('connection', (s) => this.emit('connection', s))
    inner.on('battery', (b) => this.emit('battery', b))
  }

  async connect(): Promise<void> { return this._inner.connect() }
  async disconnect(): Promise<void> { return this._inner.disconnect() }

  /** Look up which geometric face currently has this color's center sticker. */
  private _geometricFace(color: FaceletColor): Face {
    const i = ColorMoveTranslator.CENTERS.findIndex(pos => this._facelets[pos] === color)
    return ColorMoveTranslator.FACES[i]
  }

  private _onMove(incoming: ColorMove): void {
    // Translate color → geometric face
    const geometricFace = this._geometricFace(incoming.face)
    const translated: PositionMove = {
      face: geometricFace,
      direction: incoming.direction,
      cubeTimestamp: incoming.cubeTimestamp,
      serial: incoming.serial,
      quaternion: incoming.quaternion,
    }

    // --- Retroactive check ---
    if (this._lastEmitted !== null) {
      const wallGap = Date.now() - this._lastEmitted.wallTime
      if (wallGap <= ColorMoveTranslator.RETRO_WINDOW_MS) {
        const slice = pairResult(this._lastEmitted.move, translated)
        if (slice !== null) {
          const corrected: PositionMove = {
            face: slice.face,
            direction: slice.direction,
            cubeTimestamp: translated.cubeTimestamp,
            serial: translated.serial,
            quaternion: translated.quaternion,
          }
          // Undo the individual move's facelets update; apply the slice instead
          this._facelets = applyMoveToFacelets(this._prevFacelets, corrected)
          this._lastEmitted = null
          this.emit('replacePreviousMove', corrected)
          return
        }
      }
      this._lastEmitted = null
    }

    // --- Fast-window check ---
    if (this._pending !== null) {
      const slice = pairResult(this._pending, translated)
      if (slice !== null) {
        this._clearFastTimeout()
        const sliceMove: PositionMove = {
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
      this._flushPending()
    }

    this._setPending(translated)
  }

  private _setPending(move: PositionMove): void {
    this._pending = move
    this._fastTimeout = setTimeout(() => {
      this._flushPending()
    }, ColorMoveTranslator.FAST_WINDOW_MS)
  }

  private _flushPending(): void {
    if (this._pending === null) return
    this._clearFastTimeout()
    const move = this._pending
    this._pending = null
    this._emitMove(move)
  }

  private _emitMove(move: PositionMove): void {
    this._prevFacelets = this._facelets
    this._facelets = applyMoveToFacelets(this._facelets, move)
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

function pairResult(
  pending: PositionMove,
  incoming: PositionMove
): { face: SliceFace; direction: Direction } | null {
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

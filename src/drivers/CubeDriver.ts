import type { PositionMove, ColorMove, Quaternion } from '../types/cube'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

// Generic event map shared by position-based and color-based drivers
type MoveEventMap<TMove> = {
  move: TMove
  /** Emitted when a previously emitted move is retroactively identified as a slice. */
  replacePreviousMove: TMove
  gyro: Quaternion
  connection: ConnectionStatus
  battery: number
}

export type EventMap      = MoveEventMap<PositionMove>
export type ColorEventMap = MoveEventMap<ColorMove>

type EventHandler<T> = (payload: T) => void

// Generic event emitter — parameterized over event map shape
class TypedEventEmitter<TEventMap extends Record<string, unknown>> {
  private handlers: { [K in keyof TEventMap]?: EventHandler<TEventMap[K]>[] } = {}

  on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
    if (!this.handlers[event]) this.handlers[event] = []
    ;(this.handlers[event] as EventHandler<TEventMap[K]>[]).push(handler)
  }

  off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
    const arr = this.handlers[event] as EventHandler<TEventMap[K]>[] | undefined
    ;(this.handlers as Record<K, EventHandler<TEventMap[K]>[] | undefined>)[event] = arr?.filter(
      (h) => h !== handler
    )
  }

  emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
    ;(this.handlers[event] as EventHandler<TEventMap[K]>[])?.forEach((h) => h(payload))
  }

  removeAllListeners(): void {
    this.handlers = {}
  }
}

// Backward-compat — all existing code using CubeEventEmitter is unchanged
export class CubeEventEmitter extends TypedEventEmitter<EventMap> {}

// Color-based variant — used by GanCubeDriver (emits face: FaceletColor)
export class ColorCubeEventEmitter extends TypedEventEmitter<ColorEventMap> {}

export interface CubeDriver extends CubeEventEmitter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  /** Reset internal cube-state tracking to solved. Called when the user resets cube state in the app. */
  resetFacelets?(): void
  /** Sync the driver's internal facelets to an externally-computed value.
   *  Called after reorientToStandard so the driver's center-tracking map stays in sync. */
  syncFacelets?(facelets: string): void
}

export interface ColorCubeDriver extends ColorCubeEventEmitter {
  connect(): Promise<void>
  disconnect(): Promise<void>
}

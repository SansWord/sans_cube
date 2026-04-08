import type { Move, Quaternion } from '../types/cube'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

type EventMap = {
  move: Move
  /** Emitted when a previously emitted move is retroactively identified as a slice.
   *  Consumers should replace the last recorded move with this one. */
  replacePreviousMove: Move
  gyro: Quaternion
  connection: ConnectionStatus
  battery: number   // 0–100 percent
}

type EventHandler<T> = (payload: T) => void

export class CubeEventEmitter {
  private handlers: { [K in keyof EventMap]?: EventHandler<EventMap[K]>[] } = {}

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.handlers[event]) this.handlers[event] = []
    ;(this.handlers[event] as EventHandler<EventMap[K]>[]).push(handler)
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const arr = this.handlers[event] as EventHandler<EventMap[K]>[] | undefined
    ;(this.handlers as Record<K, EventHandler<EventMap[K]>[] | undefined>)[event] = arr?.filter(
      (h) => h !== handler
    )
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    ;(this.handlers[event] as EventHandler<EventMap[K]>[])?.forEach((h) => h(payload))
  }

  removeAllListeners(): void {
    this.handlers = {}
  }
}

export interface CubeDriver extends CubeEventEmitter {
  connect(): Promise<void>
  disconnect(): Promise<void>
}

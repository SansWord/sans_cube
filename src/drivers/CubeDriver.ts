import type { Move, CubeState, Quaternion } from '../types/cube'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

type EventMap = {
  move: Move
  state: CubeState
  gyro: Quaternion
  connection: ConnectionStatus
}

type EventHandler<T> = (payload: T) => void

export class CubeEventEmitter {
  private handlers: { [K in keyof EventMap]?: EventHandler<EventMap[K]>[] } = {}

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.handlers[event]) this.handlers[event] = []
    ;(this.handlers[event] as EventHandler<EventMap[K]>[]).push(handler)
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers[event] = ((this.handlers[event] ?? []) as EventHandler<EventMap[K]>[]).filter(
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
  requestState(): Promise<void>
}

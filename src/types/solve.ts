import type { Face, Direction, Move } from './cube'

export interface ScrambleStep {
  face: Face
  direction: Direction
  double: boolean
}

export interface PhaseRecord {
  label: string
  group?: string        // e.g. 'F2L' for visual grouping
  recognitionMs: number
  executionMs: number
  turns: number
}

export interface SolveRecord {
  id: number            // sequential, 1-indexed
  scramble: string
  timeMs: number        // wall-clock solve duration
  moves: Move[]         // all moves with cubeTimestamp for replay
  phases: PhaseRecord[]
  date: number          // Unix timestamp (Date.now())
}

export interface Phase {
  label: string
  group?: string
  color: string
  isComplete: (facelets: string) => boolean
}

export interface SolveMethod {
  id: string
  label: string
  phases: Phase[]
}

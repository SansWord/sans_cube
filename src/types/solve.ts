import type { Face, Direction, Move, Quaternion } from './cube'

export interface QuaternionSnapshot {
  quaternion: Quaternion
  relativeMs: number   // ms since first move of the solve
}

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
  id: number            // internal key (sequential in local mode, timestamp in cloud mode)
  seq?: number          // display number: stable 1-indexed counter, gaps allowed on delete
  schemaVersion?: number // 1 = pre-fix (GAN face events stored as fixed color map), 2 = post-fix (center-tracking). Absent = v1.
  scramble: string
  timeMs: number        // wall-clock solve duration
  moves: Move[]         // all moves with cubeTimestamp for replay
  movesV1?: Move[]      // original pre-migration moves; present only on Firestore-migrated
                        // records awaiting user review. Absent on localStorage and new records.
  migrationNote?: string // diff summary from v1→v2 migration when phases changed; cleared on review
  phases: PhaseRecord[]
  date: number          // Unix timestamp (Date.now())
  quaternionSnapshots?: QuaternionSnapshot[]
  driver?: 'cube' | 'mouse'
  isExample?: boolean
  method?: string       // 'cfop' | 'roux'; absent on old solves, treated as 'cfop'
  shareId?: string      // Firestore doc ID in public_solves; absent = not shared
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

export type MethodFilter = 'all' | 'cfop' | 'roux'

export type DriverFilter = 'all' | 'cube' | 'mouse'

export interface SolveFilter {
  method: MethodFilter
  driver: DriverFilter
}

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type SliceFace = 'M' | 'E' | 'S'
export type RotationFace = 'x' | 'y' | 'z'
export type PositionalFace = Face | SliceFace | RotationFace
// Backward-compat alias — retire in a follow-up session
export type AnyFace = PositionalFace

export type Direction = 'CW' | 'CCW'

// Single-letter color codes used in the facelets string
export type FaceletColor = 'W' | 'R' | 'G' | 'Y' | 'O' | 'B'

// Generic move — single source of truth for all move shapes
export interface MoveOf<TFace> {
  face: TFace
  direction: Direction
  cubeTimestamp: number
  serial: number
  quaternion?: Quaternion
}

// Position-based moves (geometric face labels) — canonical name for new code
export type PositionMove = MoveOf<PositionalFace>
// Backward-compat alias — all existing code using Move continues to work
export type Move = PositionMove

// Color-based move — emitted by GanCubeDriver before translation
export type ColorMove = MoveOf<FaceletColor>

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface SolveSession {
  // cubeTimestamp mirrors move.cubeTimestamp for convenient access during replay scheduling
  moves: Array<{ move: Move; cubeTimestamp: number }>
  startTimestamp: number
  endTimestamp: number
}

export type CubeColor = 'white' | 'yellow' | 'red' | 'orange' | 'blue' | 'green'

export interface OrientationConfig {
  frontFace: CubeColor
  bottomFace: CubeColor
  referenceQuaternion: Quaternion | null
}

export interface GesturePattern {
  face: Face
  direction?: Direction
  count: number
  windowMs: number
}

export const SOLVED_FACELETS = 'WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB'

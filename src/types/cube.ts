export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type SliceFace = 'M' | 'E' | 'S'
export type RotationFace = 'x' | 'y' | 'z'
export type AnyFace = Face | SliceFace | RotationFace
export type Direction = 'CW' | 'CCW'

// Single-letter color codes used in the facelets string (future: will replace face letters)
export type FaceletColor = 'W' | 'R' | 'G' | 'Y' | 'O' | 'B'

export interface Move {
  face: AnyFace
  direction: Direction
  cubeTimestamp: number
  serial: number
  quaternion?: Quaternion
}

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

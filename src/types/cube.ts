export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type Direction = 'CW' | 'CCW'

export interface Move {
  face: Face
  direction: Direction
  cubeTimestamp: number
  serial: number
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

export const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'

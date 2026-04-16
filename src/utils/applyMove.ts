// src/utils/applyMove.ts
import type { PositionMove } from '../types/cube'

// Face layout in 54-char Kociemba string:
// U: 0-8, R: 9-17, F: 18-26, D: 27-35, L: 36-44, B: 45-53
// Each face: stickers 0-8 top-left to bottom-right, row by row

function rotateFaceCW(f: string[], start: number) {
  const [a, b, c, d, e, f2, g, h, i] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => f[start + j])
  f[start + 0] = g; f[start + 1] = d; f[start + 2] = a
  f[start + 3] = h; f[start + 4] = e; f[start + 5] = b
  f[start + 6] = i; f[start + 7] = f2; f[start + 8] = c
}

function rotateFaceCCW(f: string[], start: number) {
  const [a, b, c, d, e, f2, g, h, i] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => f[start + j])
  f[start + 0] = c; f[start + 1] = f2; f[start + 2] = i
  f[start + 3] = b; f[start + 4] = e; f[start + 5] = h
  f[start + 6] = a; f[start + 7] = d; f[start + 8] = g
}

// Cycle 4 groups of 3 stickers (CW: a←d, d←c, c←b, b←a_old)
function cycle3CW(
  f: string[],
  a0: number, a1: number, a2: number,
  b0: number, b1: number, b2: number,
  c0: number, c1: number, c2: number,
  d0: number, d1: number, d2: number,
) {
  const [ta, tb, tc] = [f[a0], f[a1], f[a2]]
  f[a0] = f[d0]; f[a1] = f[d1]; f[a2] = f[d2]
  f[d0] = f[c0]; f[d1] = f[c1]; f[d2] = f[c2]
  f[c0] = f[b0]; f[c1] = f[b1]; f[c2] = f[b2]
  f[b0] = ta; f[b1] = tb; f[b2] = tc
}

function cycle3CCW(
  f: string[],
  a0: number, a1: number, a2: number,
  b0: number, b1: number, b2: number,
  c0: number, c1: number, c2: number,
  d0: number, d1: number, d2: number,
) {
  const [ta, tb, tc] = [f[a0], f[a1], f[a2]]
  f[a0] = f[b0]; f[a1] = f[b1]; f[a2] = f[b2]
  f[b0] = f[c0]; f[b1] = f[c1]; f[b2] = f[c2]
  f[c0] = f[d0]; f[c1] = f[d1]; f[c2] = f[d2]
  f[d0] = ta; f[d1] = tb; f[d2] = tc
}

// Apply a single move to a facelets string.
export function applyMoveToFacelets(facelets: string, move: PositionMove): string {
  const f = facelets.split('')
  const ccw = move.direction === 'CCW'
  const cycle = ccw ? cycle3CCW : cycle3CW

  switch (move.face) {
    case 'U':
      if (ccw) rotateFaceCCW(f, 0); else rotateFaceCW(f, 0)
      cycle(f, 18, 19, 20, 36, 37, 38, 45, 46, 47, 9, 10, 11)
      break
    case 'D':
      if (ccw) rotateFaceCCW(f, 27); else rotateFaceCW(f, 27)
      cycle(f, 24, 25, 26, 15, 16, 17, 51, 52, 53, 42, 43, 44)
      break
    case 'R':
      if (ccw) rotateFaceCCW(f, 9); else rotateFaceCW(f, 9)
      cycle(f, 2, 5, 8, 51, 48, 45, 29, 32, 35, 20, 23, 26)
      break
    case 'L':
      if (ccw) rotateFaceCCW(f, 36); else rotateFaceCW(f, 36)
      cycle(f, 0, 3, 6, 18, 21, 24, 27, 30, 33, 53, 50, 47)
      break
    case 'F':
      if (ccw) rotateFaceCCW(f, 18); else rotateFaceCW(f, 18)
      cycle(f, 6, 7, 8, 9, 12, 15, 29, 28, 27, 44, 41, 38)
      break
    case 'B':
      if (ccw) rotateFaceCCW(f, 45); else rotateFaceCW(f, 45)
      cycle(f, 0, 1, 2, 42, 39, 36, 35, 34, 33, 11, 14, 17)
      break

    case 'M':
      // Middle col between L and R, L direction. U→F→D→B(rev)→U
      // B reversed: stored looking from behind, so middle col runs 52,49,46 (not 46,49,52)
      cycle(f, 1, 4, 7,  19, 22, 25,  28, 31, 34,  52, 49, 46)
      break

    case 'E':
      // Middle row between U and D, D direction. F→R→B→L→F
      cycle(f, 21, 22, 23,  12, 13, 14,  48, 49, 50,  39, 40, 41)
      break

    case 'S':
      // Middle layer between F and B, F direction. U(row)→R(col)→D(row,rev)→L(col,rev)→U
      cycle(f, 3, 4, 5,  10, 13, 16,  32, 31, 30,  43, 40, 37)
      break

    case 'x': {
      if (ccw) rotateFaceCCW(f, 9); else rotateFaceCW(f, 9)
      if (ccw) rotateFaceCW(f, 36); else rotateFaceCCW(f, 36)
      const uSlice = f.slice(0, 9); const fSlice = f.slice(18, 27)
      const dSlice = f.slice(27, 36); const bSlice = f.slice(45, 54)
      if (!ccw) {
        for (let i = 0; i < 9; i++) f[i]      = fSlice[i]
        for (let i = 0; i < 9; i++) f[18 + i] = dSlice[i]
        for (let i = 0; i < 9; i++) f[27 + i] = bSlice[8 - i]
        for (let i = 0; i < 9; i++) f[45 + i] = uSlice[8 - i]
      } else {
        for (let i = 0; i < 9; i++) f[i]      = bSlice[8 - i]
        for (let i = 0; i < 9; i++) f[18 + i] = uSlice[i]
        for (let i = 0; i < 9; i++) f[27 + i] = fSlice[i]
        for (let i = 0; i < 9; i++) f[45 + i] = dSlice[8 - i]
      }
      break
    }
    case 'y': {
      if (ccw) rotateFaceCCW(f, 0); else rotateFaceCW(f, 0)
      if (ccw) rotateFaceCW(f, 27); else rotateFaceCCW(f, 27)
      const rSlice = f.slice(9, 18); const fSlice = f.slice(18, 27)
      const lSlice = f.slice(36, 45); const bSlice = f.slice(45, 54)
      if (!ccw) {
        for (let i = 0; i < 9; i++) f[9 + i]  = bSlice[i]
        for (let i = 0; i < 9; i++) f[18 + i] = rSlice[i]
        for (let i = 0; i < 9; i++) f[36 + i] = fSlice[i]
        for (let i = 0; i < 9; i++) f[45 + i] = lSlice[i]
      } else {
        for (let i = 0; i < 9; i++) f[9 + i]  = fSlice[i]
        for (let i = 0; i < 9; i++) f[18 + i] = lSlice[i]
        for (let i = 0; i < 9; i++) f[36 + i] = bSlice[i]
        for (let i = 0; i < 9; i++) f[45 + i] = rSlice[i]
      }
      break
    }
    case 'z': {
      if (ccw) rotateFaceCCW(f, 18); else rotateFaceCW(f, 18)
      if (ccw) rotateFaceCW(f, 45); else rotateFaceCCW(f, 45)
      const cw90src  = [6, 3, 0, 7, 4, 1, 8, 5, 2]
      const ccw90src = [2, 5, 8, 1, 4, 7, 0, 3, 6]
      const src = ccw ? ccw90src : cw90src
      const uSlice = f.slice(0, 9); const rSlice = f.slice(9, 18)
      const dSlice = f.slice(27, 36); const lSlice = f.slice(36, 45)
      if (!ccw) {
        for (let p = 0; p < 9; p++) f[p]       = lSlice[src[p]]
        for (let p = 0; p < 9; p++) f[9 + p]   = uSlice[src[p]]
        for (let p = 0; p < 9; p++) f[27 + p]  = rSlice[src[p]]
        for (let p = 0; p < 9; p++) f[36 + p]  = dSlice[src[p]]
      } else {
        for (let p = 0; p < 9; p++) f[p]       = rSlice[src[p]]
        for (let p = 0; p < 9; p++) f[9 + p]   = dSlice[src[p]]
        for (let p = 0; p < 9; p++) f[27 + p]  = lSlice[src[p]]
        for (let p = 0; p < 9; p++) f[36 + p]  = uSlice[src[p]]
      }
      break
    }
  }

  return f.join('')
}

/**
 * Apply a whole-cube rotation to return the cube to standard orientation
 * (white=U, green=F). Does not touch corner or edge scramble state — only
 * reframes it from the user's new hold position.
 *
 * Algorithm:
 *   Step 1 — tilt (x or z) to bring white center to U face.
 *   Step 2 — spin (y) to bring green center to F face.
 *
 * Whole-cube rotations (x/y/z) are fully supported by applyMoveToFacelets,
 * so this is just two sequential lookups and at most 3 moves.
 */
export function reorientToStandard(facelets: string): string {
  const CENTERS = [4, 13, 22, 31, 40, 49] as const
  let f = facelets

  const rot = (face: 'x' | 'y' | 'z', direction: 'CW' | 'CCW'): string =>
    applyMoveToFacelets(f, { face, direction, cubeTimestamp: 0, serial: 0 })

  // Step 1: bring white to U face (position 4)
  // x CW: F→U | x CCW: B→U | z CW: L→U | z CCW: R→U | x2: D→U
  const whiteAt = CENTERS.find(pos => f[pos] === 'W')!
  if      (whiteAt === 13) { f = rot('z', 'CCW') }           // R→U
  else if (whiteAt === 22) { f = rot('x', 'CW') }            // F→U
  else if (whiteAt === 31) { f = rot('x', 'CW'); f = rot('x', 'CW') }  // D→U via x2
  else if (whiteAt === 40) { f = rot('z', 'CW') }            // L→U
  else if (whiteAt === 49) { f = rot('x', 'CCW') }           // B→U
  // whiteAt === 4: already at U

  // Step 2: spin y to bring green to F face (position 22); white stays at U
  // y CW: R→F | y CCW: L→F | y2: B→F
  const greenAt = CENTERS.find(pos => f[pos] === 'G')!
  if      (greenAt === 13) { f = rot('y', 'CW') }            // R→F
  else if (greenAt === 40) { f = rot('y', 'CCW') }           // L→F
  else if (greenAt === 49) { f = rot('y', 'CW'); f = rot('y', 'CW') }  // B→F via y2
  // greenAt === 22: already at F

  return f
}

// Center sticker positions (one per face, in face order U R F D L B)
const FACE_CENTERS = [4, 13, 22, 31, 40, 49]

export function isSolvedFacelets(facelets: string): boolean {
  for (let face = 0; face < 6; face++) {
    const center = facelets[FACE_CENTERS[face]]
    for (let i = 0; i < 9; i++) {
      if (facelets[face * 9 + i] !== center) return false
    }
  }
  return true
}

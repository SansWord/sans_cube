// Face centers in the Kociemba facelets string. Since M/E/S slice moves or
// whole-cube rotations can drift centers to non-standard faces, these isDone
// checks look up the target color's current face position instead of assuming
// Y is on D and W is on U. Adjacent-face stickers are compared against the
// live center color of their face rather than hardcoded letters.

const U_CENTER = 4
const R_CENTER = 13
const F_CENTER = 22
const D_CENTER = 31
const L_CENTER = 40
const B_CENTER = 49

const FACE_CENTERS = [U_CENTER, R_CENTER, F_CENTER, D_CENTER, L_CENTER, B_CENTER]

const FACE_POSITIONS: Record<number, number[]> = {
  [U_CENTER]: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [R_CENTER]: [9, 10, 11, 12, 13, 14, 15, 16, 17],
  [F_CENTER]: [18, 19, 20, 21, 22, 23, 24, 25, 26],
  [D_CENTER]: [27, 28, 29, 30, 31, 32, 33, 34, 35],
  [L_CENTER]: [36, 37, 38, 39, 40, 41, 42, 43, 44],
  [B_CENTER]: [45, 46, 47, 48, 49, 50, 51, 52, 53],
}

const OPPOSITE: Record<number, number> = {
  [U_CENTER]: D_CENTER,
  [D_CENTER]: U_CENTER,
  [F_CENTER]: B_CENTER,
  [B_CENTER]: F_CENTER,
  [R_CENTER]: L_CENTER,
  [L_CENTER]: R_CENTER,
}

// Each edge: [pos on side A, center of side A, pos on side B, center of side B]
type Edge = [number, number, number, number]
const EDGES: Edge[] = [
  [7,  U_CENTER, 19, F_CENTER],  // UF
  [5,  U_CENTER, 10, R_CENTER],  // UR
  [1,  U_CENTER, 46, B_CENTER],  // UB
  [3,  U_CENTER, 37, L_CENTER],  // UL
  [23, F_CENTER, 12, R_CENTER],  // FR
  [21, F_CENTER, 41, L_CENTER],  // FL
  [48, B_CENTER, 14, R_CENTER],  // BR
  [50, B_CENTER, 39, L_CENTER],  // BL
  [28, D_CENTER, 25, F_CENTER],  // DF
  [32, D_CENTER, 16, R_CENTER],  // DR
  [34, D_CENTER, 52, B_CENTER],  // DB
  [30, D_CENTER, 43, L_CENTER],  // DL
]

// Each corner: 3 pairs of [sticker pos, owning face center]
type Corner = [[number, number], [number, number], [number, number]]
const CORNERS: Corner[] = [
  [[8,  U_CENTER], [20, F_CENTER], [9,  R_CENTER]],  // UFR
  [[6,  U_CENTER], [18, F_CENTER], [38, L_CENTER]],  // UFL
  [[2,  U_CENTER], [47, B_CENTER], [11, R_CENTER]],  // UBR
  [[0,  U_CENTER], [45, B_CENTER], [36, L_CENTER]],  // UBL
  [[29, D_CENTER], [26, F_CENTER], [15, R_CENTER]],  // DFR
  [[27, D_CENTER], [24, F_CENTER], [44, L_CENTER]],  // DFL
  [[35, D_CENTER], [51, B_CENTER], [17, R_CENTER]],  // DBR
  [[33, D_CENTER], [53, B_CENTER], [42, L_CENTER]],  // DBL
]

function edgesOnFace(centerIdx: number): Edge[] {
  return EDGES.filter(([, c1, , c2]) => c1 === centerIdx || c2 === centerIdx)
}

function cornersOnFace(centerIdx: number): Corner[] {
  return CORNERS.filter((c) => c.some(([, ctr]) => ctr === centerIdx))
}

function findFaceWithColor(f: string, color: string): number | undefined {
  return FACE_CENTERS.find((c) => f[c] === color)
}

// Cross: 4 edges around the Y-center face have Y on that face and adjacent
// stickers matching their face centers.
export function isCrossDone(f: string): boolean {
  const crossFace = findFaceWithColor(f, 'Y')
  if (crossFace === undefined) return false
  for (const [p1, c1, p2, c2] of edgesOnFace(crossFace)) {
    const [ownPos, adjPos, adjCenter] =
      c1 === crossFace ? [p1, p2, c2] : [p2, p1, c1]
    if (f[ownPos] !== 'Y') return false
    if (f[adjPos] !== f[adjCenter]) return false
  }
  return true
}

export function countCompletedF2LSlots(f: string): number {
  const dFace = findFaceWithColor(f, 'Y')
  if (dFace === undefined) return 0
  const opposite = OPPOSITE[dFace]
  const sideCenters = FACE_CENTERS.filter((c) => c !== dFace && c !== opposite)

  let count = 0
  for (let i = 0; i < sideCenters.length; i++) {
    for (let j = i + 1; j < sideCenters.length; j++) {
      const s1 = sideCenters[i]
      const s2 = sideCenters[j]
      if (OPPOSITE[s1] === s2) continue  // non-adjacent side pair

      const corner = CORNERS.find((c) => {
        const ctrs = c.map(([, ctr]) => ctr)
        return ctrs.includes(dFace) && ctrs.includes(s1) && ctrs.includes(s2)
      })
      const edge = EDGES.find(([, c1, , c2]) =>
        (c1 === s1 && c2 === s2) || (c1 === s2 && c2 === s1)
      )
      if (!corner || !edge) continue

      if (isF2LSlotComplete(f, dFace, corner, edge)) count++
    }
  }
  return count
}

function isF2LSlotComplete(f: string, dFace: number, corner: Corner, edge: Edge): boolean {
  for (const [pos, ctr] of corner) {
    if (ctr === dFace) {
      if (f[pos] !== 'Y') return false
    } else {
      if (f[pos] !== f[ctr]) return false
    }
  }
  const [p1, c1, p2, c2] = edge
  return f[p1] === f[c1] && f[p2] === f[c2]
}

// EOLL: all 4 edges on the W-center face have W on that face.
export function isEOLLDone(f: string): boolean {
  const ollFace = findFaceWithColor(f, 'W')
  if (ollFace === undefined) return false
  for (const [p1, c1, p2] of edgesOnFace(ollFace)) {
    const ownPos = c1 === ollFace ? p1 : p2
    if (f[ownPos] !== 'W') return false
  }
  return true
}

// OLL: all 9 stickers on the W-center face are W.
export function isOLLDone(f: string): boolean {
  const ollFace = findFaceWithColor(f, 'W')
  if (ollFace === undefined) return false
  for (const p of FACE_POSITIONS[ollFace]) {
    if (f[p] !== 'W') return false
  }
  return true
}

// CPLL: each non-W sticker of the 4 corners on the W-center face matches its
// adjacent face center.
export function isCPLLDone(f: string): boolean {
  const ollFace = findFaceWithColor(f, 'W')
  if (ollFace === undefined) return false
  for (const corner of cornersOnFace(ollFace)) {
    for (const [pos, ctr] of corner) {
      if (ctr === ollFace) continue
      if (f[pos] !== f[ctr]) return false
    }
  }
  return true
}

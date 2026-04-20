import {
  OPPOSITE,
  U_CENTER,
  D_CENTER,
  F_CENTER,
  B_CENTER,
  type Edge,
  edgesOnFace,
  cornersOnFace,
  findFaceWithColor,
} from './cubeGeometry'
import { reorientToStandard } from './applyMove'

// Roux side-block (1×2×3): 1 center + 1 "long" edge + 2 perpendicular edges
// on the same face + 2 corners at the long edge's ends. A block is identified
// by two cubie colors: main color (O for FB, R for SB) and long color (Y for
// both — the stickers on the 3-long side). The perp ends get whatever G/B
// stickers the corners contribute.
//
// Why not compare every sticker to its live center: M-slice moves drift the
// U/F/D/B centers while leaving the block's 6 cubies physically in place, so
// the long-Y stickers on the block are no longer adjacent to the Y center.
// The block is still "formed" — we just check main against its (undriftable)
// own center, long against hardcoded Y, and each perp face for internal
// consistency across its edge+corner pair.
function isBlockOnFace(
  f: string,
  mainFace: number,
  longEdge: Edge,
  longColor: string,
): boolean {
  const mainColor = f[mainFace]
  const longFace = longEdge[1] === mainFace ? longEdge[3] : longEdge[1]
  const oppLong = OPPOSITE[longFace]

  const longMainPos = longEdge[1] === mainFace ? longEdge[0] : longEdge[2]
  const longLongPos = longEdge[1] === mainFace ? longEdge[2] : longEdge[0]
  if (f[longMainPos] !== mainColor) return false
  if (f[longLongPos] !== longColor) return false

  const perpEdges = edgesOnFace(mainFace).filter((e) => {
    const other = e[1] === mainFace ? e[3] : e[1]
    return other !== longFace && other !== oppLong
  })

  const blockCorners = cornersOnFace(mainFace).filter((c) =>
    c.some(([, ctr]) => ctr === longFace),
  )

  for (const c of blockCorners) {
    for (const [pos, ctr] of c) {
      if (ctr === mainFace && f[pos] !== mainColor) return false
      if (ctr === longFace && f[pos] !== longColor) return false
    }
  }

  for (const e of perpEdges) {
    const perpFace = e[1] === mainFace ? e[3] : e[1]
    const perpMainPos = e[1] === mainFace ? e[0] : e[2]
    const perpSidePos = e[1] === mainFace ? e[2] : e[0]
    if (f[perpMainPos] !== mainColor) return false
    const perpCorner = blockCorners.find((c) => c.some(([, ctr]) => ctr === perpFace))
    if (!perpCorner) return false
    const cornerPerpPos = perpCorner.find(([, ctr]) => ctr === perpFace)![0]
    if (f[cornerPerpPos] !== f[perpSidePos]) return false
  }

  return true
}

// If a (mainColor, longColor) 1×2×3 block is assembled on `mainFace`, returns
// the color of the center currently adjacent to the long-face stickers. For
// (O, Y) or (R, Y) this is one of {W, Y, G, B} — never O/R since O↔R are
// opposite and M/E/S cycles never swap them into adjacent positions.
// Returns undefined if no orientation of the block is complete.
function blockOrientation(
  f: string,
  mainFace: number,
  longColor: string,
): string | undefined {
  for (const edge of edgesOnFace(mainFace)) {
    if (isBlockOnFace(f, mainFace, edge, longColor)) {
      const longFace = edge[1] === mainFace ? edge[3] : edge[1]
      return f[longFace]
    }
  }
  return undefined
}

export function isFirstBlockDone(f: string): boolean {
  const oFace = findFaceWithColor(f, 'O')
  if (oFace !== undefined && blockOrientation(f, oFace, 'Y') !== undefined) return true
  const rFace = findFaceWithColor(f, 'R')
  if (rFace !== undefined && blockOrientation(f, rFace, 'Y') !== undefined) return true
  return false
}

// Second block: both (O, Y) and (R, Y) blocks complete, pointing at the same
// (possibly drifted) neighbor color — i.e. their long axes align spatially.
export function isSecondBlockDone(f: string): boolean {
  const oFace = findFaceWithColor(f, 'O')
  const rFace = findFaceWithColor(f, 'R')
  if (oFace === undefined || rFace === undefined) return false
  const oOrient = blockOrientation(f, oFace, 'Y')
  const rOrient = blockOrientation(f, rFace, 'Y')
  return oOrient !== undefined && oOrient === rOrient
}

// CMLL: the 4 corners opposite the blocks' long-Y face are permuted & oriented
// correctly. CMLL face = opposite of the block's long face. After reorient,
// blocks sit on L/R (chirality-preserved), so the long face can be U/D/F/B
// depending on M-slice drift — we dispatch to the matching isXCMLLDone variant.
// Color equality (not hardcoded 'W') tolerates drift: after M the center at the
// CMLL face isn't W anymore, but all 4 corner stickers there are still equal.
function isUCMLLDone(f: string): boolean {
  return (
    f[0] === f[2] && f[2] === f[6] && f[6] === f[8] &&  // U: all 4 corners same
    f[18] === f[20] &&  // F: UFL, UFR
    f[45] === f[47] &&  // B: UBR, UBL
    f[36] === f[38] &&  // L: UBL, UFL
    f[9]  === f[11]     // R: UFR, UBR
  )
}

function isDCMLLDone(f: string): boolean {
  return (
    f[27] === f[29] && f[29] === f[33] && f[33] === f[35] &&  // D: all 4 corners same
    f[24] === f[26] &&  // F: DFL, DFR
    f[51] === f[53] &&  // B: DBR, DBL
    f[42] === f[44] &&  // L: DBL, DFL
    f[15] === f[17]     // R: DFR, DBR
  )
}

function isFCMLLDone(f: string): boolean {
  return (
    f[18] === f[20] && f[20] === f[24] && f[24] === f[26] &&  // F: all 4 corners same
    f[6]  === f[8]  &&  // U: UFL, UFR
    f[27] === f[29] &&  // D: DFL, DFR
    f[38] === f[44] &&  // L: UFL, DFL
    f[9]  === f[15]     // R: UFR, DFR
  )
}

function isBCMLLDone(f: string): boolean {
  return (
    f[45] === f[47] && f[47] === f[51] && f[51] === f[53] &&  // B: all 4 corners same
    f[0]  === f[2]  &&  // U: UBL, UBR
    f[33] === f[35] &&  // D: DBL, DBR
    f[36] === f[42] &&  // L: UBL, DBL
    f[11] === f[17]     // R: UBR, DBR
  )
}

export function isCMLLDone(f: string): boolean {
  const n = reorientToStandard(f)
  if (!isSecondBlockDone(n)) return false
  const oFace = findFaceWithColor(n, 'O')
  if (oFace === undefined) return false
  let longFace: number | undefined
  for (const edge of edgesOnFace(oFace)) {
    if (isBlockOnFace(n, oFace, edge, 'Y')) {
      longFace = edge[1] === oFace ? edge[3] : edge[1]
      break
    }
  }
  if (longFace === undefined) return false
  const cmllFace = OPPOSITE[longFace]
  switch (cmllFace) {
    case U_CENTER: return isUCMLLDone(n)
    case D_CENTER: return isDCMLLDone(n)
    case F_CENTER: return isFCMLLDone(n)
    case B_CENTER: return isBCMLLDone(n)
  }
  return false
}

function isMSliceUD(f: string): boolean {
  return (f[7]  === 'W' || f[7]  === 'Y') &&   // UF
         (f[1]  === 'W' || f[1]  === 'Y') &&   // UB
         (f[28] === 'W' || f[28] === 'Y') &&   // DF
         (f[34] === 'W' || f[34] === 'Y')      // DB
}

function isMSliceFB(f: string): boolean {
  return (f[19] === 'W' || f[19] === 'Y') &&   // UF-F
         (f[25] === 'W' || f[25] === 'Y') &&   // DF-F
         (f[46] === 'W' || f[46] === 'Y') &&   // UB-B
         (f[52] === 'W' || f[52] === 'Y')      // DB-B
}

function isMSlice(f: string): boolean {
  return isMSliceFB(f) || isMSliceUD(f)
}

// All 6 LSE edges oriented: U/D-colored sticker faces U or D.
// M-slice edges (UF, UB, DF, DB) are always the same.
// Column edges differ by block position:
//   blocks at D (LD+RD) → UL, UR
//   blocks at U (LU+RU) → DL, DR (UL/UR are inside the blocks)
function isEODoneUD(f: string): boolean {
  // corner alignment
  const isCornerAligned =
    (f[36] === f[38]) && (f[38] === f[42]) && (f[42] === f[44]) && (f[44] === "O") &&
    (f[9] === f[11]) && (f[11] === f[15]) && (f[15] === f[17]) && (f[17] === "R")

  return isCornerAligned && isCMLLDone(f) && isMSlice(f) && (
    // blocks at D: column edges UL, UR
    ((f[3]  === 'W' || f[3]  === 'Y') && (f[5]  === 'W' || f[5]  === 'Y')) ||
    // blocks at U: column edges DL, DR
    ((f[30] === 'W' || f[30] === 'Y') && (f[32] === 'W' || f[32] === 'Y'))
  )
}

// All 6 LSE edges oriented: U/D-colored sticker faces F or B.
// M-slice edges (FU, FD, BU, BD) are always the same.
// Column edges differ by block position:
//   blocks at B (LB+RB) → FL, FR
//   blocks at F (LF+RF) → BL, BR (BL/BR are inside the blocks)
function isEODoneFB(f: string): boolean {
  // corner alignment
  const isCornerAligned =
    (f[36] === f[38]) && (f[38] === f[42]) && (f[42] === f[44]) && (f[44] === "O") &&
    (f[9] === f[11]) && (f[11] === f[15]) && (f[15] === f[17]) && (f[17] === "R")

  return isCornerAligned && isCMLLDone(f) && isMSlice(f) && (
    // blocks at B: column edges FL, FR
    ((f[21]  === 'W' || f[21]  === 'Y') && (f[23]  === 'W' || f[23]  === 'Y')) ||
    // blocks at F: column edges BL, BR
    ((f[48] === 'W' || f[48] === 'Y') && (f[50] === 'W' || f[50] === 'Y'))
  )
}

export function isEODone(f: string): boolean {
  const n = reorientToStandard(f)
  return isEODoneFB(n) || isEODoneUD(n)
}

// Two free column edges (not inside the blocks) placed at home.
// Which pair is free depends on block orientation:
//   blocks at D (LD+RD) → UL + UR
//   blocks at U (LU+RU) → DL + DR
//   blocks at F (LF+RF) → BL + BR
//   blocks at B (LB+RB) → FL + FR
// Reorient first so hardcoded 'W'/'O'/'R' sticker checks stay valid under
// whole-cube rotations.
export function isULURDone(f: string): boolean {
  const n = reorientToStandard(f)
  return isEODone(n) && (
    (n[3]  === 'W' && n[37] === 'O' && n[5]  === 'W' && n[10] === 'R') ||  // UL + UR
    (n[30] === 'W' && n[43] === 'O' && n[32] === 'W' && n[16] === 'R') ||  // DL + DR
    (n[50] === 'W' && n[39] === 'O' && n[48] === 'W' && n[14] === 'R') ||  // BL + BR
    (n[21] === 'W' && n[41] === 'O' && n[23] === 'W' && n[12] === 'R')     // FL + FR
  )
}

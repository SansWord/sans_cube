export function isLDBlockDone(f: string): boolean {
  return (
    f[27] === 'D' && f[24] === 'F' && f[44] === 'L' &&  // DFL corner
    f[33] === 'D' && f[53] === 'B' && f[42] === 'L' &&  // DBL corner
    f[30] === 'D' && f[43] === 'L' &&                    // DL edge
    f[21] === 'F' && f[41] === 'L' &&                    // FL edge
    f[50] === 'B' && f[39] === 'L'                       // BL edge
  )
}

export function isRDBlockDone(f: string): boolean {
  return (
    f[29] === 'D' && f[26] === 'F' && f[15] === 'R' &&  // DFR corner
    f[35] === 'D' && f[51] === 'B' && f[17] === 'R' &&  // DBR corner
    f[32] === 'D' && f[16] === 'R' &&                    // DR edge
    f[23] === 'F' && f[12] === 'R' &&                    // FR edge
    f[48] === 'B' && f[14] === 'R'                       // BR edge
  )
}

export function isFirstBlockDone(f: string): boolean {
  return isLDBlockDone(f) || isRDBlockDone(f)
}

export function isSecondBlockDone(f: string): boolean {
  return isLDBlockDone(f) && isRDBlockDone(f)
}

// All 4 U-layer corners solved. M-slice edges are ignored.
export function isCMLLDone(f: string): boolean {
  return (
    f[6] === 'U' && f[18] === 'F' && f[38] === 'L' &&   // UFL corner
    f[8] === 'U' && f[20] === 'F' && f[9]  === 'R' &&   // UFR corner
    f[2] === 'U' && f[45] === 'B' && f[11] === 'R' &&   // UBR corner
    f[0] === 'U' && f[47] === 'B' && f[36] === 'L'      // UBL corner
  )
}

// All 6 LSE edges oriented: U/D-colored sticker faces U or D.
// Edges: UF, UB, DF, DB (M-slice) + UL, UR (column).
export function isEODone(f: string): boolean {
  return (
    (f[7]  === 'U' || f[7]  === 'D') &&   // UF
    (f[1]  === 'U' || f[1]  === 'D') &&   // UB
    (f[28] === 'U' || f[28] === 'D') &&   // DF
    (f[34] === 'U' || f[34] === 'D') &&   // DB
    (f[3]  === 'U' || f[3]  === 'D') &&   // UL
    (f[5]  === 'U' || f[5]  === 'D')      // UR
  )
}

// UL and UR edges in correct position and correctly oriented.
export function isULURDone(f: string): boolean {
  return (
    f[3] === 'U' && f[37] === 'L' &&   // UL edge
    f[5] === 'U' && f[10] === 'R'      // UR edge
  )
}

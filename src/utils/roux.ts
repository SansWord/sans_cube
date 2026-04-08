// L face layout (viewed from left, U=top, F=right):
//   UBL(36) UL(37)  UFL(38)
//   BL(39)  Lc(40)  FL(41)
//   DBL(42) DL(43)  DFL(44)
//
// R face layout (viewed from right, U=top, F=left):
//   UFR(9)  UR(10)  UBR(11)
//   FR(12)  Rc(13)  BR(14)
//   DFR(15) DR(16)  DBR(17)

// ── Left-side blocks ──────────────────────────────────────────────────────────

// rows 1+2: BL Lc FL DBL DL DFL
export function isLDBlockDone(f: string): boolean {
  return (
    f[39] === 'L' && f[41] === 'L' && f[42] === 'L' && f[43] === 'L' && f[44] === 'L' &&
    f[50] === f[53] &&                       // B: BL, DBL
    f[21] === f[24] &&                       // F: FL, DFL
    f[27] === f[30] && f[30] === f[33]       // D: DFL, DL, DBL
  )
}

// rows 0+1: UBL UL UFL BL Lc FL
export function isLUBlockDone(f: string): boolean {
  return (
    f[36] === 'L' && f[37] === 'L' && f[38] === 'L' && f[39] === 'L' && f[41] === 'L' &&
    f[0] === f[3] && f[3] === f[6] &&        // U: UBL, UL, UFL
    f[47] === f[50] &&                       // B: UBL, BL
    f[18] === f[21]                          // F: UFL, FL
  )
}

// cols 1+2: UL UFL Lc FL DL DFL
export function isLFBlockDone(f: string): boolean {
  return (
    f[37] === 'L' && f[38] === 'L' && f[41] === 'L' && f[43] === 'L' && f[44] === 'L' &&
    f[3] === f[6] &&                         // U: UL, UFL
    f[18] === f[21] && f[21] === f[24] &&    // F: UFL, FL, DFL
    f[27] === f[30]                          // D: DFL, DL
  )
}

// cols 0+1: UBL UL BL Lc DBL DL
export function isLBBlockDone(f: string): boolean {
  return (
    f[36] === 'L' && f[37] === 'L' && f[39] === 'L' && f[42] === 'L' && f[43] === 'L' &&
    f[0] === f[3] &&                         // U: UBL, UL
    f[47] === f[50] && f[50] === f[53] &&    // B: UBL, BL, DBL
    f[30] === f[33]                          // D: DL, DBL
  )
}

// ── Right-side blocks ─────────────────────────────────────────────────────────

// rows 1+2: FR Rc BR DFR DR DBR
export function isRDBlockDone(f: string): boolean {
  return (
    f[12] === 'R' && f[14] === 'R' && f[15] === 'R' && f[16] === 'R' && f[17] === 'R' &&
    f[23] === f[26] &&                       // F: FR, DFR
    f[48] === f[51] &&                       // B: BR, DBR
    f[29] === f[32] && f[32] === f[35]       // D: DFR, DR, DBR
  )
}

// rows 0+1: UFR UR UBR FR Rc BR
export function isRUBlockDone(f: string): boolean {
  return (
    f[9]  === 'R' && f[10] === 'R' && f[11] === 'R' && f[12] === 'R' && f[14] === 'R' &&
    f[2] === f[5] && f[5] === f[8] &&        // U: UBR, UR, UFR
    f[20] === f[23] &&                       // F: UFR, FR
    f[45] === f[48]                          // B: UBR, BR
  )
}

// cols 0+1: UFR UR FR Rc DFR DR
export function isRFBlockDone(f: string): boolean {
  return (
    f[9]  === 'R' && f[10] === 'R' && f[12] === 'R' && f[15] === 'R' && f[16] === 'R' &&
    f[5] === f[8] &&                         // U: UR, UFR
    f[20] === f[23] && f[23] === f[26] &&    // F: UFR, FR, DFR
    f[29] === f[32]                          // D: DFR, DR
  )
}

// cols 1+2: UR UBR Rc BR DR DBR
export function isRBBlockDone(f: string): boolean {
  return (
    f[10] === 'R' && f[11] === 'R' && f[14] === 'R' && f[16] === 'R' && f[17] === 'R' &&
    f[2] === f[5] &&                         // U: UBR, UR
    f[45] === f[48] && f[48] === f[51] &&    // B: UBR, BR, DBR
    f[32] === f[35]                          // D: DR, DBR
  )
}

// ── Phase checks ──────────────────────────────────────────────────────────────

function isLeftBlockDone(f: string): boolean {
  return isLDBlockDone(f) || isLUBlockDone(f) || isLFBlockDone(f) || isLBBlockDone(f)
}

function isRightBlockDone(f: string): boolean {
  return isRDBlockDone(f) || isRUBlockDone(f) || isRFBlockDone(f) || isRBBlockDone(f)
}

export function isFirstBlockDone(f: string): boolean {
  return isLeftBlockDone(f) || isRightBlockDone(f)
}

export function isSecondBlockDone(f: string): boolean {
  return (
      (isLDBlockDone(f) && isRDBlockDone(f)) ||
      (isLUBlockDone(f) && isRUBlockDone(f)) ||
      (isLFBlockDone(f) && isRFBlockDone(f)) ||
      (isLBBlockDone(f) && isRBBlockDone(f))
    )
}

// CMLL: all 4 corners in the layer opposite the two blocks are solved.
// Checked in 4 rotational positions (matching block orientations).
// M-slice edges are ignored throughout.

// U-layer corners: UBL UFL UFR UBR
function isUCMLLDone(f: string): boolean {
  return (
    f[0] === f[2] && f[2] === f[6] && f[6] === f[8] &&  // U: all same
    f[18] === f[20] &&  // F: UFL, UFR
    f[45] === f[47] &&  // B: UBR, UBL
    f[36] === f[38] &&  // L: UBL, UFL
    f[9]  === f[11]     // R: UFR, UBR
  )
}

// D-layer corners: DBL DFL DFR DBR
function isDCMLLDone(f: string): boolean {
  return (
    f[27] === f[29] && f[29] === f[33] && f[33] === f[35] &&  // D: all same
    f[24] === f[26] &&  // F: DFL, DFR
    f[51] === f[53] &&  // B: DBR, DBL
    f[42] === f[44] &&  // L: DBL, DFL
    f[15] === f[17]     // R: DFR, DBR
  )
}

// F-layer corners: UFL UFR DFL DFR
function isFCMLLDone(f: string): boolean {
  return (
    f[18] === f[20] && f[20] === f[24] && f[24] === f[26] &&  // F: all same
    f[6]  === f[8]  &&  // U: UFL, UFR
    f[27] === f[29] &&  // D: DFL, DFR
    f[38] === f[44] &&  // L: UFL, DFL
    f[9]  === f[15]     // R: UFR, DFR
  )
}

// B-layer corners: UBL UBR DBL DBR
function isBCMLLDone(f: string): boolean {
  return (
    f[45] === f[47] && f[47] === f[51] && f[51] === f[53] &&  // B: all same
    f[0]  === f[2]  &&  // U: UBL, UBR
    f[33] === f[35] &&  // D: DBL, DBR
    f[36] === f[42] &&  // L: UBL, DBL
    f[11] === f[17]     // R: UBR, DBR
  )
}

export function isCMLLDone(f: string): boolean {
  return isUCMLLDone(f) || isDCMLLDone(f) || isFCMLLDone(f) || isBCMLLDone(f)
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

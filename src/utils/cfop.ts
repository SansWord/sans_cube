export function isCrossDone(facelets: string): boolean {
  return (
    facelets[28] === 'D' && facelets[25] === 'F' &&
    facelets[32] === 'D' && facelets[16] === 'R' &&
    facelets[34] === 'D' && facelets[52] === 'B' &&
    facelets[30] === 'D' && facelets[43] === 'L'
  )
}

export function countCompletedF2LSlots(facelets: string): number {
  let count = 0
  // FR slot
  if (facelets[26] === 'F' && facelets[15] === 'R' && facelets[29] === 'D' &&
      facelets[23] === 'F' && facelets[12] === 'R') count++
  // FL slot
  if (facelets[24] === 'F' && facelets[44] === 'L' && facelets[27] === 'D' &&
      facelets[21] === 'F' && facelets[41] === 'L') count++
  // BR slot
  if (facelets[51] === 'B' && facelets[17] === 'R' && facelets[35] === 'D' &&
      facelets[48] === 'B' && facelets[14] === 'R') count++
  // BL slot
  if (facelets[53] === 'B' && facelets[42] === 'L' && facelets[33] === 'D' &&
      facelets[50] === 'B' && facelets[39] === 'L') count++
  return count
}

export function isEOLLDone(facelets: string): boolean {
  // All 4 U-face edge stickers are 'U'
  return (
    facelets[1] === 'U' &&
    facelets[3] === 'U' &&
    facelets[5] === 'U' &&
    facelets[7] === 'U'
  )
}

export function isOLLDone(facelets: string): boolean {
  // All 9 U-face stickers are 'U'
  for (let i = 0; i < 9; i++) {
    if (facelets[i] !== 'U') return false
  }
  return true
}

export function isCPLLDone(facelets: string): boolean {
  // U-layer corners: side stickers match adjacent face centers
  // Face centers: F=facelets[22], R=facelets[13], B=facelets[49], L=facelets[40]
  // (centers are always their face letter in this codebase)
  return (
    facelets[20] === 'F' && facelets[9]  === 'R' &&  // UFR
    facelets[18] === 'F' && facelets[38] === 'L' &&  // UFL
    facelets[11] === 'R' && facelets[45] === 'B' &&  // UBR
    facelets[36] === 'L' && facelets[47] === 'B'     // UBL
  )
}

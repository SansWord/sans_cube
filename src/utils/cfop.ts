export function isCrossDone(facelets: string): boolean {
  return (
    facelets[28] === 'Y' && facelets[25] === 'G' &&
    facelets[32] === 'Y' && facelets[16] === 'R' &&
    facelets[34] === 'Y' && facelets[52] === 'B' &&
    facelets[30] === 'Y' && facelets[43] === 'O'
  )
}

export function countCompletedF2LSlots(facelets: string): number {
  let count = 0
  // FR slot
  if (facelets[26] === 'G' && facelets[15] === 'R' && facelets[29] === 'Y' &&
      facelets[23] === 'G' && facelets[12] === 'R') count++
  // FL slot
  if (facelets[24] === 'G' && facelets[44] === 'O' && facelets[27] === 'Y' &&
      facelets[21] === 'G' && facelets[41] === 'O') count++
  // BR slot
  if (facelets[51] === 'B' && facelets[17] === 'R' && facelets[35] === 'Y' &&
      facelets[48] === 'B' && facelets[14] === 'R') count++
  // BL slot
  if (facelets[53] === 'B' && facelets[42] === 'O' && facelets[33] === 'Y' &&
      facelets[50] === 'B' && facelets[39] === 'O') count++
  return count
}

export function isEOLLDone(facelets: string): boolean {
  // All 4 U-face edge stickers are white
  return (
    facelets[1] === 'W' &&
    facelets[3] === 'W' &&
    facelets[5] === 'W' &&
    facelets[7] === 'W'
  )
}

export function isOLLDone(facelets: string): boolean {
  // All 9 U-face stickers are white
  for (let i = 0; i < 9; i++) {
    if (facelets[i] !== 'W') return false
  }
  return true
}

export function isCPLLDone(facelets: string): boolean {
  // U-layer corners: side stickers match adjacent face centers
  // Face centers: F=facelets[22], R=facelets[13], B=facelets[49], L=facelets[40]
  return (
    facelets[20] === 'G' && facelets[9]  === 'R' &&  // UFR
    facelets[18] === 'G' && facelets[38] === 'O' &&  // UFL
    facelets[11] === 'R' && facelets[45] === 'B' &&  // UBR
    facelets[36] === 'O' && facelets[47] === 'B'     // UBL
  )
}

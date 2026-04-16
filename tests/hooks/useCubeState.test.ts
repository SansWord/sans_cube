import { describe, it, expect } from 'vitest'
import { applyMoveToFacelets, isSolvedFacelets } from '../../src/utils/applyMove'
import { SOLVED_FACELETS } from '../../src/types/cube'

describe('useCubeState helpers', () => {
  it('isSolvedFacelets returns true for solved state', () => {
    expect(isSolvedFacelets(SOLVED_FACELETS)).toBe(true)
  })

  it('isSolvedFacelets returns false for scrambled state', () => {
    // Any string that differs from SOLVED_FACELETS
    const scrambled = 'RWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB'
    expect(isSolvedFacelets(scrambled)).toBe(false)
  })

  it('applyMoveToFacelets returns a 54-char string', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result).toHaveLength(54)
  })

  it('applyMoveToFacelets changes state from solved', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result).not.toBe(SOLVED_FACELETS)
  })
})

// Unique 54-char input: each index maps to a distinct char
// [0-9]='0'..'9', [10-35]='A'..'Z', [36-53]='a'..'r'
// Index lookup: [n] = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr'[n]
//   [9]='9' [10]='A' [11]='B' [12]='C' [14]='E' [15]='F' [17]='H'
//   [18]='I' [20]='K' [23]='N' [26]='Q' [27]='R' [29]='T' [33]='X'
//   [35]='Z' [36]='a' [37]='b' [38]='c' [39]='d' [41]='f' [42]='g'
//   [44]='i' [45]='j' [47]='l' [48]='m' [51]='p' [53]='r'
const LABELED = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr'

// cycle3CW(a,b,c,d): a←d, b←a, c←b, d←c

describe('applyMoveToFacelets sticker cycles', () => {
  // U CW: correct cycle (18,19,20, 36,37,38, 45,46,47, 9,10,11)
  // a=[18,19,20]←d=[9,10,11], b=[36,37,38]←a_old, c=[45,46,47]←b_old, d=[9,10,11]←c_old
  it('U CW moves F-top ← R-top', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[18]).toBe('9') // input[9]
    expect(result[19]).toBe('A') // input[10]
    expect(result[20]).toBe('B') // input[11]
  })

  it('U CW moves L-top ← F-top', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[36]).toBe('I') // input[18]
    expect(result[37]).toBe('J') // input[19]
    expect(result[38]).toBe('K') // input[20]
  })

  it('U CW moves B-top ← L-top', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[45]).toBe('a') // input[36]
    expect(result[46]).toBe('b') // input[37]
    expect(result[47]).toBe('c') // input[38]
  })

  // D CW: correct cycle (24,25,26, 15,16,17, 51,52,53, 42,43,44)
  // a=[24,25,26]←d=[42,43,44], b=[15,16,17]←a_old, c=[51,52,53]←b_old, d=[42,43,44]←c_old
  it('D CW moves F-bot ← L-bot', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'D', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[24]).toBe('g') // input[42]
    expect(result[25]).toBe('h') // input[43]
    expect(result[26]).toBe('i') // input[44]
  })

  it('D CW moves R-bot ← F-bot', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'D', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[15]).toBe('O') // input[24]
    expect(result[16]).toBe('P') // input[25]
    expect(result[17]).toBe('Q') // input[26]
  })

  it('D CW moves B-bot ← R-bot', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'D', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[51]).toBe('F') // input[15]
    expect(result[52]).toBe('G') // input[16]
    expect(result[53]).toBe('H') // input[17]
  })

  // R CW: correct cycle (2,5,8, 51,48,45, 35,32,29, 20,23,26)
  // a=[2,5,8]←d=[20,23,26], b=[51,48,45]←a_old, c=[35,32,29]←b_old, d=[20,23,26]←c_old
  it('R CW moves U-right col ← F-right col', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'R', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[2]).toBe('K') // input[20]
    expect(result[5]).toBe('N') // input[23]
    expect(result[8]).toBe('Q') // input[26]
  })

  it('R CW moves B-left col (reversed) ← U-right col', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'R', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[51]).toBe('2') // input[2]
    expect(result[48]).toBe('5') // input[5]
    expect(result[45]).toBe('8') // input[8]
  })

  // L CW: correct cycle (0,3,6, 18,21,24, 27,30,33, 53,50,47)
  // a=[0,3,6]←d=[53,50,47], b=[18,21,24]←a_old, c=[27,30,33]←b_old, d=[53,50,47]←c_old
  it('L CW moves U-left col ← B-right col (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'L', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[0] should be old[53]='r', not old[51]='p'
    expect(result[0]).toBe('r') // input[53]
    expect(result[3]).toBe('o') // input[50]
    expect(result[6]).toBe('l') // input[47]
  })

  it('L CW moves B-right col ← D-left col (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'L', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[53] should be old[27]='R', not old[33]='X'
    expect(result[53]).toBe('R') // input[27]
    expect(result[50]).toBe('U') // input[30]
    expect(result[47]).toBe('X') // input[33]
  })

  // F CW: correct cycle (6,7,8, 11,14,17, 29,28,27, 42,39,36)
  // a=[6,7,8]←d=[42,39,36], b=[11,14,17]←a_old, c=[29,28,27]←b_old, d=[42,39,36]←c_old
  it('F CW moves U-bot row ← L-right col (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'F', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // L col=2 (z=+1, front, adjacent to F) = stickers 8,5,2 = facelets[44,41,38], bottom-to-top
    expect(result[6]).toBe('i') // input[44]
    expect(result[7]).toBe('f') // input[41]
    expect(result[8]).toBe('c') // input[38]
  })

  it('F CW moves R-left col ← U-bot row (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'F', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[9] should be old[6]='6' (R col=0 at z=+1=front, Kociemba index 9,12,15)
    expect(result[9]).toBe('6')  // input[6]
    expect(result[12]).toBe('7') // input[7]
    expect(result[15]).toBe('8') // input[8]
  })

  it('F CW moves L-right col ← D-top row (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'F', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // L col=2 (z=+1, front) = facelets[44,41,38], receives D front row reversed [29,28,27]
    expect(result[44]).toBe('T') // input[29]
    expect(result[41]).toBe('S') // input[28]
    expect(result[38]).toBe('R') // input[27]
  })

  // B CW: correct cycle (0,1,2, 44,41,38, 35,34,33, 9,12,15)
  // a=[0,1,2]←d=[9,12,15], b=[44,41,38]←a_old, c=[35,34,33]←b_old, d=[9,12,15]←c_old
  it('B CW moves U-top row ← R-right col (correct, not reversed)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'B', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // R back col (z=-1) = Kociemba col=2 = indices 11,14,17 (top to bottom)
    expect(result[0]).toBe('B') // input[11]
    expect(result[1]).toBe('E') // input[14]
    expect(result[2]).toBe('H') // input[17]
  })

  it('B CW moves L-left col (reversed) ← U-top (correct column, not R-left)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'B', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // L col=0 (z=-1, back, adjacent to B) = stickers 6,3,0 = facelets[42,39,36], bottom-to-top
    expect(result[42]).toBe('0') // input[0]
    expect(result[39]).toBe('1') // input[1]
    expect(result[36]).toBe('2') // input[2]
  })

  it('B CW moves R-right col ← D-bot (correct column, not L-left)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'B', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[11] should be old[35]='Z', result[17] should be old[33]='X' (R col=2 at z=-1=back, Kociemba index 11,14,17)
    expect(result[11]).toBe('Z') // input[35]
    expect(result[14]).toBe('Y') // input[34]
    expect(result[17]).toBe('X') // input[33]
  })
})

// M/E/S use direct middle-layer cycles (not paired outer-face approximations).
// cycle3CW(a,b,c,d): a←d, b←a_old, c←b_old, d←c_old

describe('applyMoveToFacelets — M moves', () => {
  // M CW: U-mid←B-mid, F-mid←U-mid, D-mid←F-mid, B-mid(rev)←D-mid
  // cycle(f, 1,4,7, 19,22,25, 28,31,34, 52,49,46)
  it('M CW from solved: U/F/D/B middle cols cycle; L/R unchanged', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'M', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // U mid col (1,4,7) gets B blue; F mid col gets W white; D mid col gets G green; B mid col gets Y yellow
    expect(result).toBe('WBWWBWWBWRRRRRRRRRGWGGWGGWGYGYYGYYGYOOOOOOOOOBYBBYBBYB')
  })

  it('M CCW from solved: reverse cycle', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'M', direction: 'CCW', cubeTimestamp: 0, serial: 0 })
    // U mid col gets G green; F mid col gets Y yellow; D mid col gets B blue; B mid col gets W white
    expect(result).toBe('WGWWGWWGWRRRRRRRRRGYGGYGGYGYBYYBYYBYOOOOOOOOOBWBBWBBWB')
  })

  it('M CW then M CCW returns to solved', () => {
    const after = applyMoveToFacelets(
      applyMoveToFacelets(SOLVED_FACELETS, { face: 'M', direction: 'CW', cubeTimestamp: 0, serial: 0 }),
      { face: 'M', direction: 'CCW', cubeTimestamp: 0, serial: 0 }
    )
    expect(after).toBe(SOLVED_FACELETS)
  })
})

describe('applyMoveToFacelets — E moves', () => {
  // E CW: F-mid-row←L-mid-row, R-mid-row←F-mid-row, B-mid-row←R-mid-row, L-mid-row←B-mid-row
  // cycle(f, 21,22,23, 12,13,14, 48,49,50, 39,40,41)
  it('E CW from solved: F/R/B/L middle rows cycle; U/D unchanged', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'E', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // F mid row gets O orange; R mid row gets G green; B mid row gets R red; L mid row gets B blue
    expect(result).toBe('WWWWWWWWWRRRGGGRRRGGGOOOGGGYYYYYYYYYOOOBBBOOOBBBRRRBBB')
  })

  it('E CCW from solved: reverse cycle', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'E', direction: 'CCW', cubeTimestamp: 0, serial: 0 })
    // F mid row gets R red; R mid row gets B blue; B mid row gets O orange; L mid row gets G green
    expect(result).toBe('WWWWWWWWWRRRBBBRRRGGGRRRGGGYYYYYYYYYOOOGGGOOOBBBOOOBBB')
  })

  it('E CW then E CCW returns to solved', () => {
    const after = applyMoveToFacelets(
      applyMoveToFacelets(SOLVED_FACELETS, { face: 'E', direction: 'CW', cubeTimestamp: 0, serial: 0 }),
      { face: 'E', direction: 'CCW', cubeTimestamp: 0, serial: 0 }
    )
    expect(after).toBe(SOLVED_FACELETS)
  })
})

describe('applyMoveToFacelets — S moves', () => {
  // S CW: U-mid-row←L-mid-col(rev), R-mid-col←U-mid-row, D-mid-row(rev)←R-mid-col, L-mid-col(rev)←D-mid-row(rev)
  // cycle(f, 3,4,5, 10,13,16, 32,31,30, 43,40,37)
  it('S CW from solved: U/R/D/L middle layer cycles; F/B unchanged', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'S', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // U mid row gets O orange; R mid col gets W white; D mid row gets R red; L mid col gets Y yellow
    expect(result).toBe('WWWOOOWWWRWRRWRRWRGGGGGGGGGYYYRRRYYYOYOOYOOYOBBBBBBBBB')
  })

  it('S CCW from solved: reverse cycle', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'S', direction: 'CCW', cubeTimestamp: 0, serial: 0 })
    expect(result).toBe('WWWRRRWWWRYRRYRRYRGGGGGGGGGYYYOOOYYYOWOOWOOWOBBBBBBBBB')
  })

  it('S CW then S CCW returns to solved', () => {
    const after = applyMoveToFacelets(
      applyMoveToFacelets(SOLVED_FACELETS, { face: 'S', direction: 'CW', cubeTimestamp: 0, serial: 0 }),
      { face: 'S', direction: 'CCW', cubeTimestamp: 0, serial: 0 }
    )
    expect(after).toBe(SOLVED_FACELETS)
  })
})

import { describe, it, expect } from 'vitest'
import { applyMoveToFacelets, isSolvedFacelets } from '../../src/hooks/useCubeState'
import { SOLVED_FACELETS } from '../../src/types/cube'

describe('useCubeState helpers', () => {
  it('isSolvedFacelets returns true for solved state', () => {
    expect(isSolvedFacelets(SOLVED_FACELETS)).toBe(true)
  })

  it('isSolvedFacelets returns false for scrambled state', () => {
    // Any string that differs from SOLVED_FACELETS
    const scrambled = 'RUUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
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
  // U CW: correct cycle (18,19,20, 11,10,9, 45,46,47, 38,37,36)
  // a=[18,19,20]←d=[38,37,36], b=[11,10,9]←a_old, c=[45,46,47]←b_old, d=[38,37,36]←c_old
  it('U CW moves F-top ← L-top (reversed)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[18] should be old[38]='c', not old[36]='a'
    expect(result[18]).toBe('c') // input[38]
    expect(result[19]).toBe('b') // input[37]
    expect(result[20]).toBe('a') // input[36]
  })

  it('U CW moves R-top (reversed) ← F-top', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[9] should be old[20]='K', result[11] should be old[18]='I'
    expect(result[9]).toBe('K')  // input[20]
    expect(result[10]).toBe('J') // input[19]
    expect(result[11]).toBe('I') // input[18]
  })

  it('U CW moves L-top (reversed) ← B-top', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[36] should be old[47]='l', result[38] should be old[45]='j'
    expect(result[36]).toBe('l') // input[47]
    expect(result[37]).toBe('k') // input[46]
    expect(result[38]).toBe('j') // input[45]
  })

  // D CW: correct cycle (24,25,26, 44,43,42, 51,52,53, 17,16,15)
  // a=[24,25,26]←d=[17,16,15], b=[44,43,42]←a_old, c=[51,52,53]←b_old, d=[17,16,15]←c_old
  it('D CW moves F-bot ← R-bot (reversed)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'D', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[24] should be old[17]='H', not old[15]='F'
    expect(result[24]).toBe('H') // input[17]
    expect(result[25]).toBe('G') // input[16]
    expect(result[26]).toBe('F') // input[15]
  })

  it('D CW moves L-bot (reversed) ← F-bot', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'D', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[44] should be old[24]='O', result[42] should be old[26]='Q'
    expect(result[44]).toBe('O') // input[24]
    expect(result[43]).toBe('P') // input[25]
    expect(result[42]).toBe('Q') // input[26]
  })

  it('D CW moves R-bot (reversed) ← B-bot', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'D', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[17] should be old[51]='p', result[15] should be old[53]='r'
    expect(result[17]).toBe('p') // input[51]
    expect(result[16]).toBe('q') // input[52]
    expect(result[15]).toBe('r') // input[53]
  })

  // R CW: correct cycle (2,5,8, 20,23,26, 29,32,35, 51,48,45)
  // a=[2,5,8]←d=[51,48,45], b=[20,23,26]←a_old, c=[29,32,35]←b_old, d=[51,48,45]←c_old
  it('R CW moves U-right col ← B-left col (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'R', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[2] should be old[51]='p', not old[53]='r'
    expect(result[2]).toBe('p') // input[51]
    expect(result[5]).toBe('m') // input[48]
    expect(result[8]).toBe('j') // input[45]
  })

  it('R CW moves B-left col ← D-right col (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'R', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[51] should be old[29]='T', not old[35]='Z'
    expect(result[51]).toBe('T') // input[29]
    expect(result[48]).toBe('W') // input[32]
    expect(result[45]).toBe('Z') // input[35]
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
    // result[6] should be old[42]='g', not old[44]='i'
    expect(result[6]).toBe('g') // input[42]
    expect(result[7]).toBe('d') // input[39]
    expect(result[8]).toBe('a') // input[36]
  })

  it('F CW moves R-left col ← U-bot row (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'F', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[11] should be old[6]='6', not old[9]='9'
    expect(result[11]).toBe('6') // input[6]
    expect(result[14]).toBe('7') // input[7]
    expect(result[17]).toBe('8') // input[8]
  })

  it('F CW moves L-right col ← D-top row (correct column)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'F', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[42] should be old[29]='T', not old[27]='R' (reversed D top)
    expect(result[42]).toBe('T') // input[29]
    expect(result[39]).toBe('S') // input[28]
    expect(result[36]).toBe('R') // input[27]
  })

  // B CW: correct cycle (0,1,2, 44,41,38, 35,34,33, 9,12,15)
  // a=[0,1,2]←d=[9,12,15], b=[44,41,38]←a_old, c=[35,34,33]←b_old, d=[9,12,15]←c_old
  it('B CW moves U-top row ← R-right col (correct, not reversed)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'B', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[0] should be old[9]='9', result[2] should be old[15]='F'
    expect(result[0]).toBe('9') // input[9]
    expect(result[1]).toBe('C') // input[12]
    expect(result[2]).toBe('F') // input[15]
  })

  it('B CW moves L-left col (reversed) ← U-top (correct column, not R-left)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'B', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[44] should be old[0]='0', result[38] should be old[2]='2'
    expect(result[44]).toBe('0') // input[0]
    expect(result[41]).toBe('1') // input[1]
    expect(result[38]).toBe('2') // input[2]
  })

  it('B CW moves R-right col ← D-bot (correct column, not L-left)', () => {
    const result = applyMoveToFacelets(LABELED, { face: 'B', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    // result[9] should be old[35]='Z', result[15] should be old[33]='X'
    expect(result[9]).toBe('Z')  // input[35]
    expect(result[12]).toBe('Y') // input[34]
    expect(result[15]).toBe('X') // input[33]
  })
})

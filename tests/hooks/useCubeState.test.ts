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

// ── Slice move sticker tests ──────────────────────────────────────────────────
// These verify the M/E/S cases in applyMoveToFacelets.
// Input strings use sentinel characters at the affected stickers so we can
// assert exactly where they land after the move.

describe('applyMoveToFacelets — M moves', () => {
  // M CW: cycle(f, 1,4,7,  19,22,25,  28,31,34,  52,49,46)
  // cycle3CW(a,b,c,d): a←d, b←a, c←b, d←c
  // a=U mid-col[1,4,7], b=F mid-col[19,22,25], c=D mid-col[28,31,34], d=B mid-col-reversed[52,49,46]
  //
  // Mark B mid-col top→bot: B[46]='1', B[49]='2', B[52]='3'
  // B layout in string: B[45..53] = 'B1BB2BB3B'
  const M_INPUT = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLB1BB2BB3B' as const
  // d=[f[52],f[49],f[46]] = ['3','2','1']  → a (U mid-col) ← ['3','2','1']

  it('M CW: U mid-col gets B mid-col reversed (inverted)', () => {
    const result = applyMoveToFacelets(M_INPUT, { face: 'M', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[1]).toBe('3') // U[1] ← B[52]
    expect(result[4]).toBe('2') // U[4] ← B[49]
    expect(result[7]).toBe('1') // U[7] ← B[46]
  })

  it('M CW: F mid-col gets U mid-col', () => {
    // b=[19,22,25] ← a_old=[1,4,7] = ['U','U','U']
    const result = applyMoveToFacelets(M_INPUT, { face: 'M', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[19]).toBe('U')
    expect(result[22]).toBe('U')
    expect(result[25]).toBe('U')
  })

  // M CCW: cycle3CCW uses same indices; a←b, b←c, c←d, d←a
  // Mark U mid-col: U[1]='1', U[4]='2', U[7]='3'
  // U layout: 'U1UUU2UUU3U' — wait, U is 0-8, so:
  // U[0]='U',U[1]='1',U[2]='U',U[3]='U',U[4]='2',U[5]='U',U[6]='U',U[7]='3',U[8]='U'
  const M_CCW_INPUT = 'U1UU2UU3UURRRRRRRRRfffffffffdddddddddlllllllllbbbbbbbbb' as const
  // cycle3CCW(a,b,c,d): a←b, so F mid-col[19,22,25] ← U mid-col a_old=['1','2','3']? No:
  // cycle3CCW(a,b,c,d): a←b, b←c, c←d, d←a
  // a=U[1,4,7]=['1','2','3'], b=F[19,22,25], c=D[28,31,34], d=B-rev[52,49,46]
  // After CCW: a←b (U ← F), d←a_old (B-rev ← U)
  // So B[52]←a_old[0]='1', B[49]←a_old[1]='2', B[46]←a_old[2]='3'

  it('M CCW: B mid-col (bottom to top) gets U mid-col', () => {
    const result = applyMoveToFacelets(M_CCW_INPUT, { face: 'M', direction: 'CCW', cubeTimestamp: 0, serial: 0 })
    expect(result[52]).toBe('1') // B[52] ← U[1]
    expect(result[49]).toBe('2') // B[49] ← U[4]
    expect(result[46]).toBe('3') // B[46] ← U[7]
  })
})

describe('applyMoveToFacelets — E moves', () => {
  // E CW: cycle(f, 21,22,23,  12,13,14,  48,49,50,  39,40,41)
  // a=F mid-row[21,22,23], b=R mid-row[12,13,14], c=B mid-row[48,49,50], d=L mid-row[39,40,41]
  // cycle3CW: a←d, b←a, c←b, d←c
  //
  // Mark R mid-row: R[12]='1', R[13]='2', R[14]='3'
  // R layout (9-17): 'RRR123RRR'
  const E_INPUT = 'UUUUUUUUURRR123RRRfffffffffdddddddddlllllllllbbbbbbbbb' as const
  // b_old=[12,13,14]=['1','2','3'] → c=[48,49,50] ← b_old

  it('E CW: B mid-row gets R mid-row (not inverted)', () => {
    const result = applyMoveToFacelets(E_INPUT, { face: 'E', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[48]).toBe('1') // B[48] ← R[12]
    expect(result[49]).toBe('2') // B[49] ← R[13]
    expect(result[50]).toBe('3') // B[50] ← R[14]
  })

  it('E CW: F mid-row gets L mid-row', () => {
    // a=[21,22,23] ← d_old=[39,40,41] = 'lll' (from SOLVED context all L's)
    const result = applyMoveToFacelets(E_INPUT, { face: 'E', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[21]).toBe('l') // F[21] ← L[39]
    expect(result[22]).toBe('l') // F[22] ← L[40]
    expect(result[23]).toBe('l') // F[23] ← L[41]
  })
})

describe('applyMoveToFacelets — S moves', () => {
  // S CW: cycle(f, 3,4,5,  10,13,16,  32,31,30,  43,40,37)
  // a=U mid-row[3,4,5], b=R mid-col[10,13,16], c=D mid-row-rev[32,31,30], d=L mid-col-rev[43,40,37]
  // cycle3CW: a←d, b←a, c←b, d←c

  // Test 1: R mid-col → D mid-row (inverted)
  // Mark R[10]='1', R[13]='2', R[16]='3'
  // R layout (9-17): 'R1RR2RR3R'
  const S_INPUT_R = 'UUUUUUUUUR1RR2RR3Rfffffffffdddddddddlllllllllbbbbbbbbb' as const
  // b_old=[10,13,16]=['1','2','3'] → c=[32,31,30] ← b_old
  // So D[32]='1', D[31]='2', D[30]='3'
  // D mid-row left-to-right = D[30],D[31],D[32] = ['3','2','1']

  it('S CW: D mid-row gets R mid-col reversed (R-top→D-right)', () => {
    const result = applyMoveToFacelets(S_INPUT_R, { face: 'S', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[30]).toBe('3') // D[30] ← R[16] (R-bot → D-left)
    expect(result[31]).toBe('2') // D[31] ← R[13]
    expect(result[32]).toBe('1') // D[32] ← R[10] (R-top → D-right)
  })

  // Test 2: U mid-row → R mid-col (same order)
  // Mark U[3]='1', U[4]='2', U[5]='3'
  // U layout (0-8): 'UUU123UUU'
  const S_INPUT_U = 'UUU123UUURRRRRRRRRfffffffffdddddddddlllllllllbbbbbbbbb' as const
  // a_old=[3,4,5]=['1','2','3'] → b=[10,13,16] ← a_old

  it('S CW: R mid-col gets U mid-row (same order)', () => {
    const result = applyMoveToFacelets(S_INPUT_U, { face: 'S', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[10]).toBe('1') // R[10] ← U[3]
    expect(result[13]).toBe('2') // R[13] ← U[4]
    expect(result[16]).toBe('3') // R[16] ← U[5]
  })

  // Test 3: L mid-col → U mid-row (inverted)
  // Mark L[37]='1', L[40]='2', L[43]='3'
  // L layout (36-44): 'L1LL2LL3L'
  const S_INPUT_L = 'UUUUUUUUURRRRRRRRRfffffffffDDDDDDDDDL1LL2LL3Lbbbbbbbbb' as const
  // d=[43,40,37]=['3','2','1'] (reversed) → a=[3,4,5] ← d_old
  // So U[3]='3', U[4]='2', U[5]='1'

  it('S CW: U mid-row gets L mid-col reversed (L-bot→U-left)', () => {
    const result = applyMoveToFacelets(S_INPUT_L, { face: 'S', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result[3]).toBe('3') // U[3] ← L[43] (L-bot)
    expect(result[4]).toBe('2') // U[4] ← L[40]
    expect(result[5]).toBe('1') // U[5] ← L[37] (L-top)
  })
})

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move } from '../types/cube'
import { SOLVED_FACELETS } from '../types/cube'

// Face layout in 54-char Kociemba string:
// U: 0-8, R: 9-17, F: 18-26, D: 27-35, L: 36-44, B: 45-53
// Each face: stickers numbered 0-8 top-left to bottom-right, row by row:
//   0 1 2
//   3 4 5
//   6 7 8

// Rotate a face's 9 stickers clockwise (in-place on array f)
function rotateFaceCW(f: string[], start: number) {
  const [a, b, c, d, e, f2, g, h, i] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => f[start + j])
  f[start + 0] = g
  f[start + 1] = d
  f[start + 2] = a
  f[start + 3] = h
  f[start + 4] = e
  f[start + 5] = b
  f[start + 6] = i
  f[start + 7] = f2
  f[start + 8] = c
}

function rotateFaceCCW(f: string[], start: number) {
  const [a, b, c, d, e, f2, g, h, i] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => f[start + j])
  f[start + 0] = c
  f[start + 1] = f2
  f[start + 2] = i
  f[start + 3] = b
  f[start + 4] = e
  f[start + 5] = h
  f[start + 6] = a
  f[start + 7] = d
  f[start + 8] = g
}

// Cycle 4 groups of 3 stickers (CW: a←d, d←c, c←b, b←a)
// CW means: what was at d goes to a, c goes to d, b goes to c, a goes to b
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
// Kociemba face order: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
export function applyMoveToFacelets(facelets: string, move: Move): string {
  const f = facelets.split('')
  const ccw = move.direction === 'CCW'
  const cycle = ccw ? cycle3CCW : cycle3CW

  switch (move.face) {
    case 'U':
      // U CW: rotate U face CW; side cycle: F-top→R-top→B-top→L-top
      // Meaning: what was in F-top goes to R-top (CW rotation of U)
      // cycle3CW(a,b,c,d): a←d, b←a, c←b, d←c
      // We want: F-top←L-top, R-top←F-top, B-top←R-top, L-top←B-top
      // So: a=F-top(18,19,20), b=R-top(9,10,11), c=B-top(45,46,47), d=L-top(36,37,38)
      if (ccw) rotateFaceCCW(f, 0); else rotateFaceCW(f, 0)
      cycle(f, 18, 19, 20, 36, 37, 38, 45, 46, 47, 9, 10, 11)
      break

    case 'D':
      // D CW: rotate D face CW; side cycle: F-bot←R-bot, L-bot←F-bot, B-bot←L-bot, R-bot←B-bot
      // a=F-bot(24,25,26), b=L-bot(42,43,44), c=B-bot(51,52,53), d=R-bot(15,16,17)
      if (ccw) rotateFaceCCW(f, 27); else rotateFaceCW(f, 27)
      cycle(f, 24, 25, 26, 15, 16, 17, 51, 52, 53, 42, 43, 44)
      break

    case 'R':
      // R CW: rotate R face CW; side cycle:
      // U-right col (2,5,8) → B-left col reversed (53,50,47), D-right col (29,32,35)← ...
      // R CW: F-right←U-right, D-right←F-right, B-left(inv)←D-right, U-right←B-left(inv)
      // U-right: 2,5,8  F-right: 20,23,26  D-right: 29,32,35  B-left(inv): 53,50,47
      // a=U-right(2,5,8), b=F-right(20,23,26), c=D-right(29,32,35), d=B(53,50,47)
      if (ccw) rotateFaceCCW(f, 9); else rotateFaceCW(f, 9)
      cycle(f, 2, 5, 8, 51, 48, 45, 29, 32, 35, 20, 23, 26)
      break

    case 'L':
      // L CW: rotate L face CW; side cycle:
      // U-left(0,3,6) → F-left(18,21,24) → D-left(27,30,33) → B-right-inv(45,48,51)
      // L CW: F-left←U-left, D-left←F-left, B-right(inv)←D-left, U-left←B-right(inv)
      // a=U-left(0,3,6), b=F-left(18,21,24), c=D-left(27,30,33), d=B-right(inv: 51,48,45)
      if (ccw) rotateFaceCCW(f, 36); else rotateFaceCW(f, 36)
      cycle(f, 0, 3, 6, 18, 21, 24, 27, 30, 33, 53, 50, 47)
      break

    case 'F':
      // F CW: rotate F face CW; side cycle:
      // U-bot(6,7,8) → R-left(9,12,15) → D-top-inv(29,28,27) → L-right-inv(44,41,38)
      // F CW: R-left←U-bot, D-top-inv←R-left, L-right-inv←D-top-inv, U-bot←L-right-inv
      // a=U-bot(6,7,8), b=R-left(9,12,15), c=D-top(29,28,27), d=L-right(44,41,38)
      if (ccw) rotateFaceCCW(f, 18); else rotateFaceCW(f, 18)
      cycle(f, 6, 7, 8, 9, 12, 15, 29, 28, 27, 44, 41, 38)
      break

    case 'B':
      // B CW: rotate B face CW; side cycle:
      // U-top(2,1,0) → L-left(36,39,42) → D-bot(33,34,35) → R-right(17,14,11)
      // B CW: L-left←U-top-inv, D-bot-inv←L-left, R-right←D-bot-inv, U-top-inv←R-right
      // a=U-top(2,1,0), b=L-left(36,39,42), c=D-bot(33,34,35), d=R-right(17,14,11)
      if (ccw) rotateFaceCCW(f, 45); else rotateFaceCW(f, 45)
      cycle(f, 0, 1, 2, 42, 39, 36, 35, 34, 33, 11, 14, 17)
      break

    case 'M':
      // M CW (like L): middle column cycles U→F→D→B
      // No face rotation. B mid-col is inverted: indices 52,49,46 = B pos 7,4,1 (bottom→top).
      // cycle(f, 1,4,7,  19,22,25,  28,31,34,  52,49,46)
      // a=U mid-col, b=F mid-col, c=D mid-col, d=B mid-col(bot→top)
      cycle(f, 1, 4, 7, 19, 22, 25, 28, 31, 34, 52, 49, 46)
      break

    case 'E':
      // E CW (like D): middle row cycles F→R→B→L
      // No face rotation. No inversions. Content flows L→F→R→B.
      // cycle(f, 21,22,23,  12,13,14,  48,49,50,  39,40,41)
      // a=F mid-row, b=R mid-row, c=B mid-row, d=L mid-row
      cycle(f, 21, 22, 23, 12, 13, 14, 48, 49, 50, 39, 40, 41)
      break

    case 'S':
      // S CW (like F): middle slice cycles U→R→D→L
      // No face rotation. D mid-row and L mid-col are inverted.
      // cycle(f, 3,4,5,  10,13,16,  32,31,30,  43,40,37)
      // a=U mid-row, b=R mid-col, c=D mid-row(rev), d=L mid-col(rev)
      cycle(f, 3, 4, 5, 10, 13, 16, 32, 31, 30, 43, 40, 37)
      break
  }

  return f.join('')
}

export function isSolvedFacelets(facelets: string): boolean {
  return facelets === SOLVED_FACELETS
}

export function useCubeState(driver: MutableRefObject<CubeDriver | null>, driverVersion = 0) {
  const [facelets, setFacelets] = useState<string>(SOLVED_FACELETS)
  const [isSolved, setIsSolved] = useState(true)
  const faceletsRef = useRef(SOLVED_FACELETS)
  const isSolvedRef = useRef(true)

  const resetState = useCallback(() => {
    faceletsRef.current = SOLVED_FACELETS
    isSolvedRef.current = true
    setFacelets(SOLVED_FACELETS)
    setIsSolved(true)
  }, [])

  useEffect(() => {
    const d = driver.current
    if (!d) return

    const onMove = (move: Move) => {
      const next = applyMoveToFacelets(faceletsRef.current, move)
      const solved = isSolvedFacelets(next)
      faceletsRef.current = next
      isSolvedRef.current = solved
      setFacelets(next)
      setIsSolved(solved)
    }

    d.on('move', onMove)
    return () => {
      d.off('move', onMove)
    }
  }, [driver, driverVersion])

  return { facelets, isSolved, isSolvedRef, resetState }
}

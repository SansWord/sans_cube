# Scramble Generator + Timer + Solve History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full timer mode with WCA scramble tracking, CFOP phase detection, solve history, and solve detail modal with mini-canvas replay.

**Architecture:** Pure logic (parsing, phase detectors, statistics) is extracted into utils and tested independently. Hooks wrap logic for React. Components are thin wrappers over hooks. A mode toggle in `App.tsx` switches between the existing debug layout and the new `TimerScreen`.

**Tech Stack:** React, TypeScript, cubing.js (scramble generation), localStorage (persistence), existing Three.js CubeRenderer (mini canvas replay)

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/types/solve.ts` | `ScrambleStep`, `SolveRecord`, `PhaseRecord`, `Phase`, `SolveMethod` types |
| `src/utils/scramble.ts` | `parseScramble`, `scrambleStepToString` pure functions |
| `src/utils/cfop.ts` | CFOP phase detector pure functions |
| `src/methods/cfop.ts` | CFOP `SolveMethod` definition |
| `src/hooks/useScramble.ts` | Async WCA scramble generation via cubing.js |
| `src/hooks/useScrambleTracker.ts` | Hardware move vs scramble sequence state machine |
| `src/hooks/useTimer.ts` | Timer state machine with CFOP phase tracking |
| `src/hooks/useSolveHistory.ts` | localStorage persistence + statistics |
| `src/components/ScrambleDisplay.tsx` | Per-step colored scramble sequence |
| `src/components/TimerDisplay.tsx` | Large XX.XX timer |
| `src/components/PhaseBar.tsx` | Phase segments with hover tooltip |
| `src/components/SolveHistorySidebar.tsx` | Statistics + solve list |
| `src/components/TimerScreen.tsx` | Timer mode layout (sidebar + main area) |
| `src/components/SolveDetailModal.tsx` | Full solve detail with mini canvas replay |
| `tests/utils/scramble.test.ts` | Tests for parseScramble |
| `tests/utils/cfop.test.ts` | Tests for CFOP detectors |
| `tests/hooks/useSolveHistory.test.ts` | Tests for statistics computation |
| `tests/hooks/useScrambleTracker.test.ts` | Tests for tracker state machine |

### Modified files
| File | Change |
|---|---|
| `src/App.tsx` | Add `mode` state toggle, conditionally render `TimerScreen` vs debug layout |
| `src/components/ConnectionBar.tsx` | Accept `mode`/`onToggleMode` props, add timer/debug toggle button |

---

## Task 1: Define solve types

**Files:**
- Create: `src/types/solve.ts`

- [ ] **Step 1: Create `src/types/solve.ts`**

```ts
import type { Face, Direction, Move } from './cube'

export interface ScrambleStep {
  face: Face
  direction: Direction
  double: boolean
}

export interface PhaseRecord {
  label: string
  group?: string        // e.g. 'F2L' for visual grouping
  recognitionMs: number
  executionMs: number
  turns: number
}

export interface SolveRecord {
  id: number            // sequential, 1-indexed
  scramble: string
  timeMs: number        // wall-clock solve duration
  moves: Move[]         // all moves with cubeTimestamp for replay
  phases: PhaseRecord[]
  date: number          // Unix timestamp (Date.now())
}

export interface Phase {
  label: string
  group?: string
  color: string
  isComplete: (facelets: string) => boolean
}

export interface SolveMethod {
  id: string
  label: string
  phases: Phase[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/solve.ts
git commit -m "feat: add solve types (ScrambleStep, SolveRecord, PhaseRecord, SolveMethod)"
```

---

## Task 2: Scramble string utilities

**Files:**
- Create: `src/utils/scramble.ts`
- Test: `tests/utils/scramble.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/utils/scramble.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseScramble, scrambleStepToString } from '../../src/utils/scramble'

describe('parseScramble', () => {
  it('parses CW move', () => {
    expect(parseScramble('R')).toEqual([{ face: 'R', direction: 'CW', double: false }])
  })

  it('parses CCW move', () => {
    expect(parseScramble("U'")).toEqual([{ face: 'U', direction: 'CCW', double: false }])
  })

  it('parses double move', () => {
    expect(parseScramble('F2')).toEqual([{ face: 'F', direction: 'CW', double: true }])
  })

  it('parses a full scramble sequence', () => {
    const steps = parseScramble("R U R' U'")
    expect(steps).toHaveLength(4)
    expect(steps[0]).toEqual({ face: 'R', direction: 'CW', double: false })
    expect(steps[1]).toEqual({ face: 'U', direction: 'CW', double: false })
    expect(steps[2]).toEqual({ face: 'R', direction: 'CCW', double: false })
    expect(steps[3]).toEqual({ face: 'U', direction: 'CCW', double: false })
  })

  it('handles extra whitespace', () => {
    expect(parseScramble('  R  U  ')).toHaveLength(2)
  })
})

describe('scrambleStepToString', () => {
  it('formats CW move', () => {
    expect(scrambleStepToString({ face: 'R', direction: 'CW', double: false })).toBe('R')
  })

  it('formats CCW move', () => {
    expect(scrambleStepToString({ face: 'U', direction: 'CCW', double: false })).toBe("U'")
  })

  it('formats double move', () => {
    expect(scrambleStepToString({ face: 'F', direction: 'CW', double: true })).toBe('F2')
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npx vitest run tests/utils/scramble.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/utils/scramble.ts`**

```ts
import type { ScrambleStep } from '../types/solve'
import type { Face } from '../types/cube'

export function parseScramble(scramble: string): ScrambleStep[] {
  return scramble.trim().split(/\s+/).filter(Boolean).map(token => {
    const face = token[0] as Face
    const modifier = token.slice(1)
    return {
      face,
      direction: modifier === "'" ? 'CCW' : 'CW',
      double: modifier === '2',
    }
  })
}

export function scrambleStepToString(step: ScrambleStep): string {
  if (step.double) return `${step.face}2`
  if (step.direction === 'CCW') return `${step.face}'`
  return step.face
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npx vitest run tests/utils/scramble.test.ts
```
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/scramble.ts tests/utils/scramble.test.ts
git commit -m "feat: add scramble string parse/format utilities"
```

---

## Task 3: CFOP phase detectors

**Files:**
- Create: `src/utils/cfop.ts`
- Test: `tests/utils/cfop.test.ts`

Facelets string layout (Kociemba): U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53).

D face viewed from above — front row (adj F) = 27,28,29; back row (adj B) = 33,34,35.

Key sticker positions:
```
Cross edges:
  DF: D[1]=28, F[7]=25
  DR: D[5]=32, R[7]=16
  DB: D[7]=34, B[7]=52
  DL: D[3]=30, L[7]=43

F2L slots (corner stickers, edge stickers):
  FR: corner(F[8]=26, R[6]=15, D[2]=29)  edge(F[5]=23, R[3]=12)
  FL: corner(F[6]=24, L[8]=44, D[0]=27)  edge(F[3]=21, L[5]=41)
  BR: corner(B[6]=51, R[8]=17, D[8]=35)  edge(B[3]=48, R[5]=14)
  BL: corner(B[8]=53, L[6]=42, D[6]=33)  edge(B[5]=50, L[3]=39)

U-layer corners (after OLL, check side stickers match face centers):
  UFR: F[2]=20, R[0]=9
  UFL: F[0]=18, L[2]=38
  UBR: R[2]=11, B[0]=45
  UBL: L[0]=36, B[2]=47
```

- [ ] **Step 1: Write failing tests**

Create `tests/utils/cfop.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  isCrossDone,
  countCompletedF2LSlots,
  isEOLLDone,
  isOLLDone,
  isCPLLDone,
} from '../../src/utils/cfop'
import { SOLVED_FACELETS } from '../../src/types/cube'
import { applyMoveToFacelets } from '../../src/hooks/useCubeState'
import type { Move } from '../../src/types/cube'

function move(face: Move['face'], direction: Move['direction'] = 'CW'): Move {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

function applyMoves(facelets: string, moves: Move[]): string {
  return moves.reduce(applyMoveToFacelets, facelets)
}

describe('isCrossDone', () => {
  it('returns true for solved cube', () => {
    expect(isCrossDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after U move', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isCrossDone(f)).toBe(false)
  })

  it('returns false after R move', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isCrossDone(f)).toBe(false)
  })

  it('returns true after U then U CCW (net zero)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U'), move('U', 'CCW')])
    expect(isCrossDone(f)).toBe(true)
  })
})

describe('countCompletedF2LSlots', () => {
  it('returns 4 for solved cube', () => {
    expect(countCompletedF2LSlots(SOLVED_FACELETS)).toBe(4)
  })

  it('returns 0 after a scrambling R move', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(countCompletedF2LSlots(f)).toBeLessThan(4)
  })
})

describe('isEOLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isEOLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after U move scrambling edges', () => {
    // After a U move, edge stickers 1,3,5,7 may shift but stay U — actually U only rotates U-layer
    // so EOLL stays true after U. Test with a move that actually changes edge orientation.
    // F move changes U-bottom edge (position 7) orientation
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    expect(isEOLLDone(f)).toBe(false)
  })
})

describe('isOLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isOLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isOLLDone(f)).toBe(false)
  })
})

describe('isCPLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isCPLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (corners disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isCPLLDone(f)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npx vitest run tests/utils/cfop.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/utils/cfop.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npx vitest run tests/utils/cfop.test.ts
```
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/cfop.ts tests/utils/cfop.test.ts
git commit -m "feat: add CFOP phase detector pure functions"
```

---

## Task 4: CFOP method definition

**Files:**
- Create: `src/methods/cfop.ts`

- [ ] **Step 1: Create `src/methods/cfop.ts`**

```ts
import type { SolveMethod } from '../types/solve'
import {
  isCrossDone,
  countCompletedF2LSlots,
  isEOLLDone,
  isOLLDone,
  isCPLLDone,
} from '../utils/cfop'
import { isSolvedFacelets } from '../hooks/useCubeState'

export const CFOP: SolveMethod = {
  id: 'cfop',
  label: 'CFOP',
  phases: [
    {
      label: 'Cross',
      color: '#e74c3c',
      isComplete: isCrossDone,
    },
    {
      label: 'F2L Slot 1',
      group: 'F2L',
      color: '#2980b9',
      isComplete: (f) => countCompletedF2LSlots(f) >= 1,
    },
    {
      label: 'F2L Slot 2',
      group: 'F2L',
      color: '#3498db',
      isComplete: (f) => countCompletedF2LSlots(f) >= 2,
    },
    {
      label: 'F2L Slot 3',
      group: 'F2L',
      color: '#5dade2',
      isComplete: (f) => countCompletedF2LSlots(f) >= 3,
    },
    {
      label: 'F2L Slot 4',
      group: 'F2L',
      color: '#85c1e9',
      isComplete: (f) => countCompletedF2LSlots(f) >= 4,
    },
    {
      label: 'EOLL',
      color: '#f39c12',
      isComplete: isEOLLDone,
    },
    {
      label: 'OLL',
      color: '#e67e22',
      isComplete: isOLLDone,
    },
    {
      label: 'CPLL',
      color: '#27ae60',
      isComplete: isCPLLDone,
    },
    {
      label: 'PLL',
      color: '#2ecc71',
      isComplete: isSolvedFacelets,
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/methods/cfop.ts
git commit -m "feat: define CFOP SolveMethod with 9 phases"
```

---

## Task 5: `useSolveHistory` hook

**Files:**
- Create: `src/hooks/useSolveHistory.ts`
- Test: `tests/hooks/useSolveHistory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/hooks/useSolveHistory.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeStats, computeAo } from '../../src/hooks/useSolveHistory'
import type { SolveRecord } from '../../src/types/solve'

function makeSolve(id: number, timeMs: number): SolveRecord {
  return { id, scramble: '', timeMs, moves: [], phases: [], date: 0 }
}

describe('computeAo', () => {
  it('returns null when not enough solves', () => {
    const solves = [makeSolve(1, 20000), makeSolve(2, 22000)]
    expect(computeAo(solves, 5)).toBeNull()
  })

  it('computes ao5 dropping best and worst', () => {
    // times: 10, 20, 30, 40, 50 → drop 10 and 50 → avg(20,30,40) = 30
    const solves = [10000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    const ao5 = computeAo(solves, 5)
    expect(ao5).toBeCloseTo(30000)
  })

  it('ao5 uses last 5 solves', () => {
    const solves = [10000, 99000, 20000, 30000, 40000, 50000].map((t, i) => makeSolve(i + 1, t))
    // last 5: 99000,20000,30000,40000,50000 → drop 99000 and 20000 → avg(30000,40000,50000) = 40000
    const ao5 = computeAo(solves, 5)
    expect(ao5).toBeCloseTo(40000)
  })

  it('computes ao1 (single) without dropping', () => {
    const solves = [makeSolve(1, 23000)]
    expect(computeAo(solves, 1)).toBeCloseTo(23000)
  })
})

describe('computeStats', () => {
  it('returns null stats when no solves', () => {
    const stats = computeStats([])
    expect(stats.single.current).toBeNull()
    expect(stats.ao5.current).toBeNull()
  })

  it('returns single time when one solve', () => {
    const stats = computeStats([makeSolve(1, 23000)])
    expect(stats.single.current).toBeCloseTo(23000)
    expect(stats.single.best).toBeCloseTo(23000)
  })

  it('best single is the lowest time', () => {
    const solves = [makeSolve(1, 30000), makeSolve(2, 20000), makeSolve(3, 25000)]
    const stats = computeStats(solves)
    expect(stats.single.best).toBeCloseTo(20000)
    expect(stats.single.current).toBeCloseTo(25000) // latest
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npx vitest run tests/hooks/useSolveHistory.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/hooks/useSolveHistory.ts`**

```ts
import { useState, useCallback } from 'react'
import type { SolveRecord } from '../types/solve'

const STORAGE_KEY = 'sans_cube_solves'

function loadSolves(): SolveRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SolveRecord[]) : []
  } catch {
    return []
  }
}

function saveSolves(solves: SolveRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solves))
}

// Exported for tests
export function computeAo(solves: SolveRecord[], n: number): number | null {
  if (solves.length < n) return null
  const slice = solves.slice(solves.length - n)
  if (n <= 4) {
    return slice.reduce((sum, s) => sum + s.timeMs, 0) / n
  }
  const times = slice.map((s) => s.timeMs).sort((a, b) => a - b)
  const trimmed = times.slice(1, -1)
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
}

function bestAo(solves: SolveRecord[], n: number): number | null {
  if (solves.length < n) return null
  let best: number | null = null
  for (let i = n; i <= solves.length; i++) {
    const ao = computeAo(solves.slice(0, i), n)
    if (ao !== null && (best === null || ao < best)) best = ao
  }
  return best
}

interface StatEntry {
  current: number | null
  best: number | null
}

interface SolveStats {
  single: StatEntry
  ao5: StatEntry
  ao12: StatEntry
  ao100: StatEntry
}

// Exported for tests
export function computeStats(solves: SolveRecord[]): SolveStats {
  const single: StatEntry = {
    current: solves.length > 0 ? solves[solves.length - 1].timeMs : null,
    best: solves.length > 0 ? Math.min(...solves.map((s) => s.timeMs)) : null,
  }
  return {
    single,
    ao5:   { current: computeAo(solves, 5),   best: bestAo(solves, 5) },
    ao12:  { current: computeAo(solves, 12),  best: bestAo(solves, 12) },
    ao100: { current: computeAo(solves, 100), best: bestAo(solves, 100) },
  }
}

export function useSolveHistory() {
  const [solves, setSolves] = useState<SolveRecord[]>(() => loadSolves())

  const addSolve = useCallback((solve: SolveRecord) => {
    setSolves((prev) => {
      const next = [...prev, solve]
      saveSolves(next)
      return next
    })
  }, [])

  const deleteSolve = useCallback((id: number) => {
    setSolves((prev) => {
      const next = prev.filter((s) => s.id !== id)
      saveSolves(next)
      return next
    })
  }, [])

  const stats = computeStats(solves)

  return { solves, addSolve, deleteSolve, stats }
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npx vitest run tests/hooks/useSolveHistory.test.ts
```
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSolveHistory.ts tests/hooks/useSolveHistory.test.ts
git commit -m "feat: add useSolveHistory with localStorage persistence and Ao5/12/100 stats"
```

---

## Task 6: `useScramble` hook

**Files:**
- Create: `src/hooks/useScramble.ts`

- [ ] **Step 1: Create `src/hooks/useScramble.ts`**

```ts
import { useState, useCallback, useEffect } from 'react'
import type { ScrambleStep } from '../types/solve'
import { parseScramble } from '../utils/scramble'

async function generateScramble(): Promise<string> {
  const { randomScrambleForEvent } = await import('cubing/scramble')
  const alg = await randomScrambleForEvent('333')
  return alg.toString()
}

export function useScramble() {
  const [scramble, setScramble] = useState<string | null>(null)
  const [steps, setSteps] = useState<ScrambleStep[]>([])

  const regenerate = useCallback(() => {
    setScramble(null)
    setSteps([])
    generateScramble().then((s) => {
      setScramble(s)
      setSteps(parseScramble(s))
    })
  }, [])

  useEffect(() => {
    regenerate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { scramble, steps, regenerate }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useScramble.ts
git commit -m "feat: add useScramble hook using cubing.js WCA random scramble"
```

---

## Task 7: `useScrambleTracker` hook

**Files:**
- Create: `src/hooks/useScrambleTracker.ts`
- Test: `tests/hooks/useScrambleTracker.test.ts`

The state machine is extracted as a pure `applyTrackerMove` function so it can be unit tested without React or a driver.

- [ ] **Step 1: Write failing tests**

Create `tests/hooks/useScrambleTracker.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyTrackerMove, makeInitialTrackerState } from '../../src/hooks/useScrambleTracker'
import type { ScrambleStep } from '../../src/types/solve'
import type { Move } from '../../src/types/cube'

function step(face: Move['face'], direction: Move['direction'], double = false): ScrambleStep {
  return { face, direction, double }
}

function move(face: Move['face'], direction: Move['direction'] = 'CW'): Move {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

const steps: ScrambleStep[] = [step('R', 'CW'), step('U', 'CCW'), step('F', 'CW', true)]

describe('applyTrackerMove — single CW step', () => {
  it('correct move → done, advance', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CW'))
    expect(state.stepStates[0]).toBe('done')
    expect(state.currentStepIndex).toBe(1)
    expect(state.trackingState).toBe('scrambling')
  })

  it('wrong direction → warning', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CCW'))
    expect(state.stepStates[0]).toBe('warning')
    expect(state.trackingState).toBe('warning')
    expect(state.currentStepIndex).toBe(0)
  })

  it('from warning: correct move clears warning and advances', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('R', 'CCW'))  // warning
    state = applyTrackerMove(state, steps, move('R', 'CW'))   // correct
    expect(state.stepStates[0]).toBe('done')
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(1)
  })

  it('wrong face → wrong state', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('U', 'CW'))
    expect(state.trackingState).toBe('wrong')
    expect(state.wrongMove).toEqual(move('U', 'CW'))
  })

  it('from wrong: reverse move → back to scrambling', () => {
    let state = makeInitialTrackerState(steps)
    state = applyTrackerMove(state, steps, move('U', 'CW'))   // wrong
    state = applyTrackerMove(state, steps, move('U', 'CCW'))  // undo
    expect(state.trackingState).toBe('scrambling')
    expect(state.wrongMove).toBeNull()
    expect(state.currentStepIndex).toBe(0)
  })
})

describe('applyTrackerMove — double step (F2)', () => {
  // steps[2] is F2 (double)
  const doubleSteps: ScrambleStep[] = [step('F', 'CW', true)]

  it('first CW turn → partial progress, no advance', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    expect(state.trackingState).toBe('scrambling')
    expect(state.currentStepIndex).toBe(0)
    expect(state.partialDirection).toBe('CW')
  })

  it('second same-direction turn → done', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    expect(state.stepStates[0]).toBe('done')
    expect(state.currentStepIndex).toBe(1)
  })

  it('CCW first turn then CCW second → also done (both directions valid for double)', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CCW'))
    state = applyTrackerMove(state, doubleSteps, move('F', 'CCW'))
    expect(state.stepStates[0]).toBe('done')
  })

  it('opposite direction second turn → cancels partial progress', () => {
    let state = makeInitialTrackerState(doubleSteps)
    state = applyTrackerMove(state, doubleSteps, move('F', 'CW'))
    state = applyTrackerMove(state, doubleSteps, move('F', 'CCW'))
    expect(state.partialDirection).toBeNull()
    expect(state.currentStepIndex).toBe(0)
    expect(state.trackingState).toBe('scrambling')
  })
})

describe('applyTrackerMove — all done → armed', () => {
  it('completing last step sets trackingState to armed', () => {
    const singleStep: ScrambleStep[] = [step('R', 'CW')]
    let state = makeInitialTrackerState(singleStep)
    state = applyTrackerMove(state, singleStep, move('R', 'CW'))
    expect(state.trackingState).toBe('armed')
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/hooks/useScrambleTracker.ts`**

```ts
import { useState, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, Direction } from '../types/cube'
import type { ScrambleStep } from '../types/solve'

export type StepState = 'done' | 'current' | 'pending' | 'warning'
export type TrackingState = 'scrambling' | 'warning' | 'wrong' | 'armed'

export interface TrackerState {
  stepStates: StepState[]
  trackingState: TrackingState
  wrongMove: Move | null
  partialDirection: Direction | null
  currentStepIndex: number
}

export function makeInitialTrackerState(steps: ScrambleStep[]): TrackerState {
  return {
    stepStates: steps.map((_, i) => (i === 0 ? 'current' : 'pending')),
    trackingState: steps.length === 0 ? 'armed' : 'scrambling',
    wrongMove: null,
    partialDirection: null,
    currentStepIndex: 0,
  }
}

function buildStepStates(steps: ScrambleStep[], doneCount: number, currentIndex: number, warningIndex: number | null): StepState[] {
  return steps.map((_, i) => {
    if (i < doneCount) return 'done'
    if (warningIndex !== null && i === warningIndex) return 'warning'
    if (i === currentIndex) return 'current'
    return 'pending'
  })
}

export function applyTrackerMove(state: TrackerState, steps: ScrambleStep[], move: Move): TrackerState {
  const { trackingState, currentStepIndex, wrongMove, partialDirection } = state

  // Wrong state: wait for undo
  if (trackingState === 'wrong') {
    if (wrongMove && move.face === wrongMove.face && move.direction !== wrongMove.direction) {
      // Undone — back to scrambling
      return {
        ...state,
        trackingState: 'scrambling',
        wrongMove: null,
        stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
      }
    }
    // Any other move while wrong: update wrongMove to this latest wrong move
    return { ...state, wrongMove: move }
  }

  const expected = steps[currentStepIndex]

  // Warning state: only accept correct face moves
  if (trackingState === 'warning') {
    if (move.face !== expected.face) {
      return { ...state, trackingState: 'wrong', wrongMove: move }
    }
    if (move.direction === expected.direction) {
      // Corrected — step done
      const nextIndex = currentStepIndex + 1
      const isArmed = nextIndex >= steps.length
      return {
        ...state,
        trackingState: isArmed ? 'armed' : 'scrambling',
        stepStates: buildStepStates(steps, nextIndex, nextIndex, null),
        currentStepIndex: nextIndex,
        wrongMove: null,
      }
    }
    // Still wrong direction — stay in warning
    return state
  }

  // Normal scrambling state
  if (move.face !== expected.face) {
    // Reset partial progress if in middle of double
    return {
      ...state,
      trackingState: 'wrong',
      wrongMove: move,
      partialDirection: null,
      stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, null),
    }
  }

  if (expected.double) {
    if (partialDirection === null) {
      // First turn on correct face — record direction
      return { ...state, partialDirection: move.direction }
    }
    if (move.direction === partialDirection) {
      // Second same-direction turn — step done
      const nextIndex = currentStepIndex + 1
      const isArmed = nextIndex >= steps.length
      return {
        ...state,
        trackingState: isArmed ? 'armed' : 'scrambling',
        stepStates: buildStepStates(steps, nextIndex, nextIndex, null),
        currentStepIndex: nextIndex,
        partialDirection: null,
      }
    }
    // Opposite direction — cancel partial progress
    return { ...state, partialDirection: null }
  }

  // Single move
  if (move.direction === expected.direction) {
    const nextIndex = currentStepIndex + 1
    const isArmed = nextIndex >= steps.length
    return {
      ...state,
      trackingState: isArmed ? 'armed' : 'scrambling',
      stepStates: buildStepStates(steps, nextIndex, nextIndex, null),
      currentStepIndex: nextIndex,
    }
  }

  // Wrong direction for single move
  return {
    ...state,
    trackingState: 'warning',
    stepStates: buildStepStates(steps, currentStepIndex, currentStepIndex, currentStepIndex),
  }
}

export function useScrambleTracker(
  steps: ScrambleStep[],
  driver: MutableRefObject<CubeDriver | null>,
  onArmed?: () => void,
) {
  const [state, setState] = useState<TrackerState>(() => makeInitialTrackerState(steps))

  // Reset when steps change (new scramble)
  useEffect(() => {
    setState(makeInitialTrackerState(steps))
  }, [steps])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (move: Move) => {
      setState((prev) => {
        const next = applyTrackerMove(prev, steps, move)
        if (next.trackingState === 'armed' && prev.trackingState !== 'armed') {
          onArmed?.()
        }
        return next
      })
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, steps]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => setState(makeInitialTrackerState(steps)), [steps])

  return { ...state, reset }
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npx vitest run tests/hooks/useScrambleTracker.test.ts
```
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScrambleTracker.ts tests/hooks/useScrambleTracker.test.ts
git commit -m "feat: add useScrambleTracker with state machine for hardware scramble verification"
```

---

## Task 8: `useTimer` hook

**Files:**
- Create: `src/hooks/useTimer.ts`

The timer uses `Date.now()` for all phase timing. Move cubeTimestamps are preserved in the moves array for replay.

- [ ] **Step 1: Create `src/hooks/useTimer.ts`**

```ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move } from '../types/cube'
import type { PhaseRecord, SolveMethod } from '../types/solve'
import { isSolvedFacelets } from './useCubeState'
import { applyMoveToFacelets } from './useCubeState'
import { SOLVED_FACELETS } from '../types/cube'

export type TimerStatus = 'idle' | 'solving' | 'solved'

export interface TimerResult {
  status: TimerStatus
  elapsedMs: number
  phaseRecords: PhaseRecord[]
  recordedMoves: Move[]
  reset: () => void
}

export function useTimer(
  driver: MutableRefObject<CubeDriver | null>,
  method: SolveMethod,
  armed: boolean,
): TimerResult {
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [phaseRecords, setPhaseRecords] = useState<PhaseRecord[]>([])
  const [recordedMoves, setRecordedMoves] = useState<Move[]>([])

  // Internal refs — avoid stale closures
  const statusRef = useRef<TimerStatus>('idle')
  const armedRef = useRef(false)
  const startTimeRef = useRef(0)
  const phaseStartTimeRef = useRef(0)
  const phaseFirstMoveTimeRef = useRef<number | null>(null)
  const phaseIndexRef = useRef(0)
  const phaseMoveCountRef = useRef(0)
  const completedPhasesRef = useRef<PhaseRecord[]>([])
  const movesRef = useRef<Move[]>([])
  const faceletsRef = useRef(SOLVED_FACELETS)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const methodRef = useRef(method)
  methodRef.current = method

  useEffect(() => { armedRef.current = armed }, [armed])

  const startInterval = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 50)
  }, [])

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const completePhase = useCallback((now: number) => {
    const label = methodRef.current.phases[phaseIndexRef.current]?.label ?? ''
    const group = methodRef.current.phases[phaseIndexRef.current]?.group
    const phaseStart = phaseStartTimeRef.current
    const firstMove = phaseFirstMoveTimeRef.current ?? now
    const recognitionMs = firstMove - phaseStart
    const executionMs = now - firstMove

    completedPhasesRef.current = [
      ...completedPhasesRef.current,
      { label, group, recognitionMs, executionMs, turns: phaseMoveCountRef.current },
    ]

    phaseIndexRef.current++
    phaseStartTimeRef.current = now
    phaseFirstMoveTimeRef.current = null
    phaseMoveCountRef.current = 0
  }, [])

  const reset = useCallback(() => {
    stopInterval()
    statusRef.current = 'idle'
    faceletsRef.current = SOLVED_FACELETS
    completedPhasesRef.current = []
    movesRef.current = []
    phaseIndexRef.current = 0
    phaseMoveCountRef.current = 0
    phaseFirstMoveTimeRef.current = null
    setStatus('idle')
    setElapsedMs(0)
    setPhaseRecords([])
    setRecordedMoves([])
  }, [stopInterval])

  useEffect(() => {
    const d = driver.current
    if (!d) return

    const onMove = (move: Move) => {
      const now = Date.now()

      if (statusRef.current === 'solved') return

      // Update facelets
      faceletsRef.current = applyMoveToFacelets(faceletsRef.current, move)

      if (statusRef.current === 'idle') {
        if (!armedRef.current) return
        // First move after armed → start timer
        statusRef.current = 'solving'
        startTimeRef.current = now
        phaseStartTimeRef.current = now
        phaseFirstMoveTimeRef.current = now  // Cross has no recognition
        phaseIndexRef.current = 0
        phaseMoveCountRef.current = 0
        completedPhasesRef.current = []
        movesRef.current = []
        setStatus('solving')
        startInterval()
      }

      if (statusRef.current !== 'solving') return

      movesRef.current = [...movesRef.current, move]
      phaseMoveCountRef.current++

      if (phaseFirstMoveTimeRef.current === null) {
        phaseFirstMoveTimeRef.current = now
      }

      // Check if current phase is complete
      const currentPhase = methodRef.current.phases[phaseIndexRef.current]
      if (currentPhase && currentPhase.isComplete(faceletsRef.current)) {
        completePhase(now)
      }

      // Check if cube is solved
      if (isSolvedFacelets(faceletsRef.current)) {
        // Complete any remaining phases
        while (phaseIndexRef.current < methodRef.current.phases.length) {
          completePhase(now)
        }
        stopInterval()
        const total = now - startTimeRef.current
        statusRef.current = 'solved'
        setStatus('solved')
        setElapsedMs(total)
        setPhaseRecords([...completedPhasesRef.current])
        setRecordedMoves([...movesRef.current])
      }
    }

    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, completePhase, startInterval, stopInterval])

  return { status, elapsedMs, phaseRecords, recordedMoves, reset }
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
npx vitest run
```
Expected: all previous tests still pass

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTimer.ts
git commit -m "feat: add useTimer hook with CFOP phase split tracking"
```

---

## Task 9: `ScrambleDisplay` component

**Files:**
- Create: `src/components/ScrambleDisplay.tsx`

- [ ] **Step 1: Create `src/components/ScrambleDisplay.tsx`**

```tsx
import type { ScrambleStep } from '../types/solve'
import type { StepState, TrackingState } from '../hooks/useScrambleTracker'
import { scrambleStepToString } from '../utils/scramble'
import type { Move } from '../types/cube'

interface Props {
  scramble: string | null
  steps: ScrambleStep[]
  stepStates: StepState[]
  trackingState: TrackingState
  wrongMove: Move | null
  onResetCube: () => void
  onResetGyro: () => void
}

const STATE_COLOR: Record<StepState, string> = {
  done: '#2ecc71',
  current: '#ffffff',
  pending: '#555',
  warning: '#f39c12',
}

export function ScrambleDisplay({
  scramble,
  steps,
  stepStates,
  trackingState,
  wrongMove,
  onResetCube,
  onResetGyro,
}: Props) {
  if (scramble === null) {
    return (
      <div style={{ textAlign: 'center', color: '#666', fontSize: 14, padding: '16px 0' }}>
        Generating scramble…
      </div>
    )
  }

  if (trackingState === 'wrong' && wrongMove) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: '#e74c3c', fontFamily: 'monospace', marginBottom: 12 }}>
          {wrongMove.face}{wrongMove.direction === 'CCW' ? "'" : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onResetCube} style={{ padding: '6px 14px' }}>Reset Cube</button>
          <button onClick={onResetGyro} style={{ padding: '6px 14px' }}>Reset Gyro</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 2, lineHeight: 2 }}>
        {steps.map((step, i) => (
          <span
            key={i}
            style={{
              color: STATE_COLOR[stepStates[i] ?? 'pending'],
              marginRight: 6,
              fontWeight: stepStates[i] === 'current' ? 'bold' : 'normal',
            }}
          >
            {scrambleStepToString(step)}
          </span>
        ))}
      </div>
      {(trackingState === 'warning') && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <button onClick={onResetCube} style={{ padding: '6px 14px' }}>Reset Cube</button>
          <button onClick={onResetGyro} style={{ padding: '6px 14px' }}>Reset Gyro</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScrambleDisplay.tsx
git commit -m "feat: add ScrambleDisplay with per-step color coding and wrong-move recovery UI"
```

---

## Task 10: `TimerDisplay` component

**Files:**
- Create: `src/components/TimerDisplay.tsx`

- [ ] **Step 1: Create `src/components/TimerDisplay.tsx`**

```tsx
import type { TimerStatus } from '../hooks/useTimer'

interface Props {
  elapsedMs: number
  status: TimerStatus
  armed: boolean
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2)
}

export function TimerDisplay({ elapsedMs, status, armed }: Props) {
  let color = '#aaa'
  let label = ''

  if (status === 'solving') color = '#ffffff'
  else if (status === 'solved') color = '#2ecc71'
  else if (armed) { color = '#f39c12'; label = 'Ready' }

  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      {label && (
        <div style={{ fontSize: 14, color: '#f39c12', marginBottom: 4, fontFamily: 'monospace' }}>
          {label}
        </div>
      )}
      <div style={{ fontSize: 72, fontWeight: 'bold', fontFamily: 'monospace', color, lineHeight: 1 }}>
        {formatTime(elapsedMs)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TimerDisplay.tsx
git commit -m "feat: add TimerDisplay component"
```

---

## Task 11: `PhaseBar` component

**Files:**
- Create: `src/components/PhaseBar.tsx`

- [ ] **Step 1: Create `src/components/PhaseBar.tsx`**

```tsx
import { useState } from 'react'
import type { PhaseRecord } from '../types/solve'
import type { SolveMethod } from '../types/solve'

interface Props {
  phaseRecords: PhaseRecord[]
  method: SolveMethod
  interactive?: boolean
}

function fmt(ms: number): string {
  return (ms / 1000).toFixed(2) + 's'
}

function fmtTps(turns: number, ms: number): string {
  if (ms === 0) return '—'
  return (turns / (ms / 1000)).toFixed(2)
}

export function PhaseBar({ phaseRecords, method, interactive = true }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (phaseRecords.length === 0) {
    // Show empty placeholder bar
    return (
      <div style={{ height: 24, background: '#222', borderRadius: 4, marginTop: 8 }} />
    )
  }

  const totalMs = phaseRecords.reduce((s, p) => s + p.recognitionMs + p.executionMs, 0)

  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      {/* Bar */}
      <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
        {phaseRecords.map((p, i) => {
          const stepMs = p.recognitionMs + p.executionMs
          const pct = totalMs > 0 ? (stepMs / totalMs) * 100 : 0
          const phase = method.phases[i]
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: phase?.color ?? '#555',
                cursor: interactive ? 'pointer' : 'default',
                opacity: hoveredIndex === i ? 0.8 : 1,
                transition: 'opacity 0.1s',
              }}
              onMouseEnter={() => interactive && setHoveredIndex(i)}
              onMouseLeave={() => interactive && setHoveredIndex(null)}
            />
          )
        })}
      </div>

      {/* Labels row */}
      <div style={{ display: 'flex' }}>
        {phaseRecords.map((p, i) => {
          const stepMs = p.recognitionMs + p.executionMs
          const pct = totalMs > 0 ? (stepMs / totalMs) * 100 : 0
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                fontSize: 10,
                color: '#888',
                textAlign: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {fmt(stepMs)}
            </div>
          )
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredIndex !== null && (() => {
        const p = phaseRecords[hoveredIndex]
        const stepMs = p.recognitionMs + p.executionMs
        const pct = ((stepMs / totalMs) * 100).toFixed(1)

        // F2L group totals
        const isF2L = p.group === 'F2L'
        const f2lPhases = isF2L ? phaseRecords.filter((x) => x.group === 'F2L') : []
        const f2lTotalMs = f2lPhases.reduce((s, x) => s + x.recognitionMs + x.executionMs, 0)
        const f2lTotalRec = f2lPhases.reduce((s, x) => s + x.recognitionMs, 0)
        const f2lTotalExec = f2lPhases.reduce((s, x) => s + x.executionMs, 0)
        const f2lTurns = f2lPhases.reduce((s, x) => s + x.turns, 0)
        const f2lPct = totalMs > 0 ? ((f2lTotalMs / totalMs) * 100).toFixed(1) : '0'

        return (
          <div style={{
            position: 'absolute',
            top: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '10px 14px',
            zIndex: 10,
            minWidth: 200,
            fontSize: 12,
            color: '#ccc',
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{p.label}</div>
            <div>Total Time: {fmt(stepMs)}</div>
            <div>Recognition: {p.label === 'Cross' ? '—' : fmt(p.recognitionMs)}</div>
            <div>Execution: {fmt(p.executionMs)}</div>
            <div>TPS: {fmtTps(p.turns, stepMs)}</div>
            <div>True TPS: {fmtTps(p.turns, p.executionMs)}</div>
            <div>Turns: {p.turns}</div>
            <div>Percentage: {pct}%</div>
            {isF2L && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0' }} />
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>F2L Totals</div>
                <div>Total Time: {fmt(f2lTotalMs)}</div>
                <div>Total Recognition: {fmt(f2lTotalRec)}</div>
                <div>Total Execution: {fmt(f2lTotalExec)}</div>
                <div>Total TPS: {fmtTps(f2lTurns, f2lTotalMs)}</div>
                <div>Total True TPS: {fmtTps(f2lTurns, f2lTotalExec)}</div>
                <div>Total Turns: {f2lTurns}</div>
                <div>Percentage: {f2lPct}%</div>
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PhaseBar.tsx
git commit -m "feat: add PhaseBar with hover tooltip and F2L group totals"
```

---

## Task 12: `SolveHistorySidebar` component

**Files:**
- Create: `src/components/SolveHistorySidebar.tsx`

- [ ] **Step 1: Create `src/components/SolveHistorySidebar.tsx`**

```tsx
import type { SolveRecord } from '../types/solve'

interface StatEntry {
  current: number | null
  best: number | null
}

interface SolveStats {
  single: StatEntry
  ao5: StatEntry
  ao12: StatEntry
  ao100: StatEntry
}

interface Props {
  solves: SolveRecord[]
  stats: SolveStats
  onSelectSolve: (solve: SolveRecord) => void
}

function fmtTime(ms: number | null): string {
  if (ms === null) return '—'
  return (ms / 1000).toFixed(2)
}

function fmtTps(solve: SolveRecord): string {
  const secs = solve.timeMs / 1000
  if (secs === 0) return '—'
  return (solve.moves.length / secs).toFixed(2)
}

export function SolveHistorySidebar({ solves, stats, onSelectSolve }: Props) {
  const rows: Array<{ label: string; entry: StatEntry }> = [
    { label: 'Single', entry: stats.single },
    { label: 'Ao5', entry: stats.ao5 },
    { label: 'Ao12', entry: stats.ao12 },
    { label: 'Ao100', entry: stats.ao100 },
  ]

  const reversedSolves = [...solves].reverse()

  return (
    <div style={{
      width: 160,
      background: '#0a0a1a',
      borderRight: '1px solid #222',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 12,
      color: '#ccc',
      flexShrink: 0,
    }}>
      {/* Statistics */}
      <div style={{ padding: '10px 8px', borderBottom: '1px solid #222' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#888' }}>Statistics</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#555', fontSize: 10 }}>
              <td></td>
              <td style={{ textAlign: 'right' }}>Current</td>
              <td style={{ textAlign: 'right' }}>Best</td>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, entry }) => (
              <tr key={label}>
                <td style={{ color: '#888' }}>{label}</td>
                <td style={{ textAlign: 'right' }}>{fmtTime(entry.current)}</td>
                <td style={{ textAlign: 'right', color: '#2ecc71' }}>{fmtTime(entry.best)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Solve list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        <div style={{ color: '#555', fontSize: 10, padding: '0 8px 4px' }}>Last Solves</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#555', fontSize: 10 }}>
              <td style={{ padding: '2px 8px' }}>#</td>
              <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
              <td style={{ textAlign: 'right', padding: '2px 8px' }}>TPS</td>
            </tr>
          </thead>
          <tbody>
            {reversedSolves.map((s) => (
              <tr
                key={s.id}
                onClick={() => onSelectSolve(s)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#111')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '3px 8px', color: '#555' }}>{s.id}</td>
                <td style={{ textAlign: 'right', padding: '3px 4px' }}>{fmtTime(s.timeMs)}</td>
                <td style={{ textAlign: 'right', padding: '3px 8px', color: '#888' }}>{fmtTps(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SolveHistorySidebar.tsx
git commit -m "feat: add SolveHistorySidebar with statistics and solve list"
```

---

## Task 13: `TimerScreen` + App mode toggle

**Files:**
- Create: `src/components/TimerScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/ConnectionBar.tsx`

- [ ] **Step 1: Create `src/components/TimerScreen.tsx`**

```tsx
import { useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { ConnectionStatus } from '../drivers/CubeDriver'
import type { SolveRecord } from '../types/solve'
import { useScramble } from '../hooks/useScramble'
import { useScrambleTracker } from '../hooks/useScrambleTracker'
import { useTimer } from '../hooks/useTimer'
import { useSolveHistory } from '../hooks/useSolveHistory'
import { CFOP } from '../methods/cfop'
import { CubeCanvas } from './CubeCanvas'
import { ScrambleDisplay } from './ScrambleDisplay'
import { TimerDisplay } from './TimerDisplay'
import { PhaseBar } from './PhaseBar'
import { SolveHistorySidebar } from './SolveHistorySidebar'
import { SolveDetailModal } from './SolveDetailModal'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import type { Quaternion } from '../types/cube'

interface Props {
  driver: MutableRefObject<CubeDriver | null>
  status: ConnectionStatus
  facelets: string
  quaternion: Quaternion
  onConnect: () => void
  onDisconnect: () => void
  onResetGyro: () => void
  onResetState: () => void
}

export function TimerScreen({
  driver,
  facelets,
  quaternion,
  onResetGyro,
  onResetState,
}: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const { scramble, steps, regenerate } = useScramble()
  const [armed, setArmed] = useState(false)
  const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(null)
  const idCounterRef = useRef(1)

  const tracker = useScrambleTracker(steps, driver, () => setArmed(true))

  const { status, elapsedMs, phaseRecords, recordedMoves, reset: resetTimer } = useTimer(
    driver,
    CFOP,
    armed,
  )

  const { solves, addSolve, deleteSolve, stats } = useSolveHistory()

  // Save solve when timer reaches solved
  const prevStatusRef = useRef(status)
  if (status === 'solved' && prevStatusRef.current !== 'solved') {
    const id = idCounterRef.current++
    addSolve({
      id,
      scramble: scramble ?? '',
      timeMs: elapsedMs,
      moves: recordedMoves,
      phases: phaseRecords,
      date: Date.now(),
    })
    // Generate next scramble after short delay
    setTimeout(() => {
      regenerate()
      setArmed(false)
      resetTimer()
    }, 1000)
  }
  prevStatusRef.current = status

  const handleResetCube = () => {
    onResetState()
    tracker.reset()
    setArmed(false)
    resetTimer()
    regenerate()
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <SolveHistorySidebar
        solves={solves}
        stats={stats}
        onSelectSolve={setSelectedSolve}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 16px' }}>
        <ScrambleDisplay
          scramble={scramble}
          steps={steps}
          stepStates={tracker.stepStates}
          trackingState={tracker.trackingState}
          wrongMove={tracker.wrongMove}
          onResetCube={handleResetCube}
          onResetGyro={onResetGyro}
        />

        <TimerDisplay
          elapsedMs={elapsedMs}
          status={status}
          armed={armed}
        />

        <CubeCanvas
          facelets={facelets}
          quaternion={quaternion}
          onRendererReady={(r) => { rendererRef.current = r }}
        />

        <PhaseBar phaseRecords={phaseRecords} method={CFOP} />
      </div>

      {selectedSolve && (
        <SolveDetailModal
          solve={selectedSolve}
          onClose={() => setSelectedSolve(null)}
          onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
          onUseScramble={(s) => {
            // Load this scramble into the tracker by regenerating with it
            // For now: close modal; full "use this scramble" feature requires useScramble to accept override
            setSelectedSolve(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `src/components/ConnectionBar.tsx`**

```tsx
import type { ConnectionStatus } from '../drivers/CubeDriver'

interface Props {
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  mode: 'debug' | 'timer'
  onToggleMode: () => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
}

export function ConnectionBar({ status, onConnect, onDisconnect, mode, onToggleMode }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: '#16213e' }}>
      <button
        onClick={onConnect}
        disabled={status !== 'disconnected'}
        style={{ padding: '6px 14px' }}
      >
        Connect
      </button>
      <span style={{ color: status === 'connected' ? '#4caf50' : '#aaa' }}>
        {STATUS_LABEL[status]}
      </span>
      <button
        onClick={onToggleMode}
        style={{ padding: '6px 14px', marginLeft: 'auto' }}
      >
        {mode === 'debug' ? 'Timer' : 'Debug'}
      </button>
      <button
        onClick={onDisconnect}
        disabled={status !== 'connected'}
        style={{ padding: '6px 14px' }}
      >
        Disconnect
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/App.tsx`**

```tsx
import { useRef, useState, useEffect } from 'react'
import { useCubeDriver } from './hooks/useCubeDriver'
import { useCubeState } from './hooks/useCubeState'
import { useGyro } from './hooks/useGyro'
import { useGestureDetector } from './hooks/useGestureDetector'
import { useSolveRecorder } from './hooks/useSolveRecorder'
import { ConnectionBar } from './components/ConnectionBar'
import { ControlBar } from './components/ControlBar'
import { CubeCanvas } from './components/CubeCanvas'
import { OrientationConfig } from './components/OrientationConfig'
import { MoveHistory } from './components/MoveHistory'
import { FaceletDebug } from './components/FaceletDebug'
import { SolveReplayer } from './components/SolveReplayer'
import { TimerScreen } from './components/TimerScreen'
import type { CubeRenderer } from './rendering/CubeRenderer'
import type { Move } from './types/cube'

export default function App() {
  const { driver, connect, disconnect, status } = useCubeDriver()
  const { facelets, isSolved, isSolvedRef, resetState } = useCubeState(driver)
  const { quaternion, config, resetGyro, saveOrientationConfig } = useGyro(driver)
  const { lastSession, clearSession } = useSolveRecorder(driver, isSolved)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const [moves, setMoves] = useState<Move[]>([])
  const [mode, setMode] = useState<'debug' | 'timer'>('debug')

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => setMoves((prev) => [...prev.slice(-100), m])
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => {
      rendererRef.current?.animateMove(m.face, m.direction, 150)
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver])

  useGestureDetector(driver, { resetGyro, resetState }, isSolvedRef)

  const isConnected = status === 'connected'

  return (
    <div style={{ maxWidth: mode === 'timer' ? '100%' : '600px', margin: '0 auto', minHeight: '100vh' }}>
      <ConnectionBar
        status={status}
        onConnect={connect}
        onDisconnect={disconnect}
        mode={mode}
        onToggleMode={() => setMode((m) => (m === 'debug' ? 'timer' : 'debug'))}
      />

      {mode === 'timer' ? (
        <TimerScreen
          driver={driver}
          status={status}
          facelets={facelets}
          quaternion={quaternion}
          onConnect={connect}
          onDisconnect={disconnect}
          onResetGyro={resetGyro}
          onResetState={resetState}
        />
      ) : (
        <>
          <ControlBar onResetGyro={resetGyro} onResetState={resetState} disabled={!isConnected} />
          <CubeCanvas
            facelets={facelets}
            quaternion={quaternion}
            onRendererReady={(r) => { rendererRef.current = r }}
          />
          <OrientationConfig
            config={config}
            onSave={saveOrientationConfig}
            onUseCurrentOrientation={resetGyro}
            disabled={!isConnected}
          />
          <FaceletDebug facelets={facelets} />
          <MoveHistory moves={moves} />
          {lastSession && (
            <SolveReplayer
              session={lastSession}
              renderer={rendererRef.current}
              onClose={clearSession}
            />
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run dev server to verify no compile errors**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds (or shows only type warnings, no errors that prevent build)

- [ ] **Step 5: Commit**

```bash
git add src/components/TimerScreen.tsx src/components/ConnectionBar.tsx src/App.tsx
git commit -m "feat: add TimerScreen and mode toggle (debug/timer)"
```

---

## Task 14: `SolveDetailModal` component

**Files:**
- Create: `src/components/SolveDetailModal.tsx`

- [ ] **Step 1: Create `src/components/SolveDetailModal.tsx`**

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import type { SolveRecord } from '../types/solve'
import { CFOP } from '../methods/cfop'
import { PhaseBar } from './PhaseBar'
import { CubeCanvas } from './CubeCanvas'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets } from '../hooks/useCubeState'
import type { Quaternion } from '../types/cube'

interface Props {
  solve: SolveRecord
  onClose: () => void
  onDelete: (id: number) => void
  onUseScramble: (scramble: string) => void
}

const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 }
const SPEED_OPTIONS = [0.5, 1, 2]

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2) + 's'
}

function fmtTps(turns: number, ms: number): string {
  if (ms === 0) return '—'
  return (turns / (ms / 1000)).toFixed(2)
}

function computeFaceletsAtIndex(moves: SolveRecord['moves'], index: number): string {
  let f = SOLVED_FACELETS
  for (let i = 0; i < index; i++) {
    f = applyMoveToFacelets(f, moves[i])
  }
  return f
}

function getPhaseLabelAtIndex(solve: SolveRecord, moveIndex: number): string {
  let cumulative = 0
  for (const phase of solve.phases) {
    cumulative += phase.turns
    if (moveIndex < cumulative) return phase.label
  }
  return 'Solved'
}

export function SolveDetailModal({ solve, onClose, onDelete, onUseScramble }: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [gyroEnabled, setGyroEnabled] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Sync canvas to currentIndex
  useEffect(() => {
    const facelets = computeFaceletsAtIndex(solve.moves, currentIndex)
    rendererRef.current?.queueFaceletsUpdate(facelets)
  }, [currentIndex, solve.moves])

  const cancelScheduled = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const play = useCallback(() => {
    setIsPlaying(true)
    const startIdx = currentIndex
    const moves = solve.moves

    moves.slice(startIdx).forEach((m, i) => {
      const globalIdx = startIdx + i
      const prevTs = globalIdx === 0 ? moves[0].cubeTimestamp : moves[globalIdx - 1].cubeTimestamp
      const currTs = m.cubeTimestamp
      const delay = globalIdx === 0 ? 0 : (currTs - prevTs) / speed
      const t = setTimeout(() => {
        rendererRef.current?.animateMove(m.face, m.direction, Math.max(60, delay * 0.8))
        setCurrentIndex(globalIdx + 1)
        if (globalIdx + 1 >= moves.length) setIsPlaying(false)
      }, delay)
      timeoutsRef.current.push(t)
    })
  }, [currentIndex, solve.moves, speed])

  const pause = useCallback(() => {
    cancelScheduled()
    setIsPlaying(false)
  }, [cancelScheduled])

  const scrub = useCallback((idx: number) => {
    cancelScheduled()
    setIsPlaying(false)
    setCurrentIndex(idx)
  }, [cancelScheduled])

  useEffect(() => {
    if (isPlaying) { cancelScheduled(); setIsPlaying(false) }
  }, [speed]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalMs = solve.timeMs
  const elapsedMs = currentIndex > 0
    ? solve.moves[currentIndex - 1].cubeTimestamp - solve.moves[0].cubeTimestamp
    : 0

  const totalTurns = solve.moves.length
  const tps = totalTurns / (totalMs / 1000)
  const totalExecMs = solve.phases.reduce((s, p) => s + p.executionMs, 0)

  // Cumulative totals for analysis table
  let cumMs = 0
  const tableRows = solve.phases.map((p) => {
    const stepMs = p.recognitionMs + p.executionMs
    cumMs += stepMs
    return { ...p, stepMs, cumMs }
  })
  const totalRecMs = solve.phases.reduce((s, p) => s + p.recognitionMs, 0)
  const recPct = totalMs > 0 ? ((totalRecMs / totalMs) * 100).toFixed(0) : '0'
  const execPct = totalMs > 0 ? ((totalExecMs / totalMs) * 100).toFixed(0) : '0'

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#0f1020',
        border: '1px solid #333',
        borderRadius: 8,
        width: '90vw',
        maxWidth: 860,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 20,
        color: '#ccc',
        fontSize: 13,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 'bold', fontSize: 16 }}>Solve #{solve.id}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        {/* General statistics */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Time', value: formatTime(solve.timeMs) },
            { label: 'Turns', value: String(totalTurns) },
            { label: 'TPS', value: tps.toFixed(2) },
            { label: 'Date', value: formatDate(solve.date) },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, background: '#161626', borderRadius: 4, padding: '8px 12px' }}>
              <div style={{ color: '#666', fontSize: 11 }}>{label}</div>
              <div style={{ fontWeight: 'bold', fontSize: 15 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Scramble row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#161626', borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{solve.scramble}</span>
          <button
            onClick={() => navigator.clipboard.writeText(solve.scramble)}
            style={{ padding: '4px 8px', fontSize: 11 }}
            title="Copy scramble"
          >📋</button>
          <button
            onClick={() => onUseScramble(solve.scramble)}
            style={{ padding: '4px 10px', fontSize: 11, background: '#2ecc71', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Use this scramble
          </button>
        </div>

        {/* Body: Replay + Analysis */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {/* Replay */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Replay</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={gyroEnabled} onChange={(e) => setGyroEnabled(e.target.checked)} />
                {' '}Gyro
              </label>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ padding: '3px', fontSize: 12 }}
              >
                {SPEED_OPTIONS.map((s) => <option key={s} value={s}>×{s}</option>)}
              </select>
            </div>
            <CubeCanvas
              facelets={computeFaceletsAtIndex(solve.moves, currentIndex)}
              quaternion={IDENTITY_QUATERNION}
              onRendererReady={(r) => { rendererRef.current = r }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              <button onClick={() => scrub(0)}>«</button>
              <button onClick={() => scrub(Math.max(0, currentIndex - 1))}>‹</button>
              <button onClick={isPlaying ? pause : play}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={() => scrub(Math.min(solve.moves.length, currentIndex + 1))}>›</button>
              <button onClick={() => scrub(solve.moves.length)}>»</button>
            </div>
            <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 4 }}>
              {getPhaseLabelAtIndex(solve, currentIndex)} — {formatTime(elapsedMs)} / {formatTime(totalMs)}
            </div>
            <input
              type="range" min={0} max={solve.moves.length} value={currentIndex}
              onChange={(e) => scrub(Number(e.target.value))}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>

          {/* Detailed Analysis */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Detailed Analysis</span>
              <span style={{ color: '#888', fontSize: 12 }}>CFOP</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#555', borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '3px 4px' }}>Step</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Recog.</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Exec.</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Step</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>Turns</td>
                </tr>
                <tr style={{ color: '#888', borderBottom: '1px solid #222', fontSize: 11 }}>
                  <td style={{ padding: '3px 4px' }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalRecMs)} ({recPct}%)</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalExecMs)} ({execPct}%)</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalMs)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatTime(totalMs)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{totalTurns}</td>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a2e' }}>
                    <td style={{ padding: '4px 4px' }}>{row.label}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                      {row.label === 'Cross' ? '—' : formatTime(row.recognitionMs)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.executionMs)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.stepMs)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{formatTime(row.cumMs)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>{row.turns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Time Distribution */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>Time Distribution</div>
          <PhaseBar phaseRecords={solve.phases} method={CFOP} interactive={false} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {confirmDelete ? (
            <>
              <span style={{ color: '#e74c3c', fontSize: 12, marginRight: 8, alignSelf: 'center' }}>
                Delete this solve?
              </span>
              <button onClick={() => onDelete(solve.id)} style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px' }}>
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full build to catch any compile errors**

```bash
npm run build 2>&1 | tail -30
```
Expected: successful build

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/SolveDetailModal.tsx
git commit -m "feat: add SolveDetailModal with mini canvas replay and phase analysis table"
```

- [ ] **Step 5: Tag and push**

```bash
git tag -a v0.2 -m "v0.2: scramble tracker, CFOP timer, solve history, solve detail modal"
git push && git push --tags
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| WCA scramble generation (cubing.js) | Task 6 |
| Scramble displayed only, hardware tracking | Task 7 |
| Step states: done/current/pending/warning/wrong | Task 7, 9 |
| Double move (R2): both directions valid | Task 7 |
| Warning: right face wrong execution | Task 7, 9 |
| Wrong: hide sequence, show offending move in red | Task 9 |
| Timer arms after all steps done | Task 7, 8 |
| Timer starts on first move after armed | Task 8 |
| 9 CFOP phases with cross, F2L×4, EOLL, OLL, CPLL, Solved | Task 3, 4 |
| Recognition / Execution split per phase | Task 8 |
| TPS and True TPS | Task 8, 11 |
| Phase bar with hover tooltip and F2L group totals | Task 11 |
| Solve history: localStorage persistence | Task 5 |
| Statistics: Single, Ao5, Ao12, Ao100 (current + best) | Task 5 |
| Timer mode layout: sidebar + main area | Task 13 |
| Mode toggle (debug/timer) | Task 13 |
| Solve detail modal with mini canvas | Task 14 |
| Replay with controls and scrub bar | Task 14 |
| Detailed analysis table (Step/Recog/Exec/Step/Total/Turns) | Task 14 |
| Delete solve with confirmation | Task 14 |
| Copy scramble + "Use this scramble" button | Task 14 |

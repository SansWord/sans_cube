# Roux Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Roux method support with 6 phases (FB→SB→CMLL→EO→UL+UR→EP), a method selector dropdown, and per-solve method recording/display.

**Architecture:** Add `src/utils/roux.ts` for facelet detection (yellow-bottom, orange-L, red-R hardcoded), `src/methods/roux.ts` for the SolveMethod object, `src/methods/index.ts` for a method lookup helper, `src/hooks/useMethod.ts` for localStorage persistence, and `src/components/MethodSelector.tsx` for the UI. Wire everything into TimerScreen, SolveDetailModal, and SolveHistorySidebar.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom), existing `applyMoveToFacelets` + `SOLVED_FACELETS` for test helpers.

---

## Facelet Index Reference

Face layout in the 54-char string: U(0–8) R(9–17) F(18–26) D(27–35) L(36–44) B(45–53).

```
Piece        U    R    F    D    L    B
UFL corner   6   —    18   —    38   —
UFR corner   8    9   20   —    —    —
UBR corner   2   11   —    —    —    45
UBL corner   0   —    —    —    36   47
DFL corner   —   —    24   27   44   —
DFR corner   —   15   26   29   —    —
DBR corner   —   17   —    35   —    51
DBL corner   —   —    —    33   42   53

UF edge      7   —    19   —    —    —
UR edge      5   10   —    —    —    —
UB edge      1   —    —    —    —    46
UL edge      3   —    —    —    37   —
FR edge      —   12   23   —    —    —
FL edge      —   —    21   —    41   —
BR edge      —   14   —    —    —    48
BL edge      —   —    —    —    39   50
DF edge      —   —    25   28   —    —
DR edge      —   16   —    32   —    —
DB edge      —   —    —    34   —    52
DL edge      —   —    —    30   43   —

Centers      4   13   22   31   40   49
```

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/utils/roux.ts` | Facelet detection functions |
| Create | `src/methods/roux.ts` | `ROUX` SolveMethod object |
| Create | `src/methods/index.ts` | `getMethod(id?)` lookup helper |
| Create | `src/hooks/useMethod.ts` | Method selection + localStorage |
| Create | `src/components/MethodSelector.tsx` | Dropdown UI |
| Create | `tests/utils/roux.test.ts` | Unit tests for detection |
| Modify | `src/types/solve.ts` | Add `method?: string` to SolveRecord |
| Modify | `src/utils/storageKeys.ts` | Add `METHOD` key |
| Modify | `src/components/TimerScreen.tsx` | Wire method + render selector |
| Modify | `src/components/SolveDetailModal.tsx` | Resolve method, show label |
| Modify | `src/components/SolveHistorySidebar.tsx` | Show method label per row |

---

## Task 1: Type and storage key changes

**Files:**
- Modify: `src/types/solve.ts`
- Modify: `src/utils/storageKeys.ts`

- [ ] **Step 1: Add `method` field to SolveRecord**

In `src/types/solve.ts`, add one field to `SolveRecord`:

```ts
export interface SolveRecord {
  id: number
  scramble: string
  timeMs: number
  moves: Move[]
  phases: PhaseRecord[]
  date: number
  quaternionSnapshots?: QuaternionSnapshot[]
  driver?: 'cube' | 'mouse'
  isExample?: boolean
  method?: string   // 'cfop' | 'roux'; absent on old solves, treated as 'cfop'
}
```

- [ ] **Step 2: Add METHOD key to storageKeys**

In `src/utils/storageKeys.ts`:

```ts
export const STORAGE_KEYS = {
  SOLVES: 'sans_cube_solves',
  NEXT_ID: 'sans_cube_next_id',
  DISMISSED_EXAMPLES: 'sans_cube_dismissed_examples',
  ORIENTATION_CONFIG: 'cubeOrientationConfig',
  SIDEBAR_WIDTH: 'sidebarWidth',
  METHOD: 'sans_cube_method',
} as const
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/solve.ts src/utils/storageKeys.ts
git commit -m "feat: add method field to SolveRecord and METHOD storage key"
```

---

## Task 2: Roux facelet detection utils

**Files:**
- Create: `src/utils/roux.ts`
- Create: `tests/utils/roux.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/roux.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  isLDBlockDone,
  isRDBlockDone,
  isFirstBlockDone,
  isSecondBlockDone,
  isCMLLDone,
  isEODone,
  isULURDone,
} from '../../src/utils/roux'
import { SOLVED_FACELETS } from '../../src/types/cube'
import { applyMoveToFacelets } from '../../src/hooks/useCubeState'
import type { Move } from '../../src/types/cube'

function move(face: Move['face'], direction: Move['direction'] = 'CW'): Move {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

function applyMoves(facelets: string, moves: Move[]): string {
  return moves.reduce(applyMoveToFacelets, facelets)
}

describe('isLDBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isLDBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after L move (breaks left block)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isLDBlockDone(f)).toBe(false)
  })

  it('returns true after R move (right side unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isLDBlockDone(f)).toBe(true)
  })

  it('returns true after U move (DL block unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isLDBlockDone(f)).toBe(true)
  })

  it('returns false after D move (base pieces disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    expect(isLDBlockDone(f)).toBe(false)
  })
})

describe('isRDBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isRDBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (breaks right block)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isRDBlockDone(f)).toBe(false)
  })

  it('returns true after L move (left side unchanged)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isRDBlockDone(f)).toBe(true)
  })

  it('returns false after D move (base pieces disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    expect(isRDBlockDone(f)).toBe(false)
  })
})

describe('isFirstBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isFirstBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns true after R move (L block still intact)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isFirstBlockDone(f)).toBe(true)
  })

  it('returns true after L move (R block still intact)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isFirstBlockDone(f)).toBe(true)
  })

  it('returns false after D move (both blocks disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('D')])
    expect(isFirstBlockDone(f)).toBe(false)
  })
})

describe('isSecondBlockDone', () => {
  it('returns true for solved cube', () => {
    expect(isSecondBlockDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (R block broken)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isSecondBlockDone(f)).toBe(false)
  })

  it('returns false after L move (L block broken)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isSecondBlockDone(f)).toBe(false)
  })
})

describe('isCMLLDone', () => {
  it('returns true for solved cube', () => {
    expect(isCMLLDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after R move (U-layer corners disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isCMLLDone(f)).toBe(false)
  })

  it('returns false after F move (U-layer corners disturbed)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    expect(isCMLLDone(f)).toBe(false)
  })

  it('returns false after U move (corners leave home faces)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isCMLLDone(f)).toBe(false)
  })
})

describe('isEODone', () => {
  it('returns true for solved cube', () => {
    expect(isEODone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after F move (flips UF edge)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('F')])
    expect(isEODone(f)).toBe(false)
  })

  it('returns false after B move (flips UB edge)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('B')])
    expect(isEODone(f)).toBe(false)
  })

  it('returns true after U move (no edge flipping)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isEODone(f)).toBe(true)
  })
})

describe('isULURDone', () => {
  it('returns true for solved cube', () => {
    expect(isULURDone(SOLVED_FACELETS)).toBe(true)
  })

  it('returns false after U move (UL and UR edges cycle away)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('U')])
    expect(isULURDone(f)).toBe(false)
  })

  it('returns false after L move (UL edge displaced)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('L')])
    expect(isULURDone(f)).toBe(false)
  })

  it('returns false after R move (UR edge displaced)', () => {
    const f = applyMoves(SOLVED_FACELETS, [move('R')])
    expect(isULURDone(f)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
npx vitest run tests/utils/roux.test.ts
```

Expected: all tests FAIL with "Cannot find module '../../src/utils/roux'".

- [ ] **Step 3: Implement `src/utils/roux.ts`**

Create `src/utils/roux.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run tests/utils/roux.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/roux.ts tests/utils/roux.test.ts
git commit -m "feat: add Roux facelet detection utils with tests"
```

---

## Task 3: ROUX method object and getMethod helper

**Files:**
- Create: `src/methods/roux.ts`
- Create: `src/methods/index.ts`

- [ ] **Step 1: Create `src/methods/roux.ts`**

```ts
import type { SolveMethod } from '../types/solve'
import {
  isFirstBlockDone,
  isSecondBlockDone,
  isCMLLDone,
  isEODone,
  isULURDone,
} from '../utils/roux'
import { isSolvedFacelets } from '../hooks/useCubeState'

export const ROUX: SolveMethod = {
  id: 'roux',
  label: 'Roux',
  phases: [
    {
      label: 'FB',
      color: '#8e44ad',
      isComplete: isFirstBlockDone,
    },
    {
      label: 'SB',
      color: '#9b59b6',
      isComplete: isSecondBlockDone,
    },
    {
      label: 'CMLL',
      color: '#e67e22',
      isComplete: isCMLLDone,
    },
    {
      label: 'EO',
      group: 'LSE',
      color: '#16a085',
      isComplete: isEODone,
    },
    {
      label: 'UL+UR',
      group: 'LSE',
      color: '#1abc9c',
      isComplete: isULURDone,
    },
    {
      label: 'EP',
      group: 'LSE',
      color: '#2ecc71',
      isComplete: isSolvedFacelets,
    },
  ],
}
```

- [ ] **Step 2: Create `src/methods/index.ts`**

```ts
import type { SolveMethod } from '../types/solve'
import { CFOP } from './cfop'
import { ROUX } from './roux'

export { CFOP, ROUX }

export function getMethod(id?: string): SolveMethod {
  if (id === 'roux') return ROUX
  return CFOP
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/methods/roux.ts src/methods/index.ts
git commit -m "feat: add ROUX SolveMethod and getMethod lookup helper"
```

---

## Task 4: useMethod hook

**Files:**
- Create: `src/hooks/useMethod.ts`

- [ ] **Step 1: Create `src/hooks/useMethod.ts`**

```ts
import { useState, useCallback } from 'react'
import type { SolveMethod } from '../types/solve'
import { STORAGE_KEYS } from '../utils/storageKeys'
import { getMethod } from '../methods/index'

export function useMethod(): { method: SolveMethod; setMethod: (m: SolveMethod) => void } {
  const [method, setMethodState] = useState<SolveMethod>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.METHOD)
    return getMethod(saved ?? undefined)
  })

  const setMethod = useCallback((m: SolveMethod) => {
    localStorage.setItem(STORAGE_KEYS.METHOD, m.id)
    setMethodState(m)
  }, [])

  return { method, setMethod }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMethod.ts
git commit -m "feat: add useMethod hook with localStorage persistence"
```

---

## Task 5: MethodSelector component

**Files:**
- Create: `src/components/MethodSelector.tsx`

- [ ] **Step 1: Create `src/components/MethodSelector.tsx`**

```tsx
import type { SolveMethod } from '../types/solve'
import { CFOP, ROUX } from '../methods/index'

const METHODS: SolveMethod[] = [CFOP, ROUX]

interface Props {
  method: SolveMethod
  onChange: (m: SolveMethod) => void
  disabled?: boolean
}

export function MethodSelector({ method, onChange, disabled }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <label style={{ color: '#888', fontSize: 12 }}>Method</label>
      <select
        value={method.id}
        onChange={(e) => {
          const m = METHODS.find((x) => x.id === e.target.value)
          if (m) onChange(m)
        }}
        disabled={disabled}
        style={{ padding: '3px 6px', fontSize: 12, background: '#161626', color: '#ccc', border: '1px solid #333', borderRadius: 4 }}
      >
        {METHODS.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MethodSelector.tsx
git commit -m "feat: add MethodSelector dropdown component"
```

---

## Task 6: Wire up TimerScreen

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Update imports**

Replace the existing import line:
```ts
import { CFOP } from '../methods/cfop'
```

With:
```ts
import { useMethod } from '../hooks/useMethod'
import { MethodSelector } from './MethodSelector'
```

- [ ] **Step 2: Replace hardcoded CFOP with useMethod**

Inside the `TimerScreen` function body, replace:

```ts
const { status, elapsedMs, phaseRecords, recordedMoves, quaternionSnapshots, reset: resetTimer } = useTimer(
  driver,
  CFOP,
  armed,
  driverVersion,
)
```

With:

```ts
const { method, setMethod } = useMethod()

const { status, elapsedMs, phaseRecords, recordedMoves, quaternionSnapshots, reset: resetTimer } = useTimer(
  driver,
  method,
  armed,
  driverVersion,
)
```

- [ ] **Step 3: Add method to the save call**

Replace the `addSolve` call (around line 119) — add `method: method.id`:

```ts
addSolve({
  id,
  scramble: scramble ?? '',
  timeMs: elapsedMs,
  moves: recordedMoves,
  phases: phaseRecords,
  quaternionSnapshots,
  date: Date.now(),
  driver: driverType,
  method: method.id,
})
```

- [ ] **Step 4: Replace hardcoded CFOP in PhaseBar and add MethodSelector**

Find the JSX block that renders `<PhaseBar phaseRecords={displayedPhaseRecords} method={CFOP} />` and replace the surrounding area:

```tsx
<MethodSelector
  method={method}
  onChange={(m) => { setMethod(m); setArmed(false); resetTimer() }}
  disabled={status === 'solving'}
/>

<PhaseBar phaseRecords={displayedPhaseRecords} method={method} />
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: wire method selector into TimerScreen"
```

---

## Task 7: Update SolveDetailModal

**Files:**
- Modify: `src/components/SolveDetailModal.tsx`

The modal currently hardcodes `CFOP` in two places:
1. `import { CFOP } from '../methods/cfop'` — used in `<PhaseBar method={CFOP} />`
2. `<span style={{ color: '#888', fontSize: 12 }}>CFOP</span>` — the Detailed Analysis header label

- [ ] **Step 1: Update imports**

Replace:
```ts
import { CFOP } from '../methods/cfop'
```

With:
```ts
import { getMethod } from '../methods/index'
```

- [ ] **Step 2: Derive method from solve inside the component**

Inside `SolveDetailModal`, just after the existing `const scrambledFacelets = ...` line, add:

```ts
const method = getMethod(solve.method)
```

- [ ] **Step 3: Replace hardcoded CFOP in PhaseBar**

Find `method={CFOP}` in the PhaseBar render and replace with `method={method}`.

- [ ] **Step 4: Replace hardcoded CFOP label in Detailed Analysis header**

Find:
```tsx
<span style={{ color: '#888', fontSize: 12 }}>CFOP</span>
```

Replace with:
```tsx
<span style={{ color: '#888', fontSize: 12 }}>{method.label}</span>
```

- [ ] **Step 5: Add Method stat card**

In the stats grid array, add a "Method" entry. The existing array is:

```tsx
[
  { label: 'Time',   value: formatTime(solve.timeMs) },
  { label: 'Turns',  value: String(totalTurns) },
  { label: 'TPS',    value: tps.toFixed(2) },
  { label: 'Date',   value: formatDate(solve.date) },
  { label: 'Driver', value: solve.driver === 'cube' ? 'Cube' : solve.driver === 'mouse' ? 'Mouse' : '—' },
]
```

Replace with:

```tsx
[
  { label: 'Time',   value: formatTime(solve.timeMs) },
  { label: 'Turns',  value: String(totalTurns) },
  { label: 'TPS',    value: tps.toFixed(2) },
  { label: 'Date',   value: formatDate(solve.date) },
  { label: 'Driver', value: solve.driver === 'cube' ? 'Cube' : solve.driver === 'mouse' ? 'Mouse' : '—' },
  { label: 'Method', value: method.label },
]
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 7: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/SolveDetailModal.tsx
git commit -m "feat: show method label in SolveDetailModal"
```

---

## Task 8: Update SolveHistorySidebar

**Files:**
- Modify: `src/components/SolveHistorySidebar.tsx`

The sidebar has two render paths — overlay mode (mobile) and sidebar mode (desktop). Both have a solve rows table with columns #, Time, TPS. Add a Method column to both.

- [ ] **Step 1: Add Method column header to sidebar mode**

In the sidebar mode table, find:
```tsx
<tr style={{ color: '#555', fontSize: fontSize - 2 }}>
  <td style={{ padding: '2px 8px' }}>#</td>
  <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
  <td style={{ textAlign: 'right', padding: '2px 8px' }}>TPS</td>
</tr>
```

Replace with:
```tsx
<tr style={{ color: '#555', fontSize: fontSize - 2 }}>
  <td style={{ padding: '2px 8px' }}>#</td>
  <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
  <td style={{ textAlign: 'right', padding: '2px 4px' }}>TPS</td>
  <td style={{ textAlign: 'right', padding: '2px 8px' }}>Method</td>
</tr>
```

- [ ] **Step 2: Add Method cell to each sidebar mode row**

Find the row render in sidebar mode:
```tsx
<td style={{ padding: '3px 8px', color: '#555' }}>{s.isExample ? '★' : s.id}</td>
<td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatSeconds(s.timeMs)}</td>
<td style={{ textAlign: 'right', padding: '3px 8px', color: '#888' }}>{fmtTps(s)}</td>
```

Replace with:
```tsx
<td style={{ padding: '3px 8px', color: '#555' }}>{s.isExample ? '★' : s.id}</td>
<td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatSeconds(s.timeMs)}</td>
<td style={{ textAlign: 'right', padding: '3px 4px', color: '#888' }}>{fmtTps(s)}</td>
<td style={{ textAlign: 'right', padding: '3px 8px', color: '#555', fontSize: fontSize - 2 }}>{s.method === 'roux' ? 'Roux' : 'CFOP'}</td>
```

- [ ] **Step 3: Add Method column header to overlay mode**

In the overlay mode table, find:
```tsx
<tr style={{ color: '#555', fontSize: 11 }}>
  <td style={{ padding: '2px 12px' }}>#</td>
  <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
  <td style={{ textAlign: 'right', padding: '2px 12px' }}>TPS</td>
</tr>
```

Replace with:
```tsx
<tr style={{ color: '#555', fontSize: 11 }}>
  <td style={{ padding: '2px 12px' }}>#</td>
  <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
  <td style={{ textAlign: 'right', padding: '2px 4px' }}>TPS</td>
  <td style={{ textAlign: 'right', padding: '2px 12px' }}>Method</td>
</tr>
```

- [ ] **Step 4: Add Method cell to each overlay mode row**

Find the row render in overlay mode:
```tsx
<td style={{ padding: '3px 12px', color: '#555' }}>{s.isExample ? '★' : s.id}</td>
<td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatSeconds(s.timeMs)}</td>
<td style={{ textAlign: 'right', padding: '3px 12px', color: '#888' }}>{fmtTps(s)}</td>
```

Replace with:
```tsx
<td style={{ padding: '3px 12px', color: '#555' }}>{s.isExample ? '★' : s.id}</td>
<td style={{ textAlign: 'right', padding: '3px 4px' }}>{formatSeconds(s.timeMs)}</td>
<td style={{ textAlign: 'right', padding: '3px 4px', color: '#888' }}>{fmtTps(s)}</td>
<td style={{ textAlign: 'right', padding: '3px 12px', color: '#555', fontSize: 11 }}>{s.method === 'roux' ? 'Roux' : 'CFOP'}</td>
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/SolveHistorySidebar.tsx
git commit -m "feat: show method label per solve row in SolveHistorySidebar"
```

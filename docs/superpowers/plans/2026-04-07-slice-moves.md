# Slice Move Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect M/E/S slice moves from paired GAN hardware events and apply their sticker cycles to the cube facelet state.

**Architecture:** A `SliceMoveDetector` middleware class wraps `GanCubeDriver`, buffers single outer-face events up to 50ms (`cubeTimestamp`), coalesces same-axis opposite-direction pairs into a single `Move` with face `M`/`E`/`S`, and re-emits. The `Move` type gains a `SliceFace` union so downstream code (`applyMoveToFacelets`) can handle all nine move types.

**Tech Stack:** TypeScript, Vitest, no new dependencies.

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/types/cube.ts` | Add `SliceFace`, `AnyFace`; broaden `Move.face` |
| Create | `src/drivers/SliceMoveDetector.ts` | Middleware: buffers & coalesces slice pairs |
| Create | `tests/drivers/SliceMoveDetector.test.ts` | Unit tests for all 7 detection cases + integration |
| Modify | `src/hooks/useCubeState.ts` | Add M/E/S cases to `applyMoveToFacelets` |
| Modify | `tests/hooks/useCubeState.test.ts` | Add M/E/S sticker cycle tests |
| Modify | `src/hooks/useCubeDriver.ts` | Wrap `GanCubeDriver` with `SliceMoveDetector` |
| Modify | `src/drivers/GanCubeDriver.ts` | Remove diagnostic `console.log` |

---

### Task 1: Broaden the `Move` type

**Files:**
- Modify: `src/types/cube.ts`

- [ ] **Step 1: Add `SliceFace` and `AnyFace` and update `Move.face`**

In `src/types/cube.ts`, add after the `Face` line and update `Move`:

```ts
export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type SliceFace = 'M' | 'E' | 'S'
export type AnyFace = Face | SliceFace
export type Direction = 'CW' | 'CCW'

export interface Move {
  face: AnyFace   // was Face
  direction: Direction
  cubeTimestamp: number
  serial: number
  quaternion?: Quaternion
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors. (`GAN_FACE_MAP` returns `Face` which is a subset of `AnyFace` — widening is valid.)

- [ ] **Step 3: Commit**

```bash
git add src/types/cube.ts
git commit -m "feat: add SliceFace and AnyFace types, broaden Move.face"
```

---

### Task 2: Create `SliceMoveDetector` stub

**Files:**
- Create: `src/drivers/SliceMoveDetector.ts`

Needed before tests can import it.

- [ ] **Step 1: Create the stub**

Create `src/drivers/SliceMoveDetector.ts`:

```ts
import { CubeEventEmitter, type CubeDriver } from './CubeDriver'
import type { Move } from '../types/cube'

export class SliceMoveDetector extends CubeEventEmitter implements CubeDriver {
  constructor(_inner: CubeDriver) {
    super()
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors.

---

### Task 3: Write `SliceMoveDetector` unit tests

**Files:**
- Create: `tests/drivers/SliceMoveDetector.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/drivers/SliceMoveDetector.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SliceMoveDetector } from '../../src/drivers/SliceMoveDetector'
import { CubeEventEmitter } from '../../src/drivers/CubeDriver'
import type { CubeDriver } from '../../src/drivers/CubeDriver'
import type { Move } from '../../src/types/cube'

// Minimal in-process driver for feeding moves to SliceMoveDetector
class MockDriver extends CubeEventEmitter implements CubeDriver {
  async connect() {}
  async disconnect() {}
}

function makeMove(face: Move['face'], direction: Move['direction'], cubeTimestamp: number, serial = 1): Move {
  return { face, direction, cubeTimestamp, serial }
}

describe('SliceMoveDetector', () => {
  let inner: MockDriver
  let detector: SliceMoveDetector
  let received: Move[]

  beforeEach(() => {
    vi.useFakeTimers()
    inner = new MockDriver()
    detector = new SliceMoveDetector(inner)
    received = []
    detector.on('move', (m) => received.push(m))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Case 1: L CCW → R CW within 50ms → M CW
  it('coalesces L CCW + R CW into M CW', () => {
    inner.emit('move', makeMove('L', 'CCW', 1000, 1))
    inner.emit('move', makeMove('R', 'CW', 1040, 2))
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
    expect(received[0].cubeTimestamp).toBe(1000) // first event's timestamp
    expect(received[0].serial).toBe(1)           // first event's serial
  })

  // Case 2: R CW → L CCW within 50ms → M CW (order-independent)
  it('coalesces R CW + L CCW into M CW (order-independent)', () => {
    inner.emit('move', makeMove('R', 'CW', 2000, 3))
    inner.emit('move', makeMove('L', 'CCW', 2030, 4))
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
  })

  // Case 3: L CW → R CCW within 50ms → M CCW
  it('coalesces L CW + R CCW into M CCW', () => {
    inner.emit('move', makeMove('L', 'CW', 3000, 5))
    inner.emit('move', makeMove('R', 'CCW', 3020, 6))
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CCW')
  })

  // Case 4: L CCW → R CCW within 50ms → both pass through (direction mismatch)
  it('passes through both moves when directions do not form a slice pair', () => {
    inner.emit('move', makeMove('L', 'CCW', 4000, 7))
    inner.emit('move', makeMove('R', 'CCW', 4020, 8))
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('L')
    expect(received[1].face).toBe('R')
  })

  // Case 5: L CCW with no partner → timeout flushes it as-is
  it('flushes pending move after 200ms wall-time timeout', () => {
    inner.emit('move', makeMove('L', 'CCW', 5000, 9))
    expect(received).toHaveLength(0) // not yet emitted
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('L')
    expect(received[0].direction).toBe('CCW')
  })

  // Case 6: L CCW → R CW but cubeTimestamp gap > 50ms → both pass through
  it('does not coalesce when cubeTimestamp gap exceeds 50ms', () => {
    inner.emit('move', makeMove('L', 'CCW', 6000, 10))
    inner.emit('move', makeMove('R', 'CW', 6100, 11)) // 100ms gap
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('L')
    expect(received[1].face).toBe('R')
  })

  // Case 7: M2 — two consecutive M CW pairs
  it('detects M2 as two separate M CW moves', () => {
    inner.emit('move', makeMove('L', 'CCW', 7000, 12))
    inner.emit('move', makeMove('R', 'CW', 7030, 13))
    inner.emit('move', makeMove('L', 'CCW', 7060, 14))
    inner.emit('move', makeMove('R', 'CW', 7090, 15))
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('M')
    expect(received[0].direction).toBe('CW')
    expect(received[1].face).toBe('M')
    expect(received[1].direction).toBe('CW')
  })

  // Non-slice moves pass through immediately via buffering
  it('passes through non-paireable moves via flush-on-next', () => {
    inner.emit('move', makeMove('U', 'CW', 8000, 16))
    inner.emit('move', makeMove('U', 'CW', 8500, 17))
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(2)
    expect(received[0].face).toBe('U')
    expect(received[1].face).toBe('U')
  })

  // Gyro/connection/battery pass through unchanged
  it('forwards gyro events unchanged', () => {
    const quats: unknown[] = []
    detector.on('gyro', (q) => quats.push(q))
    inner.emit('gyro', { x: 0.1, y: 0.2, z: 0.3, w: 0.9 })
    expect(quats).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm run test -- tests/drivers/SliceMoveDetector.test.ts 2>&1 | tail -20
```

Expected: tests fail (stub emits nothing).

---

### Task 4: Implement `SliceMoveDetector`

**Files:**
- Modify: `src/drivers/SliceMoveDetector.ts`

- [ ] **Step 1: Write the full implementation**

Replace `src/drivers/SliceMoveDetector.ts` with:

```ts
import { CubeEventEmitter, type CubeDriver } from './CubeDriver'
import type { Move, SliceFace, Direction } from '../types/cube'

/**
 * Detects M/E/S slice moves from paired GAN hardware events.
 *
 * GAN cubes report slice moves as two outer-face events on the same axis with
 * opposite directions arriving within ≤50ms (cubeTimestamp). This middleware
 * buffers each move, attempts to pair the next one, and either emits a single
 * slice Move or flushes both as-is. A 200ms wall-time safety timeout flushes
 * a lone pending move in case the second BLE event is lost.
 */
export class SliceMoveDetector extends CubeEventEmitter implements CubeDriver {
  private _inner: CubeDriver
  private _pending: Move | null = null
  private _flushTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(inner: CubeDriver) {
    super()
    this._inner = inner
    inner.on('move', (move) => this._onMove(move))
    inner.on('gyro', (q) => this.emit('gyro', q))
    inner.on('connection', (s) => this.emit('connection', s))
    inner.on('battery', (b) => this.emit('battery', b))
  }

  async connect(): Promise<void> { return this._inner.connect() }
  async disconnect(): Promise<void> { return this._inner.disconnect() }

  private _onMove(move: Move): void {
    if (this._pending === null) {
      this._setPending(move)
      return
    }

    const slice = tryPair(this._pending, move)
    if (slice !== null) {
      this._clearFlushTimeout()
      const sliceMove: Move = {
        face: slice.face,
        direction: slice.direction,
        cubeTimestamp: this._pending.cubeTimestamp,
        serial: this._pending.serial,
        quaternion: this._pending.quaternion,
      }
      this._pending = null
      this.emit('move', sliceMove)
    } else {
      // Flush pending as-is, buffer the new move
      const flushed = this._pending
      this._clearFlushTimeout()
      this._pending = null
      this.emit('move', flushed)
      this._setPending(move)
    }
  }

  private _setPending(move: Move): void {
    this._pending = move
    this._flushTimeout = setTimeout(() => {
      if (this._pending !== null) {
        const flushed = this._pending
        this._pending = null
        this.emit('move', flushed)
      }
    }, 200)
  }

  private _clearFlushTimeout(): void {
    if (this._flushTimeout !== null) {
      clearTimeout(this._flushTimeout)
      this._flushTimeout = null
    }
  }
}

/** Returns the slice move if (pending, incoming) form a valid pair, else null. */
function tryPair(pending: Move, incoming: Move): { face: SliceFace; direction: Direction } | null {
  if (Math.abs(incoming.cubeTimestamp - pending.cubeTimestamp) > 50) return null
  if (pending.direction === incoming.direction) return null // same direction = no slice

  const p = pending.face
  const i = incoming.face

  // M: L + R (opposite directions). Slice direction = R's direction.
  if (p === 'L' && i === 'R') return { face: 'M', direction: incoming.direction }
  if (p === 'R' && i === 'L') return { face: 'M', direction: pending.direction }

  // E: D + U (opposite directions). Slice direction = U's direction.
  if (p === 'D' && i === 'U') return { face: 'E', direction: incoming.direction }
  if (p === 'U' && i === 'D') return { face: 'E', direction: pending.direction }

  // S: F + B (opposite directions). Slice direction = B's direction.
  if (p === 'F' && i === 'B') return { face: 'S', direction: incoming.direction }
  if (p === 'B' && i === 'F') return { face: 'S', direction: pending.direction }

  return null
}
```

- [ ] **Step 2: Run tests and confirm they pass**

```bash
npm run test -- tests/drivers/SliceMoveDetector.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/drivers/SliceMoveDetector.ts
git commit -m "feat: implement SliceMoveDetector middleware for M/E/S detection"
```

---

### Task 5: Write `applyMoveToFacelets` M/E/S tests

**Files:**
- Modify: `tests/hooks/useCubeState.test.ts`

Kociemba layout reminder: `U:0-8, R:9-17, F:18-26, D:27-35, L:36-44, B:45-53`

- [ ] **Step 1: Append M/E/S test cases to `tests/hooks/useCubeState.test.ts`**

Add at the end of the file:

```ts
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
```

- [ ] **Step 2: Run tests and confirm M/E/S tests fail**

```bash
npm run test -- tests/hooks/useCubeState.test.ts 2>&1 | tail -30
```

Expected: existing tests pass, new M/E/S tests fail (switch has no case for 'M', 'E', 'S').

---

### Task 6: Implement M/E/S cases in `applyMoveToFacelets`

**Files:**
- Modify: `src/hooks/useCubeState.ts:73-135`

- [ ] **Step 1: Add M/E/S cases to the switch in `applyMoveToFacelets`**

In `src/hooks/useCubeState.ts`, add before the closing `}` of the switch (after the `case 'B':` block, before `}`):

```ts
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
```

The full switch block should look like this after the edit (showing context):

```ts
    case 'B':
      if (ccw) rotateFaceCCW(f, 45); else rotateFaceCW(f, 45)
      cycle(f, 0, 1, 2, 42, 39, 36, 35, 34, 33, 11, 14, 17)
      break

    case 'M':
      cycle(f, 1, 4, 7, 19, 22, 25, 28, 31, 34, 52, 49, 46)
      break

    case 'E':
      cycle(f, 21, 22, 23, 12, 13, 14, 48, 49, 50, 39, 40, 41)
      break

    case 'S':
      cycle(f, 3, 4, 5, 10, 13, 16, 32, 31, 30, 43, 40, 37)
      break
  }

  return f.join('')
```

- [ ] **Step 2: Run all `useCubeState` tests**

```bash
npm run test -- tests/hooks/useCubeState.test.ts 2>&1 | tail -30
```

Expected: all tests pass (existing + new M/E/S).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCubeState.ts tests/hooks/useCubeState.test.ts
git commit -m "feat: add M/E/S sticker cycles to applyMoveToFacelets"
```

---

### Task 7: Integration test — detector → facelets

**Files:**
- Modify: `tests/drivers/SliceMoveDetector.test.ts`

Tests the full pipeline: `SliceMoveDetector` emits `M CW` → `applyMoveToFacelets` applies it correctly.

- [ ] **Step 1: Add integration test to `tests/drivers/SliceMoveDetector.test.ts`**

Add at the top of the file (with imports):

```ts
import { applyMoveToFacelets } from '../../src/hooks/useCubeState'
import { SOLVED_FACELETS } from '../../src/types/cube'
```

Add at the end of the `describe('SliceMoveDetector', ...)` block:

```ts
  it('integration: L CCW + R CW emits M CW that correctly cycles middle column', () => {
    // Apply M CW to solved cube: U mid-col should get B mid-col (all B = 'B')
    // On a solved cube, B mid-col is ['B','B','B'], so U mid-col becomes ['B','B','B']
    let emittedMove: Move | null = null
    detector.on('move', (m) => { emittedMove = m })

    inner.emit('move', makeMove('L', 'CCW', 9000, 20))
    inner.emit('move', makeMove('R', 'CW', 9025, 21))

    expect(emittedMove).not.toBeNull()
    expect(emittedMove!.face).toBe('M')
    expect(emittedMove!.direction).toBe('CW')

    const result = applyMoveToFacelets(SOLVED_FACELETS, emittedMove!)
    // M CW on solved cube: U mid-col (indices 1,4,7) gets B mid-col reversed (B[52],B[49],B[46])
    // On solved cube all B stickers = 'B', so U[1,4,7] should all be 'B'
    expect(result[1]).toBe('B')
    expect(result[4]).toBe('B')
    expect(result[7]).toBe('B')
    // F mid-col (19,22,25) gets old U mid-col = 'U'
    expect(result[19]).toBe('U')
    expect(result[22]).toBe('U')
    expect(result[25]).toBe('U')
  })
```

- [ ] **Step 2: Run the full test suite**

```bash
npm run test -- tests/drivers/SliceMoveDetector.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/drivers/SliceMoveDetector.test.ts
git commit -m "test: add integration test for SliceMoveDetector → applyMoveToFacelets pipeline"
```

---

### Task 8: Wire `SliceMoveDetector` into `useCubeDriver`

**Files:**
- Modify: `src/hooks/useCubeDriver.ts`

- [ ] **Step 1: Import `SliceMoveDetector` and wrap `GanCubeDriver`**

In `src/hooks/useCubeDriver.ts`, add the import:

```ts
import { SliceMoveDetector } from '../drivers/SliceMoveDetector'
```

Change the `switchDriver` callback where `GanCubeDriver` is constructed (line ~31):

```ts
// before
const next = type === 'mouse' ? new MouseDriver() : new GanCubeDriver()

// after
const next = type === 'mouse' ? new MouseDriver() : new SliceMoveDetector(new GanCubeDriver())
```

The full updated `switchDriver` callback:

```ts
  const switchDriver = useCallback((type: DriverType) => {
    const old = driverRef.current
    old?.removeAllListeners()
    old?.disconnect()

    const next = type === 'mouse' ? new MouseDriver() : new SliceMoveDetector(new GanCubeDriver())
    next.on('connection', setStatus)
    driverRef.current = next
    setDriverType(type)
    setStatus('disconnected')
    setDriverVersion((v) => v + 1)
    if (type === 'mouse') next.connect()
  }, [])
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm run test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCubeDriver.ts
git commit -m "feat: wire SliceMoveDetector around GanCubeDriver in useCubeDriver"
```

---

### Task 9: Remove diagnostic `console.log` from `GanCubeDriver`

**Files:**
- Modify: `src/drivers/GanCubeDriver.ts:63`

- [ ] **Step 1: Remove the diagnostic log line**

In `src/drivers/GanCubeDriver.ts`, remove this line (currently line 63):

```ts
      console.log('[GAN-RAW]', JSON.stringify({ face: ganFaceIndex, dir: ganDir, cubeTimestamp, serial: move.serial, wallTime: Date.now() }))
```

The `_handleGanEvent` MOVE block should look like this after the removal:

```ts
    if (event.type === 'MOVE') {
      const ganFaceIndex = event.face as number
      const ganDir = event.direction as number
      const rawTs = event.cubeTimestamp as number | null
      const cubeTimestamp = rawTs != null ? rawTs : this._lastCubeTs + 50
      this._lastCubeTs = cubeTimestamp
      const move: Move = {
        face: GAN_FACE_MAP[ganFaceIndex],
        direction: ganDir === 0 ? 'CW' : 'CCW',
        cubeTimestamp,
        serial: event.serial as number,
      }
      this.emit('move', move)
    }
```

- [ ] **Step 2: Run all tests**

```bash
npm run test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/drivers/GanCubeDriver.ts
git commit -m "chore: remove diagnostic GAN-RAW console.log from GanCubeDriver"
```

---

## Self-Review

### Spec coverage

| Spec section | Task |
|---|---|
| `SliceFace`, `AnyFace`, `Move.face: AnyFace` | Task 1 |
| `SliceMoveDetector` middleware with buffering logic | Tasks 2–4 |
| 200ms wall-time safety timeout | Task 3 (case 5) |
| All 7 detection test cases | Task 3 |
| Integration test (detector → facelets) | Task 7 |
| `applyMoveToFacelets` M/E/S cases | Tasks 5–6 |
| M/E/S sticker cycle indices (verified against spec) | Task 6 |
| M CW inverted B mid-col noted | Task 6 comment |
| Wire in `useCubeDriver` | Task 8 |
| Remove `console.log` from `GanCubeDriver` | Task 9 |

All spec requirements covered.

### Placeholder scan

No TBD, TODO, or placeholder steps. All code blocks are complete and compilable.

### Type consistency

- `SliceFace` defined in Task 1, used in `SliceMoveDetector.tryPair` return type (Task 4) — consistent.
- `AnyFace` defined in Task 1, used as `Move.face` type — consistent.
- `cycle` alias (`const cycle = ccw ? cycle3CCW : cycle3CW`) already in `useCubeState.ts` — the M/E/S cases use it correctly (Task 6).
- `SliceMoveDetector` imported in `useCubeDriver` (Task 8) matches export in Task 4 — consistent.

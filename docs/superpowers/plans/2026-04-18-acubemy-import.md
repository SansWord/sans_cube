# Acubemy Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-way bulk importer that converts acubemy-exported JSON solves into `SolveRecord`s stored in sans_cube (localStorage or Firestore), preserving moves, timestamps, gyro data, and computed phases.

**Architecture:** Three-layer pipeline. (1) Pure TypeScript utilities under `src/utils/acubemyImport/` parse and validate each acubemy record independently. (2) A React modal (`AcubemyImportModal`) renders a preview table and commits on confirmation. (3) A single button in the `#debug` panel of `App.tsx` opens the modal. Slice-move pairing reuses `ColorMoveTranslator` (with a new public `flush()` for batch mode); phase detection reuses `computePhases`; solvability uses `isSolvedFacelets`; writing reuses the existing cloud/local storage paths (direct calls while TimerScreen is unmounted — state refresh happens when timer mode remounts).

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library. Existing conventions: Western color scheme (U=W, D=Y, F=G, B=Blue, L=O, R=Red), `schemaVersion: 2` records, `cubeTimestamp`-based moves.

**Spec:** [`docs/superpowers/specs/2026-04-18-acubemy-import-design.md`](../specs/2026-04-18-acubemy-import-design.md)

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `src/utils/acubemyImport/types.ts` | Internal types: `AcubemyRecord`, `PreviewRow`, `PreviewSummary`, `PreviewStatus`, `Warning` |
| `src/utils/acubemyImport/parseRawSolution.ts` | Tokenize `raw_solution`, map letters → `FaceletColor`, zip with `raw_timestamps` → `ColorMove[]` |
| `src/utils/acubemyImport/gyroMap.ts` | Validate and map `gyro_data` → `QuaternionSnapshot[]` |
| `src/utils/acubemyImport/verifySolvability.ts` | Apply scramble + `PositionMove[]` to `SOLVED_FACELETS`; validate scramble tokens; call `isSolvedFacelets` |
| `src/utils/acubemyImport/parseExport.ts` | Top-level orchestrator: validates file, per-record classification, returns `PreviewRow[]` + `PreviewSummary` |
| `src/components/AcubemyImportModal.tsx` | Modal UI: file picker, preview table, commit flow, writing overlay |
| `tests/utils/acubemyImport/parseRawSolution.test.ts` | Unit tests |
| `tests/utils/acubemyImport/gyroMap.test.ts` | Unit tests |
| `tests/utils/acubemyImport/verifySolvability.test.ts` | Unit tests |
| `tests/utils/acubemyImport/parseExport.test.ts` | Unit tests + dedup short-circuit |
| `tests/utils/acubemyImport/acubemyImport.golden.test.ts` | Golden fixture test on `acubemy_example.json` |
| `tests/components/AcubemyImportModal.test.tsx` | Component tests |
| `tests/fixtures/acubemy_example.json` | Copy of `data_input/example.json`, committed for golden test |
| `data_input/acubemy_test/1_invalid_json.json` … `13_happy_path.json` | Manual test files (uncommitted; gitignored) |
| `docs/import-data.md` | User guide + internal reference for the importer |

### Modified files

| File | Change |
|---|---|
| `src/types/solve.ts` | Add optional `importedFrom` field to `SolveRecord` |
| `src/drivers/ColorMoveTranslator.ts` | Add public `flush()` method for batch-import use |
| `src/App.tsx` | Add "Import from acubemy" button in debug panel; mount `AcubemyImportModal` |
| `docs/debug-mode.md` | Document the new button |
| `docs/ui-architecture.md` | Document `AcubemyImportModal` |
| `docs/storage.md` | Note `importedFrom` field on `SolveRecord` |
| `docs/devlog.md` | Add session entry + TL;DR line |
| `future.md` | Cross out completed acubemy-import item |
| `CLAUDE.md` | Add `docs/import-data.md` to Documentation list |
| `.gitignore` | Ignore `data_input/acubemy_test/` |

---

## Task 1: Add `importedFrom` field to `SolveRecord`

**Files:**
- Modify: `src/types/solve.ts`

- [ ] **Step 1: Add the field to the `SolveRecord` interface**

In `src/types/solve.ts`, inside `export interface SolveRecord { … }`, add after the `shareId?: string` line:

```ts
  importedFrom?: {
    source: 'acubemy'
    externalId: number | string
  }
```

- [ ] **Step 2: Type-check passes**

Run: `npm run build`
Expected: build succeeds (no existing call sites construct `SolveRecord` with `importedFrom`, so no breakage).

- [ ] **Step 3: Commit**

```bash
git add src/types/solve.ts
git commit -m "feat: add importedFrom field to SolveRecord schema"
```

---

## Task 2: Add `flush()` to `ColorMoveTranslator` for batch use

Batch import feeds all moves synchronously; the existing `FAST_WINDOW_MS` setTimeout never fires within a microtask, leaving the last move pending. Expose a public `flush()` so the importer can drain it after feeding the stream.

**Files:**
- Modify: `src/drivers/ColorMoveTranslator.ts`
- Test: `tests/drivers/ColorMoveTranslator.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/drivers/ColorMoveTranslator.test.ts` inside the main `describe('ColorMoveTranslator', …)` block:

```ts
it('flush() drains a pending single move synchronously', () => {
  inner.simulateMove('W', 'CW', 1000, 1)   // U CW as white
  expect(received).toHaveLength(0)          // still pending in fast-window
  translator.flush()
  expect(received).toHaveLength(1)
  expect(received[0].face).toBe('U')
  expect(received[0].direction).toBe('CW')
})

it('flush() with no pending is a no-op', () => {
  translator.flush()
  expect(received).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/drivers/ColorMoveTranslator.test.ts -- --run`
Expected: FAIL — `translator.flush is not a function`.

- [ ] **Step 3: Add `flush()` to `ColorMoveTranslator`**

In `src/drivers/ColorMoveTranslator.ts`, add a public method right after `syncFacelets`:

```ts
  /** Flush any pending single move (bypassing the fast-window timeout). For batch import. */
  flush(): void {
    this._flushPending()
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/drivers/ColorMoveTranslator.test.ts -- --run`
Expected: all tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/drivers/ColorMoveTranslator.ts tests/drivers/ColorMoveTranslator.test.ts
git commit -m "feat: expose ColorMoveTranslator.flush() for batch import"
```

---

## Task 3: Shared internal types for the importer

**Files:**
- Create: `src/utils/acubemyImport/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/utils/acubemyImport/types.ts
import type { SolveRecord } from '../../types/solve'

/** Shape of one record in an acubemy export (fields we read or probe). */
export interface AcubemyRecord {
  solve_id?: number
  date?: string
  scramble?: string
  raw_solution?: string
  raw_timestamps?: number[]
  analysis_type?: string
  gyro_data?: unknown
  // Unknown fields are allowed; we ignore them.
  [key: string]: unknown
}

export type PreviewStatus = 'new' | 'duplicate' | 'parse-error' | 'unsolved'

export type Warning = 'gyro-dropped'

export interface PreviewRow {
  index: number                 // 1-based row number in sorted-by-date order
  status: PreviewStatus
  reason?: string               // for parse-error / unsolved (first error only)
  warnings: Warning[]
  // Display hints — whatever we could extract, even on parse-error
  date?: number                 // Unix ms, if parseable
  method?: string               // resolved method id, e.g. 'cfop' | 'roux' | 'freeform'
  timeMs?: number
  moveCount?: number
  // Only present when status === 'new'
  draft?: SolveRecord
}

export interface PreviewSummary {
  rows: PreviewRow[]
  counts: {
    new: number
    duplicate: number
    parseError: number
    unsolved: number
    warnings: number            // count of rows with ≥1 warning
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/acubemyImport/types.ts
git commit -m "feat: add shared types for acubemy import pipeline"
```

---

## Task 4: `parseRawSolution` — tokenize moves and build `ColorMove[]`

Implements the letter-to-color map (Western scheme: U=W, D=Y, F=G, B=Blue, L=O, R=Red) and the token grammar (`[UDFBLR]` followed by optional `'`).

**Files:**
- Create: `src/utils/acubemyImport/parseRawSolution.ts`
- Test: `tests/utils/acubemyImport/parseRawSolution.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/utils/acubemyImport/parseRawSolution.test.ts
import { describe, it, expect } from 'vitest'
import { parseRawSolution } from '../../../src/utils/acubemyImport/parseRawSolution'

describe('parseRawSolution', () => {
  it('maps U/D/F/B/L/R to Western colors', () => {
    const moves = parseRawSolution('U D F B L R', [0, 10, 20, 30, 40, 50])
    expect(moves.map(m => m.face)).toEqual(['W', 'Y', 'G', 'B', 'O', 'R'])
    expect(moves.every(m => m.direction === 'CW')).toBe(true)
  })

  it("handles prime (CCW) tokens", () => {
    const moves = parseRawSolution("U' R'", [0, 10])
    expect(moves[0].direction).toBe('CCW')
    expect(moves[1].direction).toBe('CCW')
  })

  it('zips tokens with timestamps and assigns serial numbers', () => {
    const moves = parseRawSolution('U R', [0, 200])
    expect(moves[0].cubeTimestamp).toBe(0)
    expect(moves[1].cubeTimestamp).toBe(200)
    expect(moves[0].serial).toBe(0)
    expect(moves[1].serial).toBe(1)
  })

  it('throws on invalid token with position', () => {
    expect(() => parseRawSolution('U R Q L', [0, 10, 20, 30]))
      .toThrow(/Invalid token "Q" at position 2/)
  })

  it('rejects length mismatch between tokens and timestamps', () => {
    expect(() => parseRawSolution('U R L', [0, 10]))
      .toThrow(/raw_timestamps length \(2\) ≠ raw_solution length \(3\)/)
  })

  it('throws on empty raw_solution', () => {
    expect(() => parseRawSolution('', [])).toThrow(/empty/i)
  })

  it('tolerates extra whitespace between tokens', () => {
    const moves = parseRawSolution('  U   R  ', [0, 10])
    expect(moves).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/utils/acubemyImport/parseRawSolution.test.ts -- --run`
Expected: module-not-found failure.

- [ ] **Step 3: Implement `parseRawSolution`**

```ts
// src/utils/acubemyImport/parseRawSolution.ts
import type { ColorMove, FaceletColor } from '../../types/cube'

// Western color scheme used by acubemy (and our cube hardware).
const LETTER_TO_COLOR: Record<string, FaceletColor> = {
  U: 'W', D: 'Y', F: 'G', B: 'B', L: 'O', R: 'R',
}

/**
 * Parse acubemy's `raw_solution` + `raw_timestamps` into a `ColorMove[]`.
 * Throws on any malformed input so the caller can classify the record as parse-error.
 */
export function parseRawSolution(rawSolution: string, rawTimestamps: number[]): ColorMove[] {
  const tokens = rawSolution.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    throw new Error('raw_solution is empty')
  }
  if (rawTimestamps.length !== tokens.length) {
    throw new Error(`raw_timestamps length (${rawTimestamps.length}) ≠ raw_solution length (${tokens.length})`)
  }

  return tokens.map((token, i) => {
    const letter = token[0]
    const suffix = token.slice(1)
    const color = LETTER_TO_COLOR[letter]
    if (!color || (suffix !== '' && suffix !== "'")) {
      throw new Error(`Invalid token "${token}" at position ${i}`)
    }
    return {
      face: color,
      direction: suffix === "'" ? 'CCW' : 'CW',
      cubeTimestamp: rawTimestamps[i],
      serial: i,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- tests/utils/acubemyImport/parseRawSolution.test.ts -- --run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/acubemyImport/parseRawSolution.ts tests/utils/acubemyImport/parseRawSolution.test.ts
git commit -m "feat: add parseRawSolution for acubemy move stream"
```

---

## Task 5: `gyroMap` — acubemy `gyro_data` → `QuaternionSnapshot[]`

**Files:**
- Create: `src/utils/acubemyImport/gyroMap.ts`
- Test: `tests/utils/acubemyImport/gyroMap.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/utils/acubemyImport/gyroMap.test.ts
import { describe, it, expect } from 'vitest'
import { gyroMap } from '../../../src/utils/acubemyImport/gyroMap'

describe('gyroMap', () => {
  it('maps valid entries to QuaternionSnapshot', () => {
    const input = [
      { q: { w: 0.1, x: 0.2, y: 0.3, z: 0.4 }, t: 0 },
      { q: { w: 0.5, x: 0.6, y: 0.7, z: 0.8 }, t: 50 },
    ]
    expect(gyroMap(input)).toEqual([
      { quaternion: { x: 0.2, y: 0.3, z: 0.4, w: 0.1 }, relativeMs: 0 },
      { quaternion: { x: 0.6, y: 0.7, z: 0.8, w: 0.5 }, relativeMs: 50 },
    ])
  })

  it('returns null when input is missing', () => {
    expect(gyroMap(undefined)).toBeNull()
    expect(gyroMap(null)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(gyroMap([])).toBeNull()
  })

  it('returns null if any entry is malformed (non-finite number)', () => {
    const input = [
      { q: { w: 0.1, x: 0.2, y: 0.3, z: 0.4 }, t: 0 },
      { q: { w: NaN, x: 0.6, y: 0.7, z: 0.8 }, t: 50 },
    ]
    expect(gyroMap(input)).toBeNull()
  })

  it('returns null if any entry is missing q', () => {
    expect(gyroMap([{ t: 0 }])).toBeNull()
  })

  it('returns null if any entry is not an object', () => {
    expect(gyroMap(['not-an-object'])).toBeNull()
  })

  it('returns null if q.w / x / y / z fields are missing', () => {
    expect(gyroMap([{ q: { x: 0, y: 0, z: 0 }, t: 0 }])).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm run test -- tests/utils/acubemyImport/gyroMap.test.ts -- --run`
Expected: module-not-found.

- [ ] **Step 3: Implement `gyroMap`**

```ts
// src/utils/acubemyImport/gyroMap.ts
import type { QuaternionSnapshot } from '../../types/solve'

interface AcubemyGyroEntry {
  q: { w: number; x: number; y: number; z: number }
  t: number
}

function isValidEntry(e: unknown): e is AcubemyGyroEntry {
  if (typeof e !== 'object' || e === null) return false
  const obj = e as Record<string, unknown>
  if (typeof obj.t !== 'number' || !Number.isFinite(obj.t)) return false
  const q = obj.q
  if (typeof q !== 'object' || q === null) return false
  const qo = q as Record<string, unknown>
  for (const k of ['w', 'x', 'y', 'z']) {
    if (typeof qo[k] !== 'number' || !Number.isFinite(qo[k] as number)) return false
  }
  return true
}

/**
 * Map acubemy `gyro_data` to our `QuaternionSnapshot[]`.
 * Returns `null` if the input is missing, empty, or any entry fails validation.
 * Caller decides whether to emit a `gyro-dropped` warning.
 */
export function gyroMap(input: unknown): QuaternionSnapshot[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const valid = input.every(isValidEntry)
  if (!valid) return null
  return (input as AcubemyGyroEntry[]).map(e => ({
    quaternion: { x: e.q.x, y: e.q.y, z: e.q.z, w: e.q.w },
    relativeMs: e.t,
  }))
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm run test -- tests/utils/acubemyImport/gyroMap.test.ts -- --run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/acubemyImport/gyroMap.ts tests/utils/acubemyImport/gyroMap.test.ts
git commit -m "feat: add gyroMap for acubemy gyro_data conversion"
```

---

## Task 6: `verifySolvability` — apply scramble + moves and confirm solved

Wraps the scramble-then-solve simulation around `isSolvedFacelets`. Validates scramble tokens (existing `parseScramble` is lenient) and throws on unsupported notation so the caller can classify as `parse-error` rather than `unsolved`.

**Files:**
- Create: `src/utils/acubemyImport/verifySolvability.ts`
- Test: `tests/utils/acubemyImport/verifySolvability.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/utils/acubemyImport/verifySolvability.test.ts
import { describe, it, expect } from 'vitest'
import { verifySolvability } from '../../../src/utils/acubemyImport/verifySolvability'
import type { PositionMove } from '../../../src/types/cube'

function move(face: PositionMove['face'], direction: PositionMove['direction']): PositionMove {
  return { face, direction, cubeTimestamp: 0, serial: 0 }
}

describe('verifySolvability', () => {
  it('returns true when scramble is inverted by moves (R U followed by U\' R\')', () => {
    const moves: PositionMove[] = [move('U', 'CCW'), move('R', 'CCW')]
    expect(verifySolvability('R U', moves)).toBe(true)
  })

  it('returns false when final state is not solved', () => {
    const moves: PositionMove[] = [move('U', 'CCW')]  // misses R inverse
    expect(verifySolvability('R U', moves)).toBe(false)
  })

  it('returns false for scramble with no moves', () => {
    expect(verifySolvability('R U', [])).toBe(false)
  })

  it('supports double-turn scramble tokens', () => {
    const moves: PositionMove[] = [move('R', 'CW'), move('R', 'CW')]
    expect(verifySolvability('R2', moves)).toBe(true)
  })

  it('throws on unsupported scramble notation (e.g. wide move "Rw")', () => {
    expect(() => verifySolvability("Rw U", [])).toThrow(/Unsupported scramble token "Rw" at position 0/)
  })

  it('throws on rotation in scramble (e.g. "x")', () => {
    expect(() => verifySolvability('x U', [])).toThrow(/Unsupported scramble token "x" at position 0/)
  })
})
```

- [ ] **Step 2: Run — fail**

Run: `npm run test -- tests/utils/acubemyImport/verifySolvability.test.ts -- --run`
Expected: module-not-found.

- [ ] **Step 3: Implement `verifySolvability`**

```ts
// src/utils/acubemyImport/verifySolvability.ts
import { SOLVED_FACELETS } from '../../types/cube'
import { applyMoveToFacelets, isSolvedFacelets } from '../applyMove'
import { parseScramble } from '../scramble'
import type { PositionMove, Face } from '../../types/cube'

const OUTER_FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

/**
 * Simulate acubemy's scramble + our translated moves against a solved cube and
 * assert it ends solved. Throws on unsupported scramble notation so the caller
 * can classify the record as parse-error (not unsolved).
 */
export function verifySolvability(scramble: string, moves: PositionMove[]): boolean {
  // Pre-validate raw tokens — parseScramble is lenient and will silently
  // mis-parse things like "Rw" or "x" as a face.
  const rawTokens = scramble.trim().split(/\s+/).filter(Boolean)
  rawTokens.forEach((tok, i) => {
    if (tok.length === 0) return
    const face = tok[0]
    const suffix = tok.slice(1)
    if (!OUTER_FACES.includes(face as Face) || (suffix !== '' && suffix !== "'" && suffix !== '2')) {
      throw new Error(`Unsupported scramble token "${tok}" at position ${i}`)
    }
  })

  let f = SOLVED_FACELETS
  for (const step of parseScramble(scramble)) {
    const m: PositionMove = { face: step.face, direction: step.direction, cubeTimestamp: 0, serial: 0 }
    f = applyMoveToFacelets(f, m)
    if (step.double) f = applyMoveToFacelets(f, m)
  }
  for (const m of moves) {
    f = applyMoveToFacelets(f, m)
  }
  return isSolvedFacelets(f)
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm run test -- tests/utils/acubemyImport/verifySolvability.test.ts -- --run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/acubemyImport/verifySolvability.ts tests/utils/acubemyImport/verifySolvability.test.ts
git commit -m "feat: add verifySolvability for acubemy records"
```

---

## Task 7: `parseExport` — top-level orchestrator

Owns file-level validation, dedup-set construction, per-record classification, dedup short-circuit before move parsing, and the batch-mode `ColorMoveTranslator` wiring.

**Files:**
- Create: `src/utils/acubemyImport/parseExport.ts`
- Test: `tests/utils/acubemyImport/parseExport.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/utils/acubemyImport/parseExport.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseExport, __testing } from '../../../src/utils/acubemyImport/parseExport'
import type { SolveRecord } from '../../../src/types/solve'

// Minimal valid record — used as a starting point for most tests.
const BASE_RECORD = {
  solve_id: 100,
  date: '2026-04-18T10:09:22.202Z',
  scramble: 'R',
  raw_solution: "R'",
  raw_timestamps: [0],
  analysis_type: 'cfop',
}

function existing(externalId: number): SolveRecord {
  return {
    id: 1, seq: 1, schemaVersion: 2,
    scramble: 'x', timeMs: 0, moves: [], phases: [], date: 1,
    importedFrom: { source: 'acubemy', externalId },
  }
}

describe('parseExport — file-level errors', () => {
  it('returns file-level error when JSON is not an array', () => {
    const result = parseExport({}, [])
    expect(result.fileError).toMatch(/Expected a JSON array/)
  })

  it('returns file-level error when array is empty', () => {
    const result = parseExport([], [])
    expect(result.fileError).toMatch(/No solves found/)
  })

  it('returns file-level error when no record has acubemy fields', () => {
    const result = parseExport([{ foo: 1 }, { bar: 2 }], [])
    expect(result.fileError).toMatch(/doesn't look like an acubemy export/)
  })
})

describe('parseExport — per-record classification', () => {
  it('classifies a valid record as new', () => {
    const result = parseExport([BASE_RECORD], [])
    expect(result.summary?.rows[0].status).toBe('new')
    expect(result.summary?.counts.new).toBe(1)
  })

  it('classifies duplicate by externalId', () => {
    const result = parseExport([BASE_RECORD], [existing(100)])
    expect(result.summary?.rows[0].status).toBe('duplicate')
  })

  it('skips expensive parse work for duplicates', () => {
    const spy = vi.spyOn(__testing, 'parseRawSolution')
    parseExport([BASE_RECORD], [existing(100)])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('classifies missing raw_solution as parse-error', () => {
    const r = { ...BASE_RECORD, raw_solution: undefined }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('parse-error')
    expect(result.summary?.rows[0].reason).toMatch(/Missing field: raw_solution/)
  })

  it('classifies unknown analysis_type by mapping to freeform (not error)', () => {
    const r = { ...BASE_RECORD, analysis_type: 'yau' }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('new')
    expect(result.summary?.rows[0].method).toBe('freeform')
  })

  it('maps analysis_type case-insensitively (CFOP → cfop, Roux → roux)', () => {
    const r1 = { ...BASE_RECORD, analysis_type: 'CFOP', solve_id: 101 }
    const r2 = { ...BASE_RECORD, analysis_type: 'Roux', solve_id: 102 }
    const result = parseExport([r1, r2], [])
    expect(result.summary?.rows[0].method).toBe('cfop')
    expect(result.summary?.rows[1].method).toBe('roux')
  })

  it('classifies invalid date as parse-error', () => {
    const r = { ...BASE_RECORD, date: 'not-a-date' }
    const result = parseExport([r], [])
    expect(result.summary?.rows[0].status).toBe('parse-error')
    expect(result.summary?.rows[0].reason).toMatch(/date/i)
  })

  it('rows are sorted by date ascending', () => {
    const r1 = { ...BASE_RECORD, solve_id: 1, date: '2026-02-02T00:00:00Z' }
    const r2 = { ...BASE_RECORD, solve_id: 2, date: '2026-01-01T00:00:00Z' }
    const result = parseExport([r1, r2], [])
    expect(result.summary?.rows.map(r => r.index)).toEqual([1, 2])
    expect(result.summary?.rows[0].date).toBeLessThan(result.summary!.rows[1].date!)
  })
})
```

- [ ] **Step 2: Run — fail**

Run: `npm run test -- tests/utils/acubemyImport/parseExport.test.ts -- --run`
Expected: module-not-found.

- [ ] **Step 3: Implement `parseExport`**

```ts
// src/utils/acubemyImport/parseExport.ts
import type { SolveRecord } from '../../types/solve'
import type { PositionMove } from '../../types/cube'
import { ColorMoveTranslator } from '../../drivers/ColorMoveTranslator'
import { ColorCubeEventEmitter, type ColorCubeDriver } from '../../drivers/CubeDriver'
import { getMethod } from '../../methods'
import { computePhases } from '../recomputePhases'
import { parseRawSolution } from './parseRawSolution'
import { gyroMap } from './gyroMap'
import { verifySolvability } from './verifySolvability'
import type {
  AcubemyRecord, PreviewRow, PreviewSummary, Warning,
} from './types'

// Exported for test spying (dedup short-circuit test).
export const __testing = { parseRawSolution }

const ACUBEMY_REQUIRED_FIELDS: (keyof AcubemyRecord)[] = [
  'solve_id', 'date', 'scramble', 'raw_solution', 'raw_timestamps',
]

const KNOWN_METHODS: Record<string, string> = { cfop: 'cfop', roux: 'roux', freeform: 'freeform' }

function looksLikeAcubemyRecord(r: unknown): boolean {
  if (typeof r !== 'object' || r === null) return false
  const obj = r as Record<string, unknown>
  return 'solve_id' in obj && 'raw_solution' in obj
}

function mapMethod(analysisType: unknown): string {
  if (typeof analysisType !== 'string') return 'freeform'
  return KNOWN_METHODS[analysisType.toLowerCase()] ?? 'freeform'
}

// Run ColorMove[] through ColorMoveTranslator synchronously via a mock inner driver.
function translateColorMoves(colorMoves: ReturnType<typeof parseRawSolution>): PositionMove[] {
  class BatchInner extends ColorCubeEventEmitter implements ColorCubeDriver {
    async connect() {}
    async disconnect() {}
  }
  const inner = new BatchInner()
  const translator = new ColorMoveTranslator(inner)
  const out: PositionMove[] = []
  translator.on('move', (m) => out.push(m))
  translator.on('replacePreviousMove', (m) => { out.pop(); out.push(m) })
  for (const cm of colorMoves) inner.emit('move', cm)
  translator.flush()
  return out
}

export interface ParseExportResult {
  fileError?: string
  summary?: PreviewSummary
}

export function parseExport(parsed: unknown, existingSolves: SolveRecord[]): ParseExportResult {
  if (!Array.isArray(parsed)) {
    return { fileError: 'Expected a JSON array of solve records.' }
  }
  if (parsed.length === 0) {
    return { fileError: 'No solves found in file.' }
  }
  if (!parsed.some(looksLikeAcubemyRecord)) {
    return { fileError: "This doesn't look like an acubemy export." }
  }

  const dedup = new Set<string>()
  for (const s of existingSolves) {
    if (s.importedFrom?.source === 'acubemy') {
      dedup.add(`acubemy:${s.importedFrom.externalId}`)
    }
  }

  const rawRows = parsed as AcubemyRecord[]
  const rowsWithDate = rawRows.map((rec, i) => {
    const parsedDate = typeof rec.date === 'string' ? new Date(rec.date).getTime() : NaN
    return { rec, origIndex: i, parsedDate: Number.isFinite(parsedDate) ? parsedDate : undefined }
  })
  rowsWithDate.sort((a, b) =>
    (a.parsedDate ?? Number.MAX_SAFE_INTEGER) - (b.parsedDate ?? Number.MAX_SAFE_INTEGER)
  )

  const rows: PreviewRow[] = rowsWithDate.map(({ rec, parsedDate }, i) => {
    return classifyRecord(rec, i + 1, parsedDate, dedup)
  })

  const counts = {
    new: rows.filter(r => r.status === 'new').length,
    duplicate: rows.filter(r => r.status === 'duplicate').length,
    parseError: rows.filter(r => r.status === 'parse-error').length,
    unsolved: rows.filter(r => r.status === 'unsolved').length,
    warnings: rows.filter(r => r.warnings.length > 0).length,
  }
  return { summary: { rows, counts } }
}

function classifyRecord(
  rec: AcubemyRecord,
  index: number,
  parsedDate: number | undefined,
  dedup: Set<string>,
): PreviewRow {
  const warnings: Warning[] = []
  const displayMethod = mapMethod(rec.analysis_type)

  // Required-field presence.
  for (const field of ACUBEMY_REQUIRED_FIELDS) {
    if (rec[field] === undefined || rec[field] === null
        || (Array.isArray(rec[field]) && (rec[field] as unknown[]).length === 0)
        || (typeof rec[field] === 'string' && (rec[field] as string).length === 0)) {
      return { index, status: 'parse-error', reason: `Missing field: ${field}`, warnings, method: displayMethod, date: parsedDate }
    }
  }
  if (parsedDate === undefined) {
    return { index, status: 'parse-error', reason: `Invalid date: "${rec.date}"`, warnings, method: displayMethod }
  }

  // Dedup short-circuit — before expensive parsing.
  const externalId = rec.solve_id as number
  const key = `acubemy:${externalId}`
  if (dedup.has(key)) {
    return { index, status: 'duplicate', warnings, method: displayMethod, date: parsedDate }
  }

  // Parse moves.
  let colorMoves
  try {
    colorMoves = __testing.parseRawSolution(rec.raw_solution as string, rec.raw_timestamps as number[])
  } catch (e) {
    return { index, status: 'parse-error', reason: (e as Error).message, warnings, method: displayMethod, date: parsedDate }
  }

  const positionMoves = translateColorMoves(colorMoves)
  const timeMs = (rec.raw_timestamps as number[])[(rec.raw_timestamps as number[]).length - 1]

  // Solvability.
  let solved: boolean
  try {
    solved = verifySolvability(rec.scramble as string, positionMoves)
  } catch (e) {
    return { index, status: 'parse-error', reason: (e as Error).message, warnings, method: displayMethod, date: parsedDate, timeMs, moveCount: positionMoves.length }
  }
  if (!solved) {
    return { index, status: 'unsolved', reason: 'Final cube state not solved after applying scramble + moves.', warnings, method: displayMethod, date: parsedDate, timeMs, moveCount: positionMoves.length }
  }

  // Gyro mapping.
  const gyroPresent = rec.gyro_data !== undefined && rec.gyro_data !== null
  const quaternionSnapshots = gyroMap(rec.gyro_data) ?? undefined
  if (gyroPresent && !quaternionSnapshots) warnings.push('gyro-dropped')

  // Phases.
  const method = getMethod(displayMethod)
  const phases = computePhases(positionMoves, rec.scramble as string, method) ?? []

  const draft: SolveRecord = {
    id: 0,            // caller assigns
    schemaVersion: 2,
    scramble: rec.scramble as string,
    timeMs,
    moves: positionMoves,
    phases,
    date: parsedDate,
    method: displayMethod,
    quaternionSnapshots,
    importedFrom: { source: 'acubemy', externalId },
  }

  return { index, status: 'new', warnings, method: displayMethod, date: parsedDate, timeMs, moveCount: positionMoves.length, draft }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm run test -- tests/utils/acubemyImport/parseExport.test.ts -- --run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/acubemyImport/parseExport.ts tests/utils/acubemyImport/parseExport.test.ts
git commit -m "feat: add parseExport orchestrator for acubemy import"
```

---

## Task 8: Golden fixture test on `example.json`

Copies the committed acubemy sample into `tests/fixtures/` and asserts the pipeline produces exactly 2 importable `SolveRecord`s with the expected pinned shape.

**Files:**
- Create: `tests/fixtures/acubemy_example.json` (copy of `data_input/example.json`)
- Create: `tests/utils/acubemyImport/acubemyImport.golden.test.ts`

- [ ] **Step 1: Copy the fixture**

```bash
cp data_input/example.json tests/fixtures/acubemy_example.json
```

- [ ] **Step 2: Write the golden test**

```ts
// tests/utils/acubemyImport/acubemyImport.golden.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseExport } from '../../../src/utils/acubemyImport/parseExport'

describe('acubemy import — golden', () => {
  const json = JSON.parse(
    readFileSync(join(__dirname, '../../fixtures/acubemy_example.json'), 'utf-8')
  )

  it('imports the 2 records in example.json as new', () => {
    const result = parseExport(json, [])
    expect(result.fileError).toBeUndefined()
    expect(result.summary?.counts).toEqual(
      expect.objectContaining({ new: 2, duplicate: 0, parseError: 0, unsolved: 0 })
    )
  })

  it('CFOP record yields expected shape', () => {
    const result = parseExport(json, [])
    const cfop = result.summary!.rows.find(r => r.method === 'cfop')!
    expect(cfop.status).toBe('new')
    expect(cfop.draft?.schemaVersion).toBe(2)
    expect(cfop.draft?.method).toBe('cfop')
    expect(cfop.draft?.timeMs).toBe(28833)
    expect(cfop.draft?.moves.length).toBeGreaterThan(0)
    expect(cfop.draft?.phases.length).toBeGreaterThan(0)
    expect(cfop.draft?.importedFrom).toEqual({ source: 'acubemy', externalId: 388217 })
  })

  it('Roux record contains at least one slice move (M/E/S) — proves pairing worked', () => {
    const result = parseExport(json, [])
    const roux = result.summary!.rows.find(r => r.method === 'roux')!
    expect(roux.status).toBe('new')
    expect(roux.draft?.importedFrom?.externalId).toBe(376615)
    const sliceFaces = new Set(['M', 'E', 'S'])
    const hasSlice = roux.draft!.moves.some(m => sliceFaces.has(m.face as string))
    expect(hasSlice).toBe(true)
  })
})
```

- [ ] **Step 3: Run — expect pass**

Run: `npm run test -- tests/utils/acubemyImport/acubemyImport.golden.test.ts -- --run`
Expected: all 3 tests pass.

If the golden test fails, do NOT soften the assertions — investigate why the pipeline is producing different output than expected. Most likely causes: slice pairing didn't fire (check `flush()` in `translateColorMoves`), or method mapping is off.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/acubemy_example.json tests/utils/acubemyImport/acubemyImport.golden.test.ts
git commit -m "test: add golden fixture test for acubemy import"
```

---

## Task 9: `AcubemyImportModal` — file-picker initial state

Build the modal skeleton: a file `<input>`, a heading, a Cancel button, and a `target-storage label` at the top. No preview logic yet — just the initial state.

**Files:**
- Create: `src/components/AcubemyImportModal.tsx`
- Test: `tests/components/AcubemyImportModal.test.tsx`

- [ ] **Step 1: Write failing component tests**

```tsx
// tests/components/AcubemyImportModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AcubemyImportModal } from '../../src/components/AcubemyImportModal'

const noop = () => {}

describe('AcubemyImportModal — initial state', () => {
  it('renders file picker and help text', () => {
    render(
      <AcubemyImportModal
        open={true}
        onClose={noop}
        existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByText(/Select your acubemy JSON export/i)).toBeTruthy()
    expect(screen.getByLabelText(/Choose file/i)).toBeTruthy()
  })

  it('shows local storage label when cloud is disabled', () => {
    render(
      <AcubemyImportModal
        open={true}
        onClose={noop}
        existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByText(/Local browser storage/i)).toBeTruthy()
  })

  it('shows cloud label with email when cloud enabled', () => {
    render(
      <AcubemyImportModal
        open={true}
        onClose={noop}
        existingSolves={[]}
        cloudConfig={{ enabled: true, user: { email: 'a@b.com', uid: 'u1' } as any }}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByText(/Cloud \(Firestore\)/i)).toBeTruthy()
    expect(screen.getByText(/a@b.com/)).toBeTruthy()
  })

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(
      <AcubemyImportModal open={true} onClose={onClose} existingSolves={[]} cloudConfig={{ enabled: false, user: null }} onCommit={vi.fn()} />
    )
    fireEvent.click(screen.getByText(/Cancel/i))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npm run test -- tests/components/AcubemyImportModal.test.tsx -- --run`
Expected: module-not-found.

- [ ] **Step 3: Implement initial-state modal**

```tsx
// src/components/AcubemyImportModal.tsx
import { useState } from 'react'
import type { SolveRecord } from '../types/solve'
import type { CloudConfig } from '../hooks/useSolveHistory'
import type { PreviewSummary } from '../utils/acubemyImport/types'
import { parseExport } from '../utils/acubemyImport/parseExport'

type ModalState =
  | { kind: 'initial' }
  | { kind: 'parsed'; summary: PreviewSummary; openedWithCloud: boolean }
  | { kind: 'writing' }
  | { kind: 'error'; message: string }

export interface AcubemyImportModalProps {
  open: boolean
  onClose: () => void
  existingSolves: SolveRecord[]
  cloudConfig: CloudConfig
  onCommit: (newDrafts: SolveRecord[]) => Promise<void>
}

export function AcubemyImportModal({ open, onClose, existingSolves, cloudConfig, onCommit }: AcubemyImportModalProps) {
  const [state, setState] = useState<ModalState>({ kind: 'initial' })

  if (!open) return null

  const label = cloudConfig.enabled && cloudConfig.user
    ? `Will import to: Cloud (Firestore) ☁️ — logged in as ${cloudConfig.user.email}`
    : `Will import to: Local browser storage 💾 — sign in to import to cloud`

  const handleFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = parseExport(parsed, existingSolves)
      if (result.fileError) {
        setState({ kind: 'error', message: result.fileError })
        return
      }
      setState({
        kind: 'parsed',
        summary: result.summary!,
        openedWithCloud: !!(cloudConfig.enabled && cloudConfig.user),
      })
    } catch {
      setState({ kind: 'error', message: 'File is not valid JSON.' })
    }
  }

  return (
    <div role="dialog" aria-modal="true" style={modalStyle}>
      <div style={modalContent}>
        <h2>Import from acubemy</h2>
        <div style={{ marginBottom: 12, color: '#888', fontSize: 12 }}>{label}</div>

        {state.kind === 'initial' && (
          <>
            <p>Select your acubemy JSON export.</p>
            <label htmlFor="acubemy-file-input">Choose file</label>
            <input id="acubemy-file-input" type="file" accept=".json,application/json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </>
        )}

        {state.kind === 'error' && (
          <>
            <div role="alert" style={{ color: '#e74c3c' }}>{state.message}</div>
            <button onClick={() => setState({ kind: 'initial' })}>Try another file</button>
          </>
        )}

        {/* parsed / writing states added in later tasks */}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={state.kind === 'writing'}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const modalStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const modalContent: React.CSSProperties = {
  background: '#1a1a1a', color: '#ccc', padding: 20, borderRadius: 8,
  maxWidth: 900, width: '90%', maxHeight: '90vh', overflow: 'auto',
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm run test -- tests/components/AcubemyImportModal.test.tsx -- --run`
Expected: initial-state tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/AcubemyImportModal.tsx tests/components/AcubemyImportModal.test.tsx
git commit -m "feat: add AcubemyImportModal skeleton with file picker"
```

---

## Task 10: `AcubemyImportModal` — preview table

Render the parsed-state UI: status column with icons + tooltips, sorted-by-date rows, and the primary "Import N (skipping: …)" button.

**Files:**
- Modify: `src/components/AcubemyImportModal.tsx`
- Modify: `tests/components/AcubemyImportModal.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `tests/components/AcubemyImportModal.test.tsx`:

```tsx
import { parseExport } from '../../src/utils/acubemyImport/parseExport'

function renderWithParsed(summary: any) {
  const modal = render(
    <AcubemyImportModal open={true} onClose={() => {}} existingSolves={[]}
      cloudConfig={{ enabled: false, user: null }} onCommit={vi.fn()} />
  )
  // Simulate file-picker path by invoking parseExport directly is not possible —
  // use the "File.text()" flow.
  return modal
}

describe('AcubemyImportModal — parsed state', () => {
  it('shows import button with skip breakdown', async () => {
    const goodRecord = {
      solve_id: 1, date: '2026-04-18T10:09:22.202Z', scramble: 'R',
      raw_solution: "R'", raw_timestamps: [0], analysis_type: 'cfop',
    }
    const file = new File([JSON.stringify([goodRecord])], 'ex.json', { type: 'application/json' })
    const { container } = render(
      <AcubemyImportModal open={true} onClose={() => {}} existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }} onCommit={vi.fn()} />
    )
    const input = container.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await screen.findByRole('button', { name: /Import 1/i })
    expect(screen.getByText(/Import 1/)).toBeTruthy()
  })

  it('Import button disabled when 0 new rows', async () => {
    const file = new File(['[{"foo":1}]'], 'bad.json', { type: 'application/json' })
    // empty array → file-level error, so use a record that becomes a parse-error
    const badRecord = { solve_id: 1, date: '2026-04-18T10:09:22.202Z', scramble: 'R', raw_solution: '', raw_timestamps: [] }
    const f2 = new File([JSON.stringify([badRecord])], 'x.json', { type: 'application/json' })
    const { container } = render(
      <AcubemyImportModal open={true} onClose={() => {}} existingSolves={[]}
        cloudConfig={{ enabled: false, user: null }} onCommit={vi.fn()} />
    )
    const input = container.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [f2] })
    fireEvent.change(input)
    const btn = await screen.findByRole('button', { name: /Import 0/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npm run test -- tests/components/AcubemyImportModal.test.tsx -- --run`
Expected: the new tests fail.

- [ ] **Step 3: Implement parsed-state rendering**

Replace the `{/* parsed / writing states added in later tasks */}` comment in `AcubemyImportModal.tsx` with:

```tsx
{state.kind === 'parsed' && (
  <>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Date</th><th>Method</th><th>Time</th><th>Moves</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {state.summary.rows.map((row) => (
          <tr key={row.index}>
            <td>{row.index}</td>
            <td>{row.date ? new Date(row.date).toLocaleString() : '—'}</td>
            <td>{row.method ?? '—'}</td>
            <td>{row.timeMs !== undefined ? (row.timeMs / 1000).toFixed(2) + 's' : '—'}</td>
            <td>{row.moveCount ?? '—'}</td>
            <td title={row.reason || row.warnings.join(', ') || undefined}>
              {row.status === 'new' && '✅ new'}
              {row.status === 'duplicate' && '🔁 duplicate'}
              {row.status === 'parse-error' && '⚠️ parse-error'}
              {row.status === 'unsolved' && '❌ unsolved'}
              {row.warnings.length > 0 && ' ⚠️'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
)}
```

Then update the footer buttons: replace the existing footer `<div>` with one that also renders the Import button when `state.kind === 'parsed'`:

```tsx
<div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
  <button onClick={onClose} disabled={state.kind === 'writing'}>Cancel</button>
  {state.kind === 'parsed' && (() => {
    const c = state.summary.counts
    const warnClause = c.warnings > 0 ? `; ⚠️ ${c.warnings} with warnings` : ''
    const label = `Import ${c.new} (skipping: ${c.duplicate} duplicate, ${c.parseError} parse-error, ${c.unsolved} unsolved${warnClause})`
    return (
      <button
        disabled={c.new === 0}
        onClick={() => { /* commit added in Task 11 */ }}
      >{label}</button>
    )
  })()}
</div>
```

- [ ] **Step 4: Run — expect pass**

Run: `npm run test -- tests/components/AcubemyImportModal.test.tsx -- --run`
Expected: all modal tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/AcubemyImportModal.tsx tests/components/AcubemyImportModal.test.tsx
git commit -m "feat: render preview table in AcubemyImportModal"
```

---

## Task 11: `AcubemyImportModal` — commit path + writing overlay

Add the commit handler: re-check cloud target, show the non-dismissable writing overlay, call `onCommit(newDrafts)`, and close on success (with a brief toast or console log).

**Files:**
- Modify: `src/components/AcubemyImportModal.tsx`
- Modify: `tests/components/AcubemyImportModal.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to the existing test file:

```tsx
describe('AcubemyImportModal — commit', () => {
  const goodRecord = {
    solve_id: 42, date: '2026-04-18T10:09:22.202Z', scramble: 'R',
    raw_solution: "R'", raw_timestamps: [0], analysis_type: 'cfop',
  }

  async function openAndParse(onCommit: (drafts: any[]) => Promise<void>, cloudConfig = { enabled: false, user: null }) {
    const { container } = render(
      <AcubemyImportModal open={true} onClose={() => {}} existingSolves={[]}
        cloudConfig={cloudConfig as any} onCommit={onCommit} />
    )
    const file = new File([JSON.stringify([goodRecord])], 'ex.json', { type: 'application/json' })
    const input = container.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await screen.findByRole('button', { name: /Import 1/i })
  }

  it('calls onCommit with only the "new" drafts', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined)
    await openAndParse(onCommit)
    fireEvent.click(screen.getByRole('button', { name: /Import 1/i }))
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalled())
    const drafts = onCommit.mock.calls[0][0]
    expect(drafts).toHaveLength(1)
    expect(drafts[0].importedFrom).toEqual({ source: 'acubemy', externalId: 42 })
  })

  it('shows writing overlay during async commit', async () => {
    let resolve: () => void
    const pending = new Promise<void>(r => { resolve = r })
    const onCommit = vi.fn().mockReturnValue(pending)
    await openAndParse(onCommit)
    fireEvent.click(screen.getByRole('button', { name: /Import 1/i }))
    expect(screen.getByText(/Importing solves/i)).toBeTruthy()
    expect((screen.getByText(/Cancel/).closest('button') as HTMLButtonElement).disabled).toBe(true)
    resolve!()
    await vi.waitFor(() => expect(screen.queryByText(/Importing solves/i)).toBeNull())
  })
})
```

- [ ] **Step 2: Run — fail**

Run: `npm run test -- tests/components/AcubemyImportModal.test.tsx -- --run`
Expected: new tests fail.

- [ ] **Step 3: Wire the commit handler**

Inside `AcubemyImportModal`, replace the `onClick={() => { /* commit added in Task 11 */ }}` with:

```tsx
onClick={async () => {
  const drafts = state.summary.rows
    .filter(r => r.status === 'new' && r.draft)
    .map(r => r.draft!)
  const nowCloud = !!(cloudConfig.enabled && cloudConfig.user)
  // Spec §4: warn if the cloud target changed between open and commit.
  if (state.openedWithCloud && !nowCloud) {
    console.warn('Target changed to Local — proceeding with current setting.')
  }
  setState({ kind: 'writing' })
  try {
    await onCommit(drafts)
    window.alert(`Imported ${drafts.length} solves from acubemy.`)
    onClose()
  } catch (e) {
    setState({
      kind: 'error',
      message: `Import failed after ${drafts.length} solves. Any solves already written remain. (${(e as Error).message})`,
    })
  }
}}
```

(`window.alert` is the simplest success indicator — sans_cube has no toast system today. If one is added later, swap it in.)

Add the writing-state overlay (rendered when `state.kind === 'writing'`) near the top of the modal-body JSX, before the state-machine branches:

```tsx
{state.kind === 'writing' && (
  <div style={{ ...modalStyle, background: 'rgba(0,0,0,0.8)' }} role="status">
    <div style={{ color: '#fff' }}>Importing solves to {cloudConfig.enabled && cloudConfig.user ? 'cloud' : 'local storage'}…</div>
  </div>
)}
```

Also block `Escape` and backdrop clicks during writing — easy: our backdrop doesn't close currently. Just ensure Cancel is disabled (already is).

- [ ] **Step 4: Run — expect pass**

Run: `npm run test -- tests/components/AcubemyImportModal.test.tsx -- --run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/AcubemyImportModal.tsx tests/components/AcubemyImportModal.test.tsx
git commit -m "feat: add commit flow and writing overlay to AcubemyImportModal"
```

---

## Task 12: Wire the modal into `App.tsx` debug panel

Add the button, the modal mount, and the commit handler. The handler writes through the same primitives used by `handleDebugUpdate` (direct storage or Firestore calls) — it does **not** go through `useSolveHistory`, because that hook lives inside `TimerScreen` which is unmounted in debug mode. Relying on the existing "TimerScreen remounts → re-reads storage" behaviour (see `docs/ui-architecture.md`).

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/App.tsx`, add:

```ts
import { AcubemyImportModal } from './components/AcubemyImportModal'
import { addSolveToFirestore, loadSolvesFromFirestore, loadNextSeqFromFirestore, updateCounterInFirestore } from './services/firestoreSolves'
```

(`loadSolvesFromFirestore` is already imported — leave the existing import alone and only add the missing names.)

- [ ] **Step 2: Add state for the modal and the existing-solves list**

Near the other `useState` declarations in `App`:

```tsx
const [showAcubemyImport, setShowAcubemyImport] = useState(false)
const [existingSolvesForImport, setExistingSolvesForImport] = useState<SolveRecord[] | null>(null)
```

- [ ] **Step 3: Implement the commit handler**

Inside the component body:

```tsx
const handleAcubemyCommit = async (drafts: SolveRecord[]): Promise<void> => {
  // Re-read cloud state at commit time (spec §5).
  const useCloudNow = !!(cloudSync.enabled && cloudSync.user)
  const uid = cloudSync.user?.uid ?? null

  if (useCloudNow && uid) {
    const existing = await loadSolvesFromFirestore(uid)
    const usedDates = new Set(existing.map(s => s.date))
    const maxSeq = Math.max(0, ...existing.map(s => s.seq ?? 0))
    const counter = await loadNextSeqFromFirestore(uid)
    let nextSeq = Math.max(maxSeq + 1, counter)

    for (const draft of drafts) {
      let date = draft.date
      while (usedDates.has(date)) date += 1  // +1ms bump until unique
      usedDates.add(date)
      const record: SolveRecord = { ...draft, date, id: date, seq: nextSeq }
      nextSeq++
      await addSolveToFirestore(uid, record)
    }
    await updateCounterInFirestore(uid, nextSeq)
  } else {
    const existing = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
    const maxSeq = Math.max(0, ...existing.map(s => s.seq ?? 0))
    const storedCounter = parseInt(localStorage.getItem(STORAGE_KEYS.NEXT_ID) ?? '1', 10) || 1
    let nextSeq = Math.max(maxSeq + 1, storedCounter)
    let nextId = nextSeq
    const toWrite: SolveRecord[] = drafts.map(draft => {
      const record: SolveRecord = { ...draft, id: nextId, seq: nextSeq }
      nextId++; nextSeq++
      return record
    })
    saveToStorage(STORAGE_KEYS.SOLVES, [...existing, ...toWrite])
    localStorage.setItem(STORAGE_KEYS.NEXT_ID, String(nextSeq))
  }
}
```

- [ ] **Step 4: Add the debug-panel button**

In the maintenance buttons `<div>` (the one containing "Clear localStorage", "Restore example solves", etc. — around line 345), add:

```tsx
<button
  onClick={async () => {
    if (cloudSync.enabled && cloudSync.user) {
      setExistingSolvesForImport(await loadSolvesFromFirestore(cloudSync.user.uid))
    } else {
      setExistingSolvesForImport(loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, []))
    }
    setShowAcubemyImport(true)
  }}
  style={{ padding: '6px 14px', color: '#9b59b6', border: '1px solid #9b59b6', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}
>
  Import from acubemy
</button>
```

- [ ] **Step 5: Mount the modal**

Just before the closing `</>` of the debug-mode branch (after the `selectedDebugSolve` modal block), add:

```tsx
{showAcubemyImport && existingSolvesForImport !== null && (
  <AcubemyImportModal
    open={true}
    onClose={() => { setShowAcubemyImport(false); setExistingSolvesForImport(null) }}
    existingSolves={existingSolvesForImport}
    cloudConfig={cloudConfig}
    onCommit={handleAcubemyCommit}
  />
)}
```

- [ ] **Step 6: Type-check + existing tests still pass**

Run: `npm run build && npm run test -- --run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire AcubemyImportModal into debug mode"
```

---

## Task 13: Prepare manual test files in `data_input/acubemy_test/`

Per-spec §7. Each file is a single-record mutation of an `example.json` entry (or, for file-level tests, a stripped-down JSON). These are **not** committed — SansWord uses them to drag into the file picker for manual verification.

**Files:**
- Create: `data_input/acubemy_test/1_invalid_json.json` through `13_happy_path.json`
- Modify: `.gitignore` — add `data_input/acubemy_test/`

- [ ] **Step 1: Add `.gitignore` entry**

Append to `.gitignore`:

```
data_input/acubemy_test/
```

- [ ] **Step 2: Create the 13 manual test files**

Start from `data_input/example.json`. For each file below, create it with the exact content specified:

1. `1_invalid_json.json` — contents: `{ this is not valid json`
2. `2_not_array.json` — contents: `{}`
3. `3_empty_array.json` — contents: `[]`
4. `4_not_acubemy.json` — contents: `[{"foo": 1}, {"bar": 2}]`
5. `5_missing_field.json` — copy the first record from `example.json` into an array, then delete the `raw_solution` field.
6. `6_invalid_date.json` — copy first record; set `"date": "not-a-date"`.
7. `7_invalid_token.json` — copy first record; set `"raw_solution": "U R Q L"` and `"raw_timestamps": [0, 100, 200, 300]`; strip `gyro_data`.
8. `8_unsupported_scramble.json` — copy first record; set `"scramble": "Rw U R U' R' Rw'"`; strip `gyro_data`.
9. `9_unsolved.json` — copy first record; remove the last element of both `raw_solution` (last token) and `raw_timestamps` (last value).
10. `10_unknown_method.json` — copy first record; set `"analysis_type": "yau"`.
11. `11_malformed_gyro.json` — copy first record; replace the first `gyro_data` entry with `{ "q": { "w": "bad", "x": 0, "y": 0, "z": 0 }, "t": 0 }`.
12. `12_duplicates.json` — contents: same as `tests/fixtures/acubemy_example.json` (copy both records). Use after importing `13_happy_path.json` once.
13. `13_happy_path.json` — copy `tests/fixtures/acubemy_example.json` verbatim.

- [ ] **Step 3: Smoke-test locally by running `npm run dev`, opening `#debug`, clicking Import, and confirming each file produces the status in spec §7**

No commit verification — these files stay local. Verify manually:

| File | Expected |
|---|---|
| 1 | File-level: "File is not valid JSON." |
| 2 | File-level: "Expected a JSON array…" |
| 3 | "No solves found in file." |
| 4 | "This doesn't look like an acubemy export." |
| 5 | 1 row, `parse-error` / "Missing field: raw_solution" |
| 6 | 1 row, `parse-error` / date-parse reason |
| 7 | 1 row, `parse-error` / "Invalid token \"Q\" at position 2" |
| 8 | 1 row, `parse-error` / "Unsupported scramble token \"Rw\"…" |
| 9 | 1 row, `unsolved` |
| 10 | 1 row, `new`, method column = `freeform` |
| 11 | 1 row, `new`, ⚠️ warning, tooltip "Gyro data present but malformed…" |
| 12 | 2 rows, all `duplicate` (after importing 13 first) |
| 13 | 2 rows, all `new`, no warnings |

- [ ] **Step 4: Commit the .gitignore change**

```bash
git add .gitignore
git commit -m "chore: ignore data_input/acubemy_test/ manual test files"
```

---

## Task 14: Add `docs/import-data.md`

Per spec §8. User guide first, internal reference second.

**Files:**
- Create: `docs/import-data.md`

- [ ] **Step 1: Write the document**

Use the structure below. Fill each section from spec §8 verbatim where the spec quotes text; otherwise write prose consistent with other docs in `docs/`.

```markdown
# Importing data from other sources

A guide to bulk-importing past solve history from external sources into sans_cube.

## User guide

### What the importer does

[One paragraph: reads acubemy JSON, produces SolveRecord entries, preserves moves/timestamps/gyro, computes phases locally.]

### How to use it

1. Open the app and switch to debug mode via the [debug] button in the connection bar, or load `#debug` directly.
2. In the maintenance toolbar at the bottom, click **Import from acubemy**.
3. Select your acubemy JSON export.
4. Review the preview table — each row shows date, method, time, moves, and status.
5. Read the "Will import to: …" label to confirm target storage (Cloud vs. Local). Sign in via the Firebase panel if you want to import to cloud.
6. Click **Import N (…)** to commit.

### Status icons

- ✅ new — will be imported
- 🔁 duplicate — already in store (by acubemy solve_id); skipped
- ⚠️ parse-error — a required field was missing or malformed; skipped. Hover for reason.
- ❌ unsolved — moves don't finish solved; skipped. Hover for reason.
- ⚠️ (next to new) — warning; will import but something was dropped. Hover for reason.

### Warnings

- **gyro-dropped** — gyro data was present but malformed. The solve imports without replay gyro data; the 3D cube will still play back moves correctly but won't track hand orientation.

### Known caveats

- Imported solves land at the end of the `seq` counter even though their dates are historical. This causes a backward time-jump in the Trends chart (shown by date ascending). Sort-by-seq is unaffected.
- The v1 UI does not badge imported solves visually — they look like native solves in the history list. A badge is planned (see `future.md`).
- Re-importing the same export skips duplicates. There is no "update existing" flow in v1 (see `future.md`).

## Sources

_The sections below are internal reference for maintainers describing each external source's export format and our field-mapping decisions. Safe to skip if you only want to use the importer._

### Acubemy

#### Reference: export format

[Copy the bulleted field list from spec §8 verbatim: solve_id, date, scramble, total_time, raw_solution, raw_timestamps, solution, analysis_type, gyro_data, cross_*/f2l_pair*/oll_*/pll_*, other fields.]

#### Our field mapping

| Acubemy field | sans_cube destination | Notes |
|---|---|---|
| `solve_id` | `importedFrom.externalId` | dedup key |
| `date` | `SolveRecord.date` | ISO 8601 → Unix ms |
| `scramble` | `SolveRecord.scramble` | stored verbatim |
| `total_time` | — ignored | derived from `raw_timestamps[last]` |
| `raw_solution` + `raw_timestamps` | `SolveRecord.moves` | via `ColorMoveTranslator` |
| `solution` | — ignored | we run our own translator |
| `analysis_type` | `SolveRecord.method` | unknown → `freeform` |
| `gyro_data` | `SolveRecord.quaternionSnapshots` | `q.{w,x,y,z}, t` → `{quaternion, relativeMs}` |
| `cross_*`, `f2l_*`, `oll_*`, `pll_*` | — ignored | we compute phases via `computePhases` |
| any other field | — unknown / unexplored | |

#### Verified semantics

- `date` = completion time (confirmed against acubemy UI).
- `raw_timestamps[0] = 0`; `raw_timestamps[last] = total_time`.
- `gyro_data[*].t` = ms since first move, same frame as `raw_timestamps`.
- Color scheme = Western (U=W, D=Y, F=G, B=Blue, L=O, R=Red).
- Gyro sample rate ≈ 22 Hz from hardware; acubemy records all samples (no throttle).
- Quaternion reference frame assumed to match sans_cube's raw sensor frame. Empirical verification is tracked as a follow-up item in `future.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/import-data.md
git commit -m "docs: add import-data.md covering user guide and acubemy reference"
```

---

## Task 15: Update existing docs + CLAUDE.md

**Files:**
- Modify: `docs/debug-mode.md`
- Modify: `docs/ui-architecture.md`
- Modify: `docs/storage.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `docs/debug-mode.md`**

Under the "Maintenance buttons (bottom toolbar)" section, add:

```markdown
- **Import from acubemy** — opens the `AcubemyImportModal` to bulk-import acubemy JSON exports. See `docs/import-data.md` for the full flow.
```

- [ ] **Step 2: `docs/ui-architecture.md`**

In the debug-mode section of the Component Tree block (near `SolveDetailModal`), add:

```
│   ├── AcubemyImportModal      ← overlay when "Import from acubemy" is clicked
```

Add a leaf-component prop table entry for `AcubemyImportModal` following the same style as other modals in the doc:

```markdown
### `AcubemyImportModal` (`src/components/AcubemyImportModal.tsx`)

| Prop | Description |
|---|---|
| `open` | Whether the modal is visible |
| `onClose` | Close handler |
| `existingSolves` | Current solve list (for dedup + max-seq calculation) |
| `cloudConfig` | `CloudConfig` at modal-open time; target is re-checked at commit |
| `onCommit` | `(drafts: SolveRecord[]) => Promise<void>` — writes the new drafts via the parent's storage path |
```

- [ ] **Step 3: `docs/storage.md`**

In the `SolveRecord` structure section, add `importedFrom` with a note:

```markdown
- `importedFrom?: { source: 'acubemy', externalId: number | string }` — set when a solve was imported from an external source. Used as a `(source, externalId)` dedup key and (in v1) not shown in the UI.
```

- [ ] **Step 4: `CLAUDE.md`**

In the Documentation list, add (alphabetically or at a sensible location):

```markdown
- [`import-data.md`](docs/import-data.md) — user guide + internal reference for bulk-importing solves from external sources (acubemy in v1)
```

- [ ] **Step 5: Commit**

```bash
git add docs/debug-mode.md docs/ui-architecture.md docs/storage.md CLAUDE.md
git commit -m "docs: document acubemy importer across existing docs"
```

---

## Task 16: Update `future.md` + `docs/devlog.md`

**Files:**
- Modify: `future.md`
- Modify: `docs/devlog.md`

- [ ] **Step 1: Strike out the completed acubemy-import item in `future.md`**

Find the line describing the acubemy import feature and wrap it in `~~…~~` with a trailing ` — v1.??.0` version tag consistent with other done items. (The exact version number is TBD — pick the next semver slot after the latest devlog entry.)

- [ ] **Step 2: Add two new items to `future.md` under a sensible heading**

```markdown
- **Sort-by-timestamp toggle in Trends** — normalize the backward time-jump in the chart after an import by offering a sort mode that orders by cubeTimestamp instead of solve seq.

- **Re-import / update for records with warning state** — currently `gyro-dropped` rows import without gyro data and stay that way. Allow re-running import on a fresh export to recover dropped fields. Needs design: overwrite vs merge vs diff.
```

- [ ] **Step 3: Add `docs/devlog.md` entry**

At the top of the version list (newest first), add:

```markdown
## v1.??.0 — acubemy import (YYYY-MM-DD HH:MM)

**Review:** not yet

**Design docs:**
- Acubemy Import: [Spec](superpowers/specs/2026-04-18-acubemy-import-design.md) [Plan](superpowers/plans/2026-04-18-acubemy-import.md)

**What was built:**
- `importedFrom` field on `SolveRecord` (source + externalId)
- `src/utils/acubemyImport/` — `parseRawSolution`, `gyroMap`, `verifySolvability`, `parseExport`
- `ColorMoveTranslator.flush()` for batch-mode slice pairing
- `AcubemyImportModal` with preview table, dedup, commit with writing overlay
- Debug-mode "Import from acubemy" button wired into `App.tsx`
- 13-file manual test pack in `data_input/acubemy_test/` (gitignored)
- `docs/import-data.md` user guide + acubemy format reference

**Key technical learnings:**
- `[insight]` ColorMoveTranslator's wall-time `FAST_WINDOW_MS` setTimeout blocks batch use — exposing `flush()` decouples fast-window semantics from the event-driven live path without changing live behaviour.
- `[note]` `parseScramble` is lenient (accepts any first letter as a face); importer-side validation must reject wide moves, rotations, and unknown tokens explicitly to keep `unsolved` distinct from `parse-error`.
- `[gotcha]` Firestore doc ID is `String(solve.date)` — cloud-mode imports with historical dates must bump by +1ms on collision or they'll overwrite existing docs.

**Process learnings:**
- `[note]` Dedup short-circuit before expensive parsing keeps re-imports fast; spy-based test confirms the optimization.
```

Also add the TL;DR table row at the top:

```markdown
| [v1.??.0](#v1??0--acubemy-import-YYYY-MM-DD-HHMM) | Bulk import from acubemy JSON with dedup, preview, and warnings |
```

(Replace `v1.??.0` with the actual version picked.)

- [ ] **Step 4: Commit**

```bash
git add future.md docs/devlog.md
git commit -m "docs: devlog + future.md entries for acubemy import"
```

---

## Task 17: Final verification

- [ ] **Step 1: All tests pass**

Run: `npm run test -- --run`
Expected: all tests pass, including new ones.

- [ ] **Step 2: Type-check + build**

Run: `npm run build`
Expected: success, no TypeScript errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Open the app, navigate to `#debug`, click **Import from acubemy**, select `data_input/example.json`. Confirm preview table shows 2 rows as `new`. Click import. Switch to timer mode. Confirm the 2 imported solves appear in the history. Click one and confirm the 3D replay plays correctly.

If the replay is broken: investigate the move stream (check the first few moves of the imported `moves` array against `raw_solution`; likely the color→face mapping or pairing has an error). Do not mark complete until replay works.

- [ ] **Step 5: Cross-reference**

Open the spec (`docs/superpowers/specs/2026-04-18-acubemy-import-design.md`) and confirm every section has been addressed. Walk through §3 Import Pipeline step-by-step against the code in `parseExport.ts` to confirm nothing was dropped.

# Phase 3 — Correct M/E/S + Center Tracking: Design Spec

**Status:** Draft — awaiting user review  
**Date:** 2026-04-15  
**Scope:** Implementation changes only. Data migration is a separate phase, planned below but not implemented alongside the code changes.

---

## Background

`sans_cube` tracks cube state as a 54-character color-letter facelets string (Kociemba format). Phases 1 and 2 renamed the characters from face-position letters to color letters and fixed `isSolvedFacelets`. Phase 3 is the breaking change: correct M/E/S slice move behavior and fix the GAN driver's face-index translation so center drift is tracked accurately.

**The core problem:**

1. `applyMoveToFacelets` currently approximates M as L+R, E as D+U, S as F+B. This rotates the outer face stickers but does not move U/F/D/B center stickers along the middle layer — leaving `FaceletDebug` wrong after any slice move.

2. `GanCubeDriver` maps GAN face indices using a fixed map (`face 0 (white center) → geometric 'U'`, always). GAN events are color-based — face 0 means "the face whose center is white". After M, white center moves from U to F; GAN still sends face 0, but the fixed map still emits geometric 'U' — wrong. The driver's fixed map produces wrong face labels for all moves after any M/E/S.

---

## Part 1 — Implementation

### 1a. Extract and fix `applyMoveToFacelets`

**New file:** `src/utils/applyMove.ts`

Move `applyMoveToFacelets` and `isSolvedFacelets` out of `src/hooks/useCubeState.ts` into this new pure-utility module. They have no hook dependencies and are needed by both hook code and the new driver layer.

Update import paths in:
- `src/hooks/useCubeState.ts`
- `src/utils/recomputePhases.ts`

Replace the three recursive approximations with direct middle-layer cycles. The cycle primitive `cycle3CW(f, a0,a1,a2, b0,b1,b2, c0,c1,c2, d0,d1,d2)` moves content `a→b→c→d→a`. `cycle3CCW` is the reverse.

**Face index reference (54-char string):**
```
U: 0-8    R: 9-17    F: 18-26    D: 27-35    L: 36-44    B: 45-53

Each face (row-major, 0=top-left):
  0 1 2
  3 4 5
  6 7 8

Centers: U=4, R=13, F=22, D=31, L=40, B=49
```

**Unfolded net with all indices:**
```
                  U
             ┌────┬────┬────┐
             │  0 │  1 │  2 │
             ├────┼────┼────┤
             │  3 │  4 │  5 │
             ├────┼────┼────┤
             │  6 │  7 │  8 │
             └────┴────┴────┘
L                 F                 R                 B (stored looking from behind)
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ 36 │ 37 │ 38 │ 18 │ 19 │ 20 │  9 │ 10 │ 11 │ 45 │ 46 │ 47 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ 39 │ 40 │ 41 │ 21 │ 22 │ 23 │ 12 │ 13 │ 14 │ 48 │ 49 │ 50 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ 42 │ 43 │ 44 │ 24 │ 25 │ 26 │ 15 │ 16 │ 17 │ 51 │ 52 │ 53 │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
                  D
             ┌────┬────┬────┐
             │ 27 │ 28 │ 29 │
             ├────┼────┼────┤
             │ 30 │ 31 │ 32 │
             ├────┼────┼────┤
             │ 33 │ 34 │ 35 │
             └────┴────┴────┘
```

**Corrected M/E/S cases:**

```ts
case 'M':
  // Middle col between L and R, L direction. U→F→D→B(rev)→U
  // B reversed: stored looking from behind, so top↔bottom inverts along this axis.
  cycle(f, 1, 4, 7,  19, 22, 25,  28, 31, 34,  52, 49, 46)
  break

case 'E':
  // Middle row between U and D, D direction. F→R→B→L→F
  cycle(f, 21, 22, 23,  12, 13, 14,  48, 49, 50,  39, 40, 41)
  break

case 'S':
  // Middle layer between F and B, F direction. U(row)→R(col)→D(row,rev)→L(col,rev)→U
  cycle(f, 3, 4, 5,  10, 13, 16,  32, 31, 30,  43, 40, 37)
  break
```

`isSolvedFacelets` already uses the monochromatic center-match check from Phase 1 — no changes needed.

---

### 1b. Type system: `TypedEventEmitter<TMap>`

**Problem:** `CubeEventEmitter` is hardcoded to `EventMap` where `move: Move` and `Move.face: AnyFace`. `GanCubeDriver` needs to emit color-based moves (`face: FaceletColor`), which is a different type. We need the type system to enforce the distinction.

**Solution:** Make the event emitter generic.

In `src/drivers/CubeDriver.ts`:

```ts
// Generic base — all event emitter logic parameterized over TMap
class TypedEventEmitter<TEventMap extends Record<string, unknown>> {
  // identical on/off/emit/removeAllListeners implementation, but typed over TEventMap
}

// Backward-compat alias — all existing code unchanged
export class CubeEventEmitter extends TypedEventEmitter<EventMap> {}

// New color-based variant — uses MoveEventMap to avoid duplication
export type ColorEventMap = MoveEventMap<ColorMove>
export class ColorCubeEventEmitter extends TypedEventEmitter<ColorEventMap> {}

// New interface for color-based drivers
export interface ColorCubeDriver extends ColorCubeEventEmitter {
  connect(): Promise<void>
  disconnect(): Promise<void>
}
```

New and updated types in `src/types/cube.ts`:

```ts
// Generic base — single source of truth for all move fields
export interface MoveOf<TFace> {
  face: TFace
  direction: Direction
  cubeTimestamp: number
  serial: number
  quaternion?: Quaternion
}

// Rename AnyFace → PositionalFace (only 2 files affected: cube.ts, CubeRenderer.ts)
export type PositionalFace = Face | SliceFace | RotationFace

// New canonical name for position-based moves — used in all new code
export type PositionMove = MoveOf<PositionalFace>

// Backward-compat alias — all existing code keeps working unchanged
export type Move = PositionMove

// Color-based move — emitted by GanCubeDriver before translation
export type ColorMove = MoveOf<FaceletColor>
```

`MoveEventMap` extracted to remove duplication between `EventMap` and `ColorEventMap` (in `CubeDriver.ts`):

```ts
type MoveEventMap<TMove> = {
  move: TMove
  replacePreviousMove: TMove
  gyro: Quaternion
  connection: ConnectionStatus
  battery: number
}

export type EventMap      = MoveEventMap<PositionMove>  // was MoveEventMap<Move> — same type
export type ColorEventMap = MoveEventMap<ColorMove>
```

**Why `ColorMove` instead of reusing `Move`/`PositionMove`:** `FaceletColor` and `AnyFace` share the strings `'R'` and `'B'`. After E moves, the red center drifts to a different geometric face — so `'R'` as a color label no longer means geometric R. A distinct type prevents accidental misuse and makes the compiler enforce the boundary.

Nothing outside `GanCubeDriver` and `ColorMoveTranslator` touches these new types. All existing code using `CubeEventEmitter` and `CubeDriver` is unaffected.

---

### 1c. `GanCubeDriver` — emit color-based moves

Two changes only:

```ts
// Before
const GAN_FACE_MAP: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']
export class GanCubeDriver extends CubeEventEmitter implements CubeDriver

// After
const GAN_COLOR_MAP: FaceletColor[] = ['W', 'R', 'G', 'Y', 'O', 'B']
export class GanCubeDriver extends ColorCubeEventEmitter implements ColorCubeDriver
```

The emitted `move` field changes from `GAN_FACE_MAP[ganFaceIndex]` to `GAN_COLOR_MAP[ganFaceIndex]`, producing a `ColorMove`.

Everything else is unchanged: BLE connection, MAC address handling, battery polling, `_simulateGanMove`, gyro/disconnect handling.

---

### 1d. `SliceMoveDetector` → `ColorMoveTranslator`

**Rename:** `src/drivers/SliceMoveDetector.ts` → `src/drivers/ColorMoveTranslator.ts`  
**Class rename:** `SliceMoveDetector` → `ColorMoveTranslator`

**Constructor change:** from `CubeDriver` to `ColorCubeDriver` — type-safe, cannot accidentally wrap a position-based driver.

**Why translation and pairing must be in the same layer:**  
Translation (color→geometric) requires knowing where centers are. Center positions change after M/E/S. Detecting M/E/S requires pairing L+R, U+D, or F+B geometric events. These two concerns are inherently coupled — you cannot translate without knowing M happened, and you cannot detect M without translating first. Combining them here is the only place in the chain with full knowledge of both.

**Two additions to the existing class:**

**1. Center lookup** (runs once per incoming `ColorMove`, before pairing):
```ts
private _facelets = SOLVED_FACELETS
private readonly CENTERS = [4, 13, 22, 31, 40, 49]
private readonly FACES: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

private _geometricFace(color: FaceletColor): Face {
  const i = this.CENTERS.findIndex(pos => this._facelets[pos] === color)
  return this.FACES[i]
}
```

**2. Facelets update** (after each emitted move — M/E/S or individual):
```ts
this._facelets = applyMoveToFacelets(this._facelets, emittedMove)
```

**`_onMove` flow:**
1. Receive `ColorMove` from `GanCubeDriver`
2. Translate `color → geometricFace` via `_geometricFace`
3. Build a `Move` with the translated face
4. Pass into existing pairing logic (fast-window, retroactive replacement — all unchanged)
5. After emitting any move (slice or individual), update `_facelets`

The pairing logic, timing windows, and `replacePreviousMove` emission are entirely unchanged.

**`useCubeDriver.ts` update:**
```ts
// Before
new SliceMoveDetector(new GanCubeDriver())
// After
new ColorMoveTranslator(new GanCubeDriver())
```

---

### 1e. `recomputePhases` — extract shared helper

Extract an internal helper so the migration function (Part 2) can compute phases from corrected moves without calling `recomputePhases` (which is scoped to method-switching).

```ts
// Internal — not exported. Used by both recomputePhases and migrateSolveV1toV2.
function computePhases(
  moves: Move[],
  scramble: string,
  method: SolveMethod
): PhaseRecord[] | null

// Public export — unchanged signature, purpose, and behavior
export function recomputePhases(solve: SolveRecord, newMethod: SolveMethod): PhaseRecord[] | null {
  return computePhases(solve.moves, solve.scramble, newMethod)
}
```

`recomputePhases` remains the method-switching utility only. The extraction is a pure refactor with no behavior change.

---

### 1f. Tests

**Existing CFOP fixtures:** unaffected — no M/E/S moves, face labels identical in v1 and v2.

**Existing M/E/S unit tests** (`tests/hooks/useCubeState.test.ts`, later `applyMove.test.ts`): the describe blocks for M, E, S currently assert the old approximation behavior (e.g. `'M CW from solved: full state matches L CCW then R CW'`). These will break and must be updated:
- Delete or rewrite the full-string snapshot tests with correct expected values derived from the new direct cycles.
- Delete the stale comments at the top of the M/E/S section that describe the old L+R/D+U/F+B approximation.
- Round-trip tests (`M CW then M CCW returns to solved`) are still valid — keep them.

**New fixture:** add one Roux solve with M moves to `tests/fixtures/solveFixtures.ts` covering LSE. This verifies:
- The corrected M cycle produces correct facelets at each step
- `recomputePhases` detects Roux phases correctly after the fix

**`ColorMoveTranslator` unit tests** — one sequence per slice move, all starting from solved state.

Each test: send a color-based pair (fast), then a follow-up color event after the window. Assert the emitted geometric moves.

Notation: GAN sends color labels (W=white, R=red, G=green, Y=yellow, O=orange, B=blue).

| Slice | GAN pair (fast) | Detected | Center change | Follow-up GAN → expected geometric |
|-------|----------------|----------|---------------|-------------------------------------|
| M CW  | O CCW + R CW  | M CW     | blue → U      | B → U  |
| M CCW | O CW + R CCW  | M CCW    | green → U     | G → U  |
| E CW  | Y CCW + W CW  | E CW     | green → R     | G → R  |
| E CCW | Y CW + W CCW  | E CCW    | blue → R      | B → R  |
| S CW  | G CCW + B CW  | S CW     | orange → U    | O → U  |
| S CCW | G CW + B CCW  | S CCW    | red → U       | R → U  |

**Direction convention** (matches existing pairing logic and `applyMoveToFacelets`):
- M CW = L CCW + R CW; M CCW = L CW + R CCW
- E CW = D CCW + U CW; E CCW = D CW + U CCW
- S CW = F CCW + B CW; S CCW = F CW + B CCW

**`applyMoveToFacelets` correctness tests** — combining a slice with its two outer faces in the same direction equals a whole-cube rotation. These tests would pass with identity (solved) under the old L+R/D+U/F+B approximation, so they catch the old bug directly.

| Sequence | Must equal |
|----------|-----------|
| L CW + M CW + R CCW | x CCW |
| L CCW + M CCW + R CW | x CW |
| D CW + E CW + U CCW | y CCW |
| D CCW + E CCW + U CW | y CW |
| F CW + S CW + B CCW | z CW |
| F CCW + S CCW + B CW | z CCW |

Assert by applying both sequences from solved state and checking facelets are identical.

**Slice composition identities** — these test that M, S, E interact correctly with each other. Both return to solved state.

| Sequence | Expected | What it tests |
|----------|----------|---------------|
| M2 S2 E2 M2 S2 E2 | solved | slice moves compose correctly with each other |
| (M S E) × 4 | solved | slice moves compose correctly with each other |
| (M2 U2) × 4 | solved | slice move interacts correctly with outer face move |

Assert `isSolvedFacelets` after each sequence applied from solved state.

---

## Part 2 — Data Migration (separate phase)

Implemented and tested after Part 1 is stable. No migration code ships with the implementation changes.

---

### 2a. Schema additions to `SolveRecord`

```ts
export interface SolveRecord {
  // existing fields unchanged...
  schemaVersion?: number  // already present: absent/1 = v1, 2 = v2
  movesV1?: Move[]        // NEW: original pre-migration moves, present only on
                          // Firestore-migrated records awaiting user review.
                          // Deleted once user marks the record as reviewed.
                          // Absent on localStorage-migrated records and all new records.
}
```

`movesV1` presence is the sole indicator that a record needs review — no separate flag needed.

---

### 2b. `migrateSolveV1toV2`

**New file:** `src/utils/migrateSolveV1toV2.ts`

```ts
function migrateSolveV1toV2(solve: SolveRecord): SolveRecord
```

**Fast path** — no M/E/S in moves: centers never drifted, all face labels correct, stored phases correct. Return immediately with only the version bump:

```ts
if (!solve.moves.some(m => m.face === 'M' || m.face === 'E' || m.face === 'S')) {
  return { ...solve, schemaVersion: 2 }
}
```

**Full path** — M/E/S present:

1. **Correct face labels.** Simulate cube state from solved. Apply the same color-lookup approach for **all** moves — U/R/F/D/L/B and M/E/S alike.

   **Why M/E/S cannot pass through unchanged:** In v1, `GanCubeDriver` had a fixed map (GAN face 0 → `'U'`, face 2 → `'F'`, etc.). After an E CW move, the physical M slice is bounded by blue and green centers (not orange and red anymore). GAN sends face 5 (blue) + face 2 (green), which v1 maps `'B'` + `'F'` → SliceMoveDetector stores `'S'`. So v1 stored `'S'` for a physical M. M/E/S labels are equally unreliable after center drift.

   **U/R/F/D/L/B:** map stored face label to its original GAN color (`U→W, R→R, F→G, D→Y, L→O, B→B`). Find where that color's center is currently in `_facelets`. Emit the corrected geometric face.

   **M/E/S:** map stored slice to its original GAN color pair (`M→{O,R}`, `E→{Y,W}`, `S→{G,B}`). Find where both colors' centers are currently in `_facelets`. Map the resulting face pair to the correct slice (`L+R→M`, `U+D→E`, `F+B→S`). Keep the original direction unchanged.

   Apply the corrected move to `_facelets` after each step.

2. **Correctness check + recompute phases.** Resolve `solve.method` (defaulting to `'cfop'` when absent) to a `SolveMethod` object. Call `computePhases(correctedMoves, solve.scramble, resolvedMethod)` using the internal helper from 1e — this is data correction, not a method switch, so `recomputePhases` is not called here. Assert that `freshPhases.map(p => p.turns)` is identical to `solve.phases.map(p => p.turns)`. Because the physical cube state after each move is the same regardless of how the face label is encoded, every `isComplete` check must fire at the same move index — so turn counts per phase must be preserved exactly. If the check fails, the record is malformed — return the original solve unchanged and log a warning. No silent data corruption.

   Identical turn counts also guarantee identical phase timing (`recognitionMs`, `executionMs`): same phase boundaries → same moves in each phase → same `cubeTimestamp` differences.

   (The final `isSolvedFacelets` check is subsumed by this: if all phase turn counts match, the full-solve facelets path is identical and the cube ends solved.)

3. **Return** `{ ...solve, moves: correctedMoves, phases: freshPhases, schemaVersion: 2 }`.

---

### 2c. localStorage migration

Triggered automatically on app load, before the UI renders.

In `useSolveHistory.ts`, after loading local solves:
```ts
const migrated = localSolves.map(s =>
  (s.schemaVersion ?? 1) < 2 ? migrateSolveV1toV2(s) : s
)
if (migrated.some((s, i) => s !== localSolves[i])) {
  saveLocalSolves(migrated)
}
```

Silent, instant, no `movesV1` kept (no review workflow for local storage).

---

### 2d. Firestore migration

**Trigger:** debug panel button — "Migrate solves to v2 (N pending)". N is the count of Firestore records with `schemaVersion < 2`.

**Per-record write:**
```ts
{
  moves: correctedMoves,       // v2 face labels
  movesV1: originalMoves,      // preserved for review
  phases: freshPhases,
  schemaVersion: 2,
}
```

Records that pass the fast path (no M/E/S) are written without `movesV1` — they needed no correction, nothing to review.

**Result feedback:** button shows success count and any failed records (those that returned unchanged due to failed correctness check).

---

### 2e. Review UX

**Sidebar badge:** any solve with `movesV1` present gets a visual indicator (badge or color accent) in the solve list — "needs review".

**Solve detail modal:** when `movesV1` is present, show a comparison section: old face labels vs. corrected face labels, move by move, so the user can spot-check the correction.

**"Mark as reviewed" button:** in the solve detail modal. On click:
- Deletes `movesV1` from the Firestore document
- Removes the sidebar badge
- The record is now identical in shape to a brand new solve

Once reviewed, `movesV1` is gone. No separate flag or cleanup step needed.

---

### 2f. Warning for unmigrated records

When a solve detail modal opens and `schemaVersion < 2` and the solve contains M/E/S moves, show a warning: *"Phase analysis may be inaccurate — migrate this solve to fix it."*

CFOP solves without M/E/S show no warning even if not yet migrated, because their data is already correct.

---

### 2g. Migration tests

**`migrateSolveV1toV2` unit tests** — each test constructs a minimal `SolveRecord` with v1-encoded moves, runs migration, and asserts the corrected move labels.

**Single-slice correction** — after one slice move, subsequent outer-face moves drift. Each row below sets up: initial v1 solve has `[sliceMove, outerMove]`, where `outerMove` was stored using v1's fixed map. Migration must produce the correct geometric label for `outerMove`.

| Slice first (v1) | v1 outer stored | Physical color | Corrected geometric |
|-----------------|----------------|---------------|-------------------|
| M CW | U CW | White (W) → now at F | F CW |
| M CCW | U CW | White (W) → now at B | B CW |
| E CW | F CW | Green (G) → now at R | R CW |
| E CCW | F CW | Green (G) → now at L | L CW |
| S CW | U CW | White (W) → now at R | R CW |
| S CCW | U CW | White (W) → now at L | L CW |

**Misclassified slice correction** — v1 stored the wrong slice label because center drift made GAN's color pair land on the wrong geometric pair. Migration must produce the correct slice.

| First move | Physical second move | v1 stored (wrong) | Corrected (right) |
|-----------|---------------------|------------------|------------------|
| E CW | M CW | S CW | M CW |
| E CCW | M CW | S CW | M CW |
| M CW | E CW | S CCW | E CW |
| M CW | S CW | E CW | S CW |
| S CW | M CW | E CW | M CW |
| S CW | E CW | M CCW | E CW |

*(Directions in the "v1 stored" column are illustrative; the exact v1 direction depends on which of the two color events arrives first in the fast window. The migration must preserve the original direction from v1.)*

**Fast-path: no slice moves** — a CFOP solve with only U/R/F/D/L/B moves must return `{ ...solve, schemaVersion: 2 }` with no move changes. Assert moves array is reference-equal (no reallocation needed, or at minimum byte-identical).

**Phase-turns invariant** — for any migrated solve that passes the correctness check, assert `migratedSolve.phases.map(p => p.turns)` deep-equals `originalSolve.phases.map(p => p.turns)`. This is the primary correctness assertion: same physical states, same phase split.

**Identity check** — apply `M2 U2 M2 U2 M2 U2 M2 U2` (8 moves) from solved, write as a fake v1 solve, migrate, assert phase turn counts are unchanged across all phases.

---

## What is never affected

- `SolveRecord.timeMs` — wall-clock duration, untouched
- `SolveRecord.scramble` — notation string, untouched
- `SolveRecord.date`, `id`, `seq`, `driver`, `method`, `shareId` — untouched
- `Move.direction`, `Move.cubeTimestamp`, `Move.serial`, `Move.quaternion` — untouched; only `face` changes
- Existing CFOP solves with no M/E/S — fast-path migration, phases unchanged
- `MouseDriver`, all non-GAN drivers — no changes
- `useCubeDriverEvent`, `useSolveRecorder`, `useSolveHistory`, all hook consumers — no changes; output of `ColorMoveTranslator` is identical in type to current `SliceMoveDetector`
- `recomputePhases` public API — unchanged

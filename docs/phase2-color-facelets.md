# Color-Letter Facelets Migration

Tracks all phases of migrating the facelets string from face-position letters (`U R F D L B`) to color letters (`W R G Y O B`), and correctly implementing M/E/S slice moves with center tracking.

## Background

`sans_cube` tracks cube state as a 54-character "facelets string" (Kociemba format). This string is **never saved to disk** — `SolveRecord` only stores move labels and phase timings. Changing the facelets format has zero impact on saved solve records.

**Old format:** face-position letters — each character identifies which solved-state face that sticker belongs to. Center stickers never move in this model, so M moves were approximated as L CCW + R CW.

**New format:** color letters — each character identifies the physical sticker color. Centers move after slice moves, enabling correct M/E/S behavior and accurate FaceletDebug display.

### Character mapping

| Old | New | Face / Color |
|-----|-----|--------------|
| `U` | `W` | Top — white |
| `F` | `G` | Front — green |
| `D` | `Y` | Bottom — yellow |
| `L` | `O` | Left — orange |
| `R` | `R` | Right — unchanged |
| `B` | `B` | Back — unchanged |

---

## Phase 1 — Non-breaking infrastructure ✅ DONE

Changes that add new capabilities without touching existing behavior or saved records.

- Added `RotationFace = 'x' | 'y' | 'z'` to `types/cube.ts`; `AnyFace` extended to include it
- Added `FaceletColor = 'W' | 'R' | 'G' | 'Y' | 'O' | 'B'` type alias
- Added `schemaVersion?: number` to `SolveRecord` (absent = v1, 2 = post-fix)
- Fixed `isSolvedFacelets` to monochromatic center-match check (each face's stickers match its center) — replaces fixed-string comparison; M2 L2 R2 from solved now correctly returns true
- Added x/y/z cases to `applyMoveToFacelets` — whole-cube rotation helpers; not yet emitted by any driver
- Added x/y/z to `CubeRenderer` Record maps to satisfy TypeScript
- Added x/y/z buttons in debug mode UI — lets you rotate the cube without a driver, intended as a Phase 3 testing aid: make moves with mouse driver, then use x/y/z to visually verify center tracking

---

## Phase 2 — Color-letter rename ✅ DONE

Mechanical rename of facelets characters. No behavior change to move logic; no impact on saved records.

**Files changed:**
- `src/types/cube.ts` — `SOLVED_FACELETS` changed to `'WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB'`
- `src/utils/cfop.ts` — all face letter comparisons updated (U→W, F→G, D→Y, L→O; R and B unchanged)
- `src/utils/roux.ts` — same mapping throughout all block and phase checks
- `src/rendering/CubeRenderer.ts` — `FACE_COLORS` keys updated; fallback changed from `'U'` to `'W'`
- `src/components/FaceletDebug.tsx` — `FACE_BG` and `FACE_LABEL_COLOR` keys updated
- `tests/hooks/useCubeState.test.ts` — hardcoded facelets strings updated to color letters
- `tests/drivers/SliceMoveDetector.test.ts` — same

**What still does NOT work after Phase 2:**
- M moves do not move the center in FaceletDebug — still uses L CCW + R CW approximation. This is Phase 3.

---

## Phase 3 — Correct M/E/S + center tracking (TODO)

This is the breaking change. Requires coordinated update across the move engine and the GAN driver.

### 3a. Fix `applyMoveToFacelets` M/E/S in `src/hooks/useCubeState.ts`

Replace the recursive L+R / D+U / F+B approximations with direct middle-layer cycles.

Face layout reference:
```
U: 0-8   (center=4)    middle col = 1,4,7       middle row = 3,4,5
R: 9-17  (center=13)   middle col = 10,13,16    middle row = 12,13,14
F: 18-26 (center=22)   middle col = 19,22,25    middle row = 21,22,23
D: 27-35 (center=31)   middle col = 28,31,34    middle row = 30,31,32
L: 36-44 (center=40)   middle col = 37,40,43    middle row = 39,40,41
B: 45-53 (center=49)   middle col = 46,49,52    middle row = 48,49,50
```

**M (same direction as L):**
```ts
case 'M':
  // Middle column between L and R, L direction.
  // B is reversed: B face is stored looking inward, so col order is inverted.
  cycle(f, 1, 4, 7, 19, 22, 25, 28, 31, 34, 52, 49, 46)
  break
```

**E (same direction as D):**
```ts
case 'E':
  // Middle row between U and D, D direction (F→L→B→R→F).
  cycle(f, 21, 22, 23, 12, 13, 14, 48, 49, 50, 39, 40, 41)
  break
```

**S (same direction as F):**
```ts
case 'S':
  // Middle layer between F and B, F direction.
  cycle(f, 3, 4, 5, 10, 13, 16, 32, 31, 30, 43, 40, 37)
  break
```

After this change, `applyMoveToFacelets` correctly moves center stickers on M/E/S. The `isSolvedFacelets` monochromatic check (added in Phase 1) already handles the new semantics.

### 3b. Center tracking in `src/drivers/GanCubeDriver.ts`

**The problem:** GAN cube BLE events are color-based, not position-based. Face index 0 always means "the face whose center is white", regardless of where white currently is. After an M move, GAN face 0 refers to a different geometric face than before.

**The fix:** Track which geometric face each GAN color center is currently on, and use that to translate incoming events.

Implementation approach:
1. Maintain a facelets string inside the driver, updated after each emitted move using `applyMoveToFacelets`
2. When a GAN move event arrives with `face: N`, look up which color the N-th GAN face maps to (using `GAN_COLOR_MAP`), then find that color's current center position in the facelets string to get the geometric face label
3. Emit the corrected `Move` with the geometric face

The existing `GAN_FACE_MAP` (color index → face letter at solved state) becomes the initial mapping only. After slice moves shift centers, the driver reads the current facelets state instead.

> Note: `applyMoveToFacelets` is currently in `src/hooks/useCubeState.ts`. It should be extracted to `src/utils/applyMove.ts` before being imported by the driver, to avoid importing hook-file code into a non-hook module.

### 3c. Migration utility for old saved solves

Old `SolveRecord.moves` arrays store face labels where the GAN color-to-face mapping was fixed (white = always U, green = always F, etc.). After Phase 3 goes live, new solves record geometric face labels that account for center drift after M moves. Old solves need recomputation to be replayed correctly by `recomputePhases`.

**Signal:** `schemaVersion` absent or `1` = old format. `schemaVersion: 2` = new format.

**Migration function** (`src/utils/migrateMovesV1toV2.ts`):
```ts
function migrateMovesV1toV2(moves: Move[]): Move[] {
  let facelets = SOLVED_FACELETS
  return moves.map(move => {
    // In v1, the stored face letter IS the GAN color index name at solved state.
    // Read the current center for that color to get the geometric face.
    const geometricFace = currentGeometricFace(facelets, move.face)
    const corrected = { ...move, face: geometricFace }
    facelets = applyMoveToFacelets(facelets, corrected)
    return corrected
  })
}
```

**Where to trigger migration:**
- On localStorage load: if `schemaVersion` is absent/1, run migration and re-save with `schemaVersion: 2`
- Debug panel button: "Migrate Firestore solves" — runs migration on all cloud solves and updates them

### 3d. Update test fixtures

After Phase 3, existing solve fixtures in `tests/fixtures/solveFixtures.ts` that contain M moves will have stale face labels. Run `recomputePhases` on each and verify phase timings are still reasonable. Fixtures that don't contain M/E/S moves are unaffected.

---

## What is never affected

- `SolveRecord.moves` face labels for U/R/F/D/L/B — these are geometric and correct in both systems
- `SolveRecord.phases` — timing data only, no facelets
- `SolveRecord.scramble` — move notation string, not facelets
- `SliceMoveDetector` — detects M/E/S by pairing opposite outer-face events; logic unchanged
- Stored solve records in localStorage or Firestore for solves with no M/E/S moves — unaffected by Phase 3 migration

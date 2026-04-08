# Slice Move Detection Design

**Date:** 2026-04-07  
**Status:** Approved for implementation

## Background

GAN smart cubes detect outer-layer face movements via hardware sensors. Middle-layer slice moves (M, E, S) are not directly supported — but empirical testing shows the GAN Gen4 reports a **pair of outer-face events** within ≤50ms `cubeTimestamp` gap whenever a slice move is physically executed.

### Empirical Signal (M moves, verified on GAN 12 UI Maglev)

| Physical move | GAN reports | cubeTimestamp gap |
|---|---|---|
| M CW | L CCW + R CW (or R CW + L CCW) | ≤50ms |
| M CCW | L CW + R CCW (or R CCW + L CW) | ≤50ms |
| M2 | two consecutive M CW pairs | ≤50ms each |
| Solo R or L | single event, no partner | ≥150ms before any same-axis event |

The 50ms threshold cleanly separates slice pairs from independent consecutive outer moves. Wall-time gaps can be large (600ms+) due to BLE delivery jitter — **only `cubeTimestamp` is reliable for pairing**.

E and S detection pairs are derived by analogy (same-axis opposite-face pattern). **Empirical verification for E and S is the first next task after this feature ships.**

---

## Data Model (`src/types/cube.ts`)

Add alongside existing `Face`:

```ts
export type SliceFace = 'M' | 'E' | 'S'
export type AnyFace = Face | SliceFace

export interface Move {
  face: AnyFace   // was Face
  direction: Direction
  cubeTimestamp: number
  serial: number
  quaternion?: Quaternion
}
```

`Face` stays unchanged (used by `GesturePattern`, `GAN_FACE_MAP`, etc.).

---

## Pairing Table

When two events arrive with opposite-axis faces and `cubeTimestamp` delta ≤50ms, coalesce into a slice move. Either arrival order is valid.

| GAN detects (either order) | Emit |
|---|---|
| L CCW + R CW | M CW |
| L CW + R CCW | M CCW |
| D CCW + U CW | E CW *(verify empirically)* |
| D CW + U CCW | E CCW *(verify empirically)* |
| F CCW + B CW | S CW *(verify empirically)* |
| F CW + B CCW | S CCW *(verify empirically)* |

**Pattern:** primary face (L/D/F) detected as *opposite* direction; secondary face (R/U/B) detected as *same* direction as the slice.

**Coalesced `Move` fields:** `face`=M/E/S, `direction`=CW/CCW, `cubeTimestamp`=first event's, `serial`=first event's, `quaternion`=first event's.

---

## `SliceMoveDetector` Middleware (`src/drivers/SliceMoveDetector.ts`)

Implements `CubeDriver`, wraps any inner driver. Intercepts `move` events, coalesces pairs, re-emits. All other events (`gyro`, `connection`, `battery`) pass through unchanged.

### Buffering Logic

1. When an R/L/U/D/F/B move arrives, store as `_pending`.
2. When the next move arrives: if it completes a pair (complementary face + `cubeTimestamp` delta ≤50ms) → emit one slice move; clear `_pending`.
3. Otherwise: flush `_pending` as-is, store new move as `_pending`.
4. A **200ms wall-time safety timeout** flushes `_pending` if no partner ever arrives (handles BLE drop of the second event).

### Wiring

In `useCubeDriver`, wrap at construction:

```ts
// before
driverRef.current = new GanCubeDriver()
// after
driverRef.current = new SliceMoveDetector(new GanCubeDriver())
```

Rest of app is unchanged. MouseDriver support deferred to a future task.

### Detection Test Cases

| # | Input (GAN events) | cubeTimestamp gap | Expected output |
|---|---|---|---|
| 1 | L CCW → R CW | ≤50ms | M CW |
| 2 | R CW → L CCW | ≤50ms | M CW (order-independent) |
| 3 | L CW → R CCW | ≤50ms | M CCW |
| 4 | L CCW → R CCW | ≤50ms | L CCW, R CCW (mismatch, passthrough) |
| 5 | L CCW (no R within 50ms) | — | L CCW (timeout flush) |
| 6 | L CCW → R CW | >50ms cubeTimestamp | L CCW, R CW (window expired) |
| 7 | (L CCW → R CW) × 2 | ≤50ms each | M CW, M CW (M2) |

**Integration test:** feed L CCW + R CW through `SliceMoveDetector` → assert emits `{ face: 'M', direction: 'CW' }` → apply to facelets → verify middle column result matches Section 3 verified output.

---

## `applyMoveToFacelets` (`src/hooks/useCubeState.ts`)

Add M/E/S cases. Slice moves have no face rotation — only a middle sticker cycle.

Kociemba index layout (for reference):  
`U:0-8, R:9-17, F:18-26, D:27-35, L:36-44, B:45-53`

```
M CW (like L): cycle(f, 1,4,7,  19,22,25,  28,31,34,  52,49,46)
E CW (like D): cycle(f, 21,22,23, 12,13,14, 48,49,50,  39,40,41)
S CW (like F): cycle(f, 3,4,5,  10,13,16,  32,31,30,  43,40,37)
CCW variants use cycle3CCW with the same index groups.
```

### Sticker Cycle Notes

- **M:** B mid-col is **inverted** (52,49,46 = B pos 7,4,1 bottom→top). D→B is not inverted.
- **E:** No inversions. Content flows L→F→R→B.
- **S:** D mid-row and L mid-col are **inverted**. R→D: R-top→D-right, R-bot→D-left. L-bot→U-left, L-top→U-right.

### Sticker Test Cases (verified against physical cube)

**M CW** — `cycle(f, 1,4,7, 19,22,25, 28,31,34, 52,49,46)`

Mark B mid-col top→bot: `B[46]='1', B[49]='2', B[52]='3'`  
Input: `UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLB1BB2BB3B`  
Expected U mid-col after M CW: `[3, 2, 1]` (inverted — B-bot goes to U-top)

**E CW** — `cycle(f, 21,22,23, 12,13,14, 48,49,50, 39,40,41)`

Mark R mid-row: `R[12]='1', R[13]='2', R[14]='3'`  
Input: `UUUUUUUUURRR123RRRfffffffffdddddddddlllllllllbbbbbbbbb`  
Expected B mid-row after E CW: `[1, 2, 3]` (not inverted — R-front→B-left)

**S CW** — `cycle(f, 3,4,5, 10,13,16, 32,31,30, 43,40,37)`

Test 1 — R mid-col → D mid-row:  
Mark `R[10]='1', R[13]='2', R[16]='3'`  
Expected D mid-row (pos 3→4→5) after S CW: `['3','2','1']` (inverted — R-top→D-right)

Test 2 — U mid-row → R mid-col:  
Mark `U[3]='1', U[4]='2', U[5]='3'`  
Expected R mid-col (pos 1→4→7) after S CW: `['1','2','3']` (same order)

Test 3 — L mid-col → U mid-row:  
Mark `L[37]='1', L[40]='2', L[43]='3'`  
Expected U mid-row (pos 3→4→5) after S CW: `['3','2','1']` (inverted — L-bot→U-left)

---

## Cleanup

- Remove `console.log('[GAN-RAW]', ...)` diagnostic line from `GanCubeDriver.ts`.

---

## Future Tasks (in priority order)

1. **Verify E and S detection pairs empirically** (same capture process as M — connect GAN, do E and S moves, log raw events, confirm pairing pattern).
2. **MouseDriver slice move support** — wrap `MouseDriver` with `SliceMoveDetector` so M/E/S can be simulated for testing and replay.

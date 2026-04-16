# Cube Notation & Domain Knowledge

Reference for cube move notation, facelets string format, and GAN driver behavior as used in this project.

---

## Standard Move Notation

### Outer Faces

| Label | Face | Direction CW viewed from |
|-------|------|--------------------------|
| `U`   | Up (top)    | above |
| `D`   | Down (bottom) | below |
| `R`   | Right        | right |
| `L`   | Left         | left |
| `F`   | Front        | front |
| `B`   | Back         | back |

Suffix rules: none = CW, `'` = CCW, `2` = 180°. In this codebase, direction is stored as `"CW"` or `"CCW"` on the `Move` object.

### Slice Moves

| Label | Layer | Same direction as |
|-------|-------|-------------------|
| `M`   | Middle column (between L and R) | `L` |
| `E`   | Equatorial row (between U and D) | `D` |
| `S`   | Standing layer (between F and B) | `F` |

Slice moves **move center stickers**. After `M`, the white center is no longer on top — it moves toward the front (following the L direction).

### Whole-Cube Rotations

| Label | Axis | Same direction as |
|-------|------|-------------------|
| `x`   | R axis | `R` |
| `y`   | U axis | `U` |
| `z`   | F axis | `F` |

---

## Default Orientation

Green front, white top (standard WCA orientation).

| Face | Color  | Facelets letter |
|------|--------|-----------------|
| U    | White  | `W` |
| R    | Red    | `R` |
| F    | Green  | `G` |
| D    | Yellow | `Y` |
| L    | Orange | `O` |
| B    | Blue   | `B` |

---

## Facelets String Format (54 characters)

The cube state is encoded as a 54-character string — one character per sticker, in color-letter format (`W R G Y O B`). This is the Kociemba format, adapted to color letters in Phase 2.

### Face order and index ranges

```
U: 0–8     R: 9–17    F: 18–26
D: 27–35   L: 36–44   B: 45–53
```

Each face is stored row-major (reading order), 0 = top-left:

```
0 1 2
3 4 5
6 7 8
```

Centers are always at position 4 within each face:

```
Centers: U=4, R=13, F=22, D=31, L=40, B=49
```

### Solved state

```
WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB
```

### Full unfolded net with all indices

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

**B face note:** B is stored as if viewed from behind the cube (looking inward toward F), so its column order is mirrored relative to visual left/right. Index 45 is top-right visually, 47 is top-left.

---

## M/E/S Cycle Indices

The `cycle3CW(f, a0,a1,a2, b0,b1,b2, c0,c1,c2, d0,d1,d2)` primitive moves content `a→b→c→d→a` (i.e., `d` fills `a`, `a` fills `b`, etc.). `cycle3CCW` reverses.

### M CW (same direction as L CW)

Cycles the middle column: U col-1 → B col-1 (reversed) → D col-1 → F col-1 → U col-1

```
indices: 1,4,7  →  19,22,25  →  28,31,34  →  52,49,46
```

B column is reversed (46→52 top-to-bottom) because B is stored looking inward.

### E CW (same direction as D CW)

Cycles the equatorial row: F row-1 → R row-1 → B row-1 → L row-1 → F row-1

```
indices: 21,22,23  →  12,13,14  →  48,49,50  →  39,40,41
```

Direction: F→R→B→L (D direction).

### S CW (same direction as F CW)

Cycles the standing layer: U row-1 → R col-0 → D row-1 (reversed) → L col-2 → U row-1

```
indices: 3,4,5  →  10,13,16  →  32,31,30  →  43,40,37
```

---

## GAN Cube BLE Protocol

GAN smart cube BLE events are **color-based**, not position-based.

- `face: 0` always means "the face whose center is currently white"
- `face: 1` always means "the face whose center is currently red"
- etc.

This is the opposite of geometric notation where `U` means "the top face" regardless of color.

### GAN color index → FaceletColor mapping

```
GAN index 0 → W (white)
GAN index 1 → R (red)
GAN index 2 → G (green)
GAN index 3 → Y (yellow)
GAN index 4 → O (orange)
GAN index 5 → B (blue)
```

This is called `GAN_COLOR_MAP` in the codebase.

### Why this matters for M/E/S

After `M CW`, the white center moves from U (top) to F (front). The GAN cube now sends `face: 0` when the solver turns the front face — but that is geometrically an `F` move, not a `U` move. A fixed map (old v1 behavior) would emit `U`, which is wrong.

**The fix (Phase 3):** `ColorMoveTranslator` tracks the current facelets string and looks up each incoming color's center position to find the geometric face. The color → geometric mapping changes dynamically after each slice move.

### Color-pair lookup for slice moves

To detect which slice move occurred, the translator identifies which pair of outer faces is moving and maps to the corresponding slice:

| Outer pair | Slice |
|------------|-------|
| O + R (Left + Right centers) | M |
| Y + W (Bottom + Top centers) | E |
| G + B (Front + Back centers) | S |

### Adding support for new hardware

Before implementing a new cube driver, determine which event model it uses:

- **Color-based** (like GAN): events identify the face by center color, not geometric position. The driver must implement `ColorCubeDriver` and emit `ColorMove`. `ColorMoveTranslator` will wrap it and handle center tracking + M/E/S pairing.
- **Position-based**: events identify the geometric face directly (U/R/F/D/L/B). The driver can implement `CubeDriver` and emit `Move` directly — no translator needed.

If unknown, apply a test: perform `M CW` from solved, then turn the front face. Check what face index the hardware reports. If it reports the same index as "front" at solved state, it is position-based. If it reports the index it uses for the white/green center (whichever center moved to front), it is color-based.

---

## GAN Gyro Sensor and Slice Move Drift

### Sensor coordinate system

The GAN gyro sensor uses a different axis convention from Three.js:

```
GAN sensor:  +X = Red face (R),  +Y = Blue/back face (B),  +Z = White/top face (U)
Three.js:    +X = Red face (R),  +Y = White/top face (U),  +Z = Green/front face (F)
```

### The sensor is physically in the M-slice

In the GAN 12 UI Maglev, the gyro sensor is housed in the cube's core mechanism, which is part of the M-slice. This means **M moves physically rotate the sensor** along with the middle layer.

E and S may also rotate the sensor depending on the internal mechanism. `SLICE_GYRO_ROTATIONS` in `src/utils/quaternion.ts` covers all three.

### Why this causes axis confusion

When M CW is performed (+90° around GAN +X = body-frame right-multiply), the sensor's local axes rotate:

```
Before M CW:  sensor +Y points in B direction,  sensor +Z points in U direction
After  M CW:  sensor +Y now points in U direction, sensor +Z now points in F direction
              (Rx(+90°): Y→Z, Z→-Y)
```

Without compensation, `applyReference(q_sensor, ref)` uses the rotated sensor frame as if it were the cube frame. Result: a physical rotation around the cube's Y axis appears in the 3D display as a Z' rotation.

**Symptom table after M CW (uncompensated):**

| Physical rotation | Display shows |
|-------------------|---------------|
| x / x'            | x / x' (correct — X is the rotation axis, unaffected) |
| y                 | z'            |
| z                 | y             |

### The fix: track sensor offset, pre-correct before display

`useGyro` maintains a `sensorOffsetRef` — the accumulated body-frame rotation of the sensor relative to the cube's outer-layer frame. Before computing the display quaternion, the raw sensor value is pre-corrected:

```
q_cube = q_sensor * inv(sensorOffset)
display = applyReference(q_cube, ref)
```

`sensorOffset` is updated by **left-multiplying** the slice quaternion on each M/E/S move event:

```
sensorOffset_new = sliceQ * sensorOffset_old   // left-multiply = pre-multiply
```

**Why left-multiply?** Each `sliceQ` is defined in the cube's outer-layer frame (GAN +X/+Y/+Z of the held cube), not the sensor's current drifted frame. Rotations defined in the same fixed reference frame compose via pre-multiplication (left-multiply).

**Why not right-multiply?** Right-multiply would mean composing in the sensor's current (drifted) body frame, which is wrong. For a single slice move from identity, both give the same result — but for combinations the difference matters. After E CW (Rz+90°) then M' (Rx-90°):
- Left-multiply gives: `Rx(-90°) * Rz(+90°)` — correct
- Right-multiply gives: `Rz(+90°) * Rx(-90°)` — wrong (different matrix, rotations don't commute)

**Why pre-correcting q_sensor works for subsequent tilts:**

After M CW (sliceQ = Rx(+90°)), a physical Y tilt produces sensor rotation R_{-Z}(θ) in sensor-local coordinates. The conjugation:

```
sliceQ * R_{-Z}(θ) * inv(sliceQ)  =  R_{+Y}(θ)
```

So `q_cube = q_sensor * inv(sensorOffset)` correctly maps the sensor's -Z rotation back to Y in the cube frame.

### Reset behavior

`sensorOffset` must be reset to identity when cube state is reset to solved (the M-slice returns to its home position). In `App.tsx`, `resetAll` calls both `resetState()` (facelets) and `resetSensorOffset()` (sensor offset) together.

If you press "Reset Gyro" without also pressing "Reset Cube State", the reference is captured in `q_cube` space (already corrected), so the calibration remains valid regardless of current `sensorOffset`.

---

## Solve Record Schema Versions

| `schemaVersion` | Meaning |
|-----------------|---------|
| absent or `1`   | v1: moves stored with fixed GAN color→face map (white=U, green=F always) |
| `2`             | v2: moves stored with dynamic center tracking (correct after M/E/S) |

Solves with no M/E/S moves are identical in both versions — migration is a no-op for them.
